import { useState, useEffect, useMemo } from 'react';
import { X, Download, Calendar, Gauge, MapPin, Car, TrendingUp, DollarSign, Users, Clock, Award, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { formatDubaiDate, formatDate } from '../../utils/dateUtils';
import { formatCarForExport } from '../../utils/carExportFormatter';

interface LotBiddingResultsProps {
  lot: any;
  onClose: () => void;
}

export function LotBiddingResults({ lot, onClose }: LotBiddingResultsProps) {
  const [cars, setCars] = useState<any[]>([]);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    
    // Set up real-time subscription for bids - refresh when any bid changes
    const bidsChannel = supabase
      .channel(`lot-bids-${lot.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        loadData();
      })
      .subscribe();

    // Also listen to car changes in case car status changes
    const carsChannel = supabase
      .channel(`lot-cars-${lot.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      bidsChannel.unsubscribe();
      carsChannel.unsubscribe();
    };
  }, [lot.id]);

  const loadData = async () => {
    // Load cars in lot
    const { data: carsData } = await supabase
      .from('cars')
      .select('*')
      .eq('lot_id', lot.id);

    if (carsData) {
      setCars(carsData);
      
      // Load bids for all cars in lot
      const carIds = carsData.map(c => c.id);
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select(`
          *,
          user_id,
          users!inner(name, email, phone),
          cars (reg_no, make_model)
        `)
        .in('car_id', carIds)
        .order('amount', { ascending: false });
      
      if (bidsError) {
        console.error('Error loading bids with user details:', bidsError);
      }

      if (bidsData) {
        setBids(bidsData);
      }
    }
    setLoading(false);
  };

  // Calculate lot statistics
  const lotStats = useMemo(() => {
    const totalVehicles = cars.length;
    const totalBids = bids.length;
    const totalBidAmount = bids.reduce((sum, bid) => sum + (bid.amount || 0), 0);
    const highestBid = bids.length > 0 ? Math.max(...bids.map(b => b.amount || 0)) : 0;
    const vehiclesWithBids = new Set(bids.map(b => b.car_id)).size;
    const uniqueBidders = new Set(bids.map(b => b.user_id)).size;
    const averageBid = totalBids > 0 ? totalBidAmount / totalBids : 0;

    return {
      totalVehicles,
      totalBids,
      totalBidAmount,
      highestBid,
      vehiclesWithBids,
      uniqueBidders,
      averageBid,
    };
  }, [cars, bids]);

  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    if (lot.status === 'Closed' || lot.status === 'Early Closed') {
      return null;
    }
    
    if (!lot.bidding_end_date) {
      return null;
    }

    const now = new Date();
    const endDate = new Date(lot.bidding_end_date);
    const diff = endDate.getTime() - now.getTime();

    if (diff <= 0) {
      return { expired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes, expired: false };
  }, [lot.bidding_end_date, lot.status]);

  // Calculate bidding progress percentage
  const biddingProgress = useMemo(() => {
    if (lotStats.totalVehicles === 0) return 0;
    return Math.round((lotStats.vehiclesWithBids / lotStats.totalVehicles) * 100);
  }, [lotStats]);

  const handleDownload = () => {
    const exportData: any[] = [];
    let carIndex = 0;

    cars.forEach(car => {
      const carBids = bids.filter(b => b.car_id === car.id);
      // Deduplicate by user_id before ranking
      const bidsByUser = new Map<string, any>();
      carBids.forEach(bid => {
        const userId = bid.user_id;
        const existingBid = bidsByUser.get(userId);
        if (!existingBid || bid.amount > existingBid.amount) {
          bidsByUser.set(userId, bid);
        }
      });
      const uniqueBids = Array.from(bidsByUser.values());
      const sortedBids = uniqueBids.sort((a, b) => b.amount - a.amount);

      if (sortedBids.length > 0) {
        sortedBids.forEach((bid, bidIndex) => {
          // Use standard car format, then add bid information
          const baseData = formatCarForExport(car, carIndex, lot.lot_number);
          exportData.push({
            ...baseData,
            'Rank': bidIndex + 1,
            'Bidder Name': bid.users?.name || 'Unknown',
            'Bidder Email': bid.users?.email || '-',
            'Bidder Phone': bid.users?.phone || '-',
            'Bid Amount': bid.amount.toLocaleString(),
            'Bid Time': formatDubaiDate(bid.created_at),
          });
        });
      } else {
        // Use standard car format for cars with no bids
        const baseData = formatCarForExport(car, carIndex, lot.lot_number);
        exportData.push({
          ...baseData,
          'Rank': 'No bids',
          'Bidder Name': '-',
          'Bidder Email': '-',
          'Bidder Phone': '-',
          'Bid Amount': '-',
          'Bid Time': '-',
        });
      }
      carIndex++;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Complete Bidding Results');
    XLSX.writeFile(wb, `lot_${lot.lot_number}_complete_results_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[95vh] sm:max-h-[90vh] my-4 sm:my-8 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-dl-red to-red-700 text-white rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold truncate">
                    {lot.status === 'Closed' || lot.status === 'Early Closed' ? 'Bidding Results' : 'Bidding Progress'}
                  </h2>
                  <p className="text-sm sm:text-base text-white text-opacity-90 mt-1 truncate">
                    Lot #{lot.lot_number}
                  </p>
                </div>
              </div>
              {(lot.bidding_start_date || lot.bidding_end_date) && (
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                  {lot.bidding_start_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Start: {formatDate(lot.bidding_start_date)}</span>
                    </div>
                  )}
                  {lot.bidding_end_date && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>End: {formatDate(lot.bidding_end_date)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2.5 bg-dl-red text-white hover:bg-dl-red-hover rounded-lg transition-all duration-200 text-sm font-semibold shadow-md"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Export All</span>
                <span className="sm:hidden">Export</span>
              </button>
              <button 
                onClick={onClose} 
                className="p-2.5 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-50">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-dl-red"></div>
              <p className="mt-4 text-dl-grey font-medium">Loading bidding progress...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Lot Summary Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-dl-red bg-opacity-10 rounded-lg">
                      <Car className="w-4 h-4 text-dl-red" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 uppercase">Vehicles</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{lotStats.totalVehicles}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-green-600 bg-opacity-10 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 uppercase">Total Bids</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{lotStats.totalBids}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-purple-600 bg-opacity-10 rounded-lg">
                      <Users className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 uppercase">Bidders</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{lotStats.uniqueBidders}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-indigo-600 bg-opacity-10 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 uppercase">Progress</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{biddingProgress}%</p>
                </div>
              </div>

              {/* Time Remaining / Status Banner */}
              {timeRemaining && !timeRemaining.expired && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-600 rounded-lg">
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-900">Time Remaining</p>
                        <p className="text-lg font-bold text-green-700">
                          {timeRemaining.days > 0 && `${timeRemaining.days}d `}
                          {timeRemaining.hours > 0 && `${timeRemaining.hours}h `}
                          {timeRemaining.minutes > 0 && `${timeRemaining.minutes}m`}
                          {timeRemaining.days === 0 && timeRemaining.hours === 0 && timeRemaining.minutes === 0 && 'Less than 1 minute'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-green-700">Bidding ends on</p>
                      <p className="text-sm font-semibold text-green-900">{formatDate(lot.bidding_end_date)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {lot.status !== 'Closed' && lot.status !== 'Early Closed' && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-700">Bidding Progress</p>
                    <p className="text-sm font-bold text-dl-red">{biddingProgress}%</p>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-dl-red to-red-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${biddingProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    {lotStats.vehiclesWithBids} of {lotStats.totalVehicles} vehicles have received bids
                  </p>
                </div>
              )}

              {/* Vehicles List */}
              <div className="space-y-4">
                {cars.map((car) => {
                const carBids = bids.filter(b => b.car_id === car.id);
                // Deduplicate by user_id before ranking
                const bidsByUser = new Map<string, any>();
                carBids.forEach(bid => {
                  const userId = bid.user_id;
                  const existingBid = bidsByUser.get(userId);
                  if (!existingBid || bid.amount > existingBid.amount) {
                    bidsByUser.set(userId, bid);
                  }
                });
                const uniqueBids = Array.from(bidsByUser.values());
                const sortedBids = uniqueBids.sort((a, b) => b.amount - a.amount);

                return (
                  <div key={car.id} className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                    {/* Vehicle Header */}
                    <div className="bg-gradient-to-r from-slate-50 to-white p-4 sm:p-6 border-b border-slate-200">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-3 mb-2">
                            <div className="p-2 bg-dl-red bg-opacity-10 rounded-lg flex-shrink-0">
                              <Car className="w-5 h-5 text-dl-red" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">{car.make_model || 'Vehicle'}</h3>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                {car.reg_no && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold">Reg:</span> {car.reg_no}
                                  </span>
                                )}
                                {car.chassis_no && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold">Chassis:</span> {car.chassis_no}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Vehicle Details Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mt-4">
                            {car.year && (
                              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-500">Year</p>
                                  <p className="text-sm font-semibold text-slate-900">{car.year}</p>
                                </div>
                              </div>
                            )}
                            {car.km && (
                              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                <Gauge className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-500">KM</p>
                                  <p className="text-sm font-semibold text-slate-900">{car.km.toLocaleString()}</p>
                                </div>
                              </div>
                            )}
                            {car.location && (
                              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-500">Location</p>
                                  <p className="text-sm font-semibold text-slate-900 truncate">{car.location}</p>
                                </div>
                              </div>
                            )}
                            {car.color && (
                              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                <div className="w-4 h-4 rounded border border-slate-300 flex-shrink-0" style={{ backgroundColor: car.color.toLowerCase() }} />
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-500">Color</p>
                                  <p className="text-sm font-semibold text-slate-900 truncate">{car.color}</p>
                                </div>
                              </div>
                            )}
                            {car.fleet_no && (
                              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-500">Fleet #</p>
                                  <p className="text-sm font-semibold text-slate-900">{car.fleet_no}</p>
                                </div>
                              </div>
                            )}
                            {car.sr_number && (
                              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-500">SR #</p>
                                  <p className="text-sm font-semibold text-slate-900">{car.sr_number}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Highest Bid Badge or Bid Count */}
                        {sortedBids.length > 0 ? (
                          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 shadow-lg flex-shrink-0">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-5 h-5" />
                              <p className="text-xs font-semibold uppercase">
                                {(lot.status === 'Active' || lot.status === 'Approved') ? 'Total Bids' : 'Current Leader'}
                              </p>
                            </div>
                            {(lot.status === 'Active' || lot.status === 'Approved') ? (
                              <>
                                <p className="text-2xl font-bold mb-1">{sortedBids.length}</p>
                                <p className="text-xs opacity-75">Bidder details hidden during bid period</p>
                              </>
                            ) : (
                              <>
                                <p className="text-base font-bold mb-1">{sortedBids[0].users?.name || 'Unknown'}</p>
                                <p className="text-sm opacity-90">AED {sortedBids[0].amount.toLocaleString()}</p>
                                <p className="text-xs opacity-75 mt-1">{sortedBids.length} bid{sortedBids.length !== 1 ? 's' : ''}</p>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="bg-slate-100 text-slate-600 rounded-xl p-4 flex-shrink-0">
                            <p className="text-xs font-semibold uppercase mb-1">No Bids Yet</p>
                            <p className="text-sm">Waiting for bids</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bidding Table */}
                    {sortedBids.length > 0 ? (
                      <div className="p-4 sm:p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Bidding Rankings</h4>
                          <span className="text-xs text-slate-500">{sortedBids.length} bidder{sortedBids.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Rank</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Bidder Name</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider hidden md:table-cell">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider hidden lg:table-cell">Phone</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">Bid Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider hidden sm:table-cell">Bid Time</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {(lot.status === 'Active' || lot.status === 'Approved') ? (
                                <tr>
                                  <td colSpan={6} className="px-4 py-8 text-center">
                                    <p className="text-lg font-semibold text-slate-900">
                                      Total Bids: {sortedBids.length}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-2">
                                      Bidder details and prices are hidden during the bid period
                                    </p>
                                  </td>
                                </tr>
                              ) : (
                                sortedBids.map((bid, index) => (
                                  <tr 
                                    key={bid.id} 
                                    className={`transition-colors ${
                                      index === 0 ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500' :
                                      index === 1 ? 'bg-blue-50 border-l-4 border-blue-400' :
                                      index === 2 ? 'bg-yellow-50 border-l-4 border-yellow-400' :
                                      'hover:bg-slate-50'
                                    }`}
                                  >
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shadow-sm ${
                                          index === 0 ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' :
                                          index === 1 ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' :
                                          index === 2 ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white' :
                                          'bg-slate-200 text-slate-700'
                                        }`}>
                                          {index + 1}
                                        </span>
                                        {index === 0 && (
                                          <Award className="w-4 h-4 text-green-600" />
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <p className="text-sm font-semibold text-slate-900">{bid.users?.name || 'Unknown'}</p>
                                      <p className="text-xs text-slate-500 md:hidden">{bid.users?.email}</p>
                                      <p className="text-xs text-slate-500 lg:hidden">{bid.users?.phone}</p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
                                      {bid.users?.email || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600 hidden lg:table-cell">
                                      {bid.users?.phone || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <p className={`text-sm font-bold ${
                                        index === 0 ? 'text-green-700' :
                                        index === 1 ? 'text-blue-700' :
                                        index === 2 ? 'text-yellow-700' :
                                        'text-slate-900'
                                      }`}>
                                        AED {bid.amount.toLocaleString()}
                                      </p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">
                                      {formatDubaiDate(bid.created_at)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50">
                        <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No bids for this vehicle yet</p>
                        <p className="text-xs text-slate-400 mt-1">Bids will appear here once customers start bidding</p>
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


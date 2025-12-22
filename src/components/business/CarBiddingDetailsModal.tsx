import { useState, useEffect } from 'react';
import { X, Download, Lock, EyeOff, Shield } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { formatDubaiDate } from '../../utils/dateUtils';
import { formatCarForExport } from '../../utils/carExportFormatter';

interface CarBiddingDetailsModalProps {
  car: any;
  onClose: () => void;
}

export function CarBiddingDetailsModal({ car, onClose }: CarBiddingDetailsModalProps) {
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBids();
    
    // Set up real-time subscription for bids
    const subscription = supabase
      .channel(`car-bids-${car.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, (payload) => {
        // Only reload if the change is relevant to this car
        const changedCarId = (payload.new as any)?.car_id || (payload.old as any)?.car_id;
        if (changedCarId === car.id) {
          loadBids();
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [car.id]);

  const loadBids = async () => {
    setLoading(true);
    const { data: bidsData, error } = await supabase
      .from('bids')
      .select(`
        *,
        user_id,
        users!inner(name, email, phone)
      `)
      .eq('car_id', car.id)
      .order('amount', { ascending: false });

    if (error) {
      console.error('Error loading bids with user details:', error);
    }

    if (bidsData) {
      // Deduplicate by user_id - keep only the highest bid per user
      const bidsByUser = new Map<string, any>();
      bidsData.forEach(bid => {
        const userId = bid.user_id;
        const existingBid = bidsByUser.get(userId);
        if (!existingBid || bid.amount > existingBid.amount) {
          bidsByUser.set(userId, bid);
        }
      });
      const uniqueBids = Array.from(bidsByUser.values());
      setBids(uniqueBids.sort((a, b) => b.amount - a.amount));
    }
    setLoading(false);
  };

  const handleDownload = () => {
    const wb = XLSX.utils.book_new();
    const baseData = formatCarForExport(car, 0, car.lot_number);
    
    // Check if car is active - if so, only export total bids, not bid details
    const isActive = car.status === 'Active' || car.status === 'Approved' || car.status === 'Upcoming' || car.is_active === true;
    
    if (isActive) {
      // For active cars: Only export car details + total bids count (no bidder details or amounts)
      const uniqueBidders = new Set(bids.map(b => b.user_id));
      const totalBids = uniqueBidders.size;
      
      const exportData = [{
        'Lot#': baseData['Lot#'],
        'S#': baseData['S#'],
        'Fleet #': baseData['Fleet #'],
        'Reg #': baseData['Reg #'],
        'Current Location': baseData['Current Location'],
        'Type / Model': baseData['Type / Model'],
        'Make': baseData['Make'],
        'Chassis #': baseData['Chassis #'],
        'Color': baseData['Color'],
        'Year': baseData['Year'],
        'KM': baseData['KM'],
        'Status': car.status || '-',
        'Total Bids': totalBids,
      }];
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, 'Car Details');
      XLSX.writeFile(wb, `car_${car.reg_no || car.id}_details_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      // For closed cars: Export full bid details with all bidder information
    // Deduplicate bids by user_id before ranking
    const bidsByUser = new Map<string, any>();
    bids.forEach(bid => {
      const userId = bid.user_id;
      const existingBid = bidsByUser.get(userId);
      if (!existingBid || bid.amount > existingBid.amount) {
        bidsByUser.set(userId, bid);
      }
    });
    const uniqueBids = Array.from(bidsByUser.values());
    const sortedBids = uniqueBids.sort((a, b) => b.amount - a.amount);
    
      // All Bids in Same Row sheet (NEW FORMAT)
      const allBidsInRowData: any[] = [];
      if (sortedBids.length > 0) {
        const rowData: any = { ...baseData };
        
        // Add each bid as separate columns
        sortedBids.forEach((bid, bidIndex) => {
          const bidNum = bidIndex + 1;
          rowData[`Bid ${bidNum} Amount`] = bid.amount.toLocaleString();
          rowData[`Bid ${bidNum} Bidder Name`] = bid.users?.name || 'Unknown';
          rowData[`Bid ${bidNum} Bidder Email`] = bid.users?.email || '-';
          rowData[`Bid ${bidNum} Bidder Phone`] = bid.users?.phone || '-';
          rowData[`Bid ${bidNum} Time`] = formatDubaiDate(bid.created_at);
        });
        
        allBidsInRowData.push(rowData);
      } else {
        const rowData: any = { ...baseData };
        rowData['Bid 1 Amount'] = '-';
        rowData['Bid 1 Bidder Name'] = '-';
        rowData['Bid 1 Bidder Email'] = '-';
        rowData['Bid 1 Bidder Phone'] = '-';
        rowData['Bid 1 Time'] = '-';
        allBidsInRowData.push(rowData);
      }
      
      if (allBidsInRowData.length > 0) {
        const wsAllBidsInRow = XLSX.utils.json_to_sheet(allBidsInRowData);
        XLSX.utils.book_append_sheet(wb, wsAllBidsInRow, 'All Bids in Same Row');
      }
      
      // All Bids History sheet (Original format)
      const allBidsHistoryData: any[] = [];
      if (sortedBids.length > 0) {
        sortedBids.forEach((bid, index) => {
          allBidsHistoryData.push({
            ...baseData,
            'Rank': index + 1,
            'Bid ID': bid.id,
            'Bidder Name': bid.users?.name || 'Unknown',
            'Bidder Email': bid.users?.email || '-',
            'Bidder Phone': bid.users?.phone || '-',
            'Bid Amount': bid.amount.toLocaleString(),
            'Bid Time': formatDubaiDate(bid.created_at),
          });
        });
      } else {
        allBidsHistoryData.push({
          ...baseData,
          'Rank': 'No bids',
          'Bid ID': '-',
          'Bidder Name': '-',
          'Bidder Email': '-',
          'Bidder Phone': '-',
          'Bid Amount': '-',
          'Bid Time': '-',
        });
      }
      
      if (allBidsHistoryData.length > 0) {
        const wsAllHistory = XLSX.utils.json_to_sheet(allBidsHistoryData);
        XLSX.utils.book_append_sheet(wb, wsAllHistory, 'All Bids History');
      }
      
      // Rank 1 Bidders sheet
      if (sortedBids.length > 0 && sortedBids[0]) {
        const rank1Data = [{
          ...baseData,
          'Rank': 1,
          'Bid ID': sortedBids[0].id,
          'Bidder Name': sortedBids[0].users?.name || 'Unknown',
          'Bidder Email': sortedBids[0].users?.email || '-',
          'Bidder Phone': sortedBids[0].users?.phone || '-',
          'Bid Amount': sortedBids[0].amount.toLocaleString(),
          'Bid Time': formatDubaiDate(sortedBids[0].created_at),
        }];
        const wsRank1 = XLSX.utils.json_to_sheet(rank1Data);
        XLSX.utils.book_append_sheet(wb, wsRank1, 'Rank 1 Bidders');
      }
      
      // Rank 2 Bidders sheet
      if (sortedBids.length > 1 && sortedBids[1]) {
        const rank2Data = [{
          ...baseData,
          'Rank': 2,
          'Bid ID': sortedBids[1].id,
          'Bidder Name': sortedBids[1].users?.name || 'Unknown',
          'Bidder Email': sortedBids[1].users?.email || '-',
          'Bidder Phone': sortedBids[1].users?.phone || '-',
          'Bid Amount': sortedBids[1].amount.toLocaleString(),
          'Bid Time': formatDubaiDate(sortedBids[1].created_at),
        }];
        const wsRank2 = XLSX.utils.json_to_sheet(rank2Data);
        XLSX.utils.book_append_sheet(wb, wsRank2, 'Rank 2 Bidders');
      }
      
    XLSX.writeFile(wb, `car_${car.reg_no || car.id}_bidding_details_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  const highestBid = bids.length > 0 ? bids[0] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] my-4 sm:my-8 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl flex-shrink-0 gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">Car Bidding Details</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 truncate">
              {car.make_model} - {car.reg_no} | Lot: {car.lot_number}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors text-xs sm:text-sm"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Export Excel</span>
              <span className="sm:hidden">Export</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          {/* Car Details - All required fields from import sheet (excluding S#) */}
          <div className="bg-slate-50 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">Car Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs sm:text-sm text-slate-600">Lot Number</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900">{car.lot_number || '-'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">Fleet #</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900">{car.fleet_no || '-'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">Reg #</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900">{car.reg_no || '-'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">Make/Model</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900">{car.make_model || '-'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">Chassis #</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900">{car.chassis_no || '-'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">Color</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900">{car.color || '-'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">Year</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900">{car.year || '-'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">KM</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900">{car.km?.toLocaleString() || '-'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">Current Location</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900">{car.current_location || car.location || '-'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">Status</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900">{car.status || '-'}</p>
              </div>
            </div>
          </div>

          {/* Bidding Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 sm:mb-6">
            <div className={`rounded-lg p-4 ${(car.status === 'Active' || car.status === 'Approved' || car.status === 'Upcoming' || car.is_active) ? 'bg-amber-50 border-2 border-amber-300' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${(car.status === 'Active' || car.status === 'Approved' || car.status === 'Upcoming' || car.is_active) ? 'bg-amber-500' : 'bg-green-500'} text-white`}>
                  {(car.status === 'Active' || car.status === 'Approved' || car.status === 'Upcoming' || car.is_active) ? (
                    <Lock className="w-5 h-5" />
                  ) : (
                  <span className="text-lg font-bold">AED</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs sm:text-sm text-slate-600">Highest Bid</p>
                  {(car.status === 'Active' || car.status === 'Approved' || car.status === 'Upcoming' || car.is_active) ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Shield className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-semibold text-amber-700">Protected</p>
                    </div>
                  ) : (
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">
                      {highestBid ? `${highestBid.amount.toLocaleString()}` : 'No bids'}
                  </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 text-white p-2 rounded-lg">
                  <span className="text-lg font-bold">#</span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-600">Total Bids</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{bids.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-500 text-white p-2 rounded-lg">
                  <span className="text-lg font-bold">👤</span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-600">Unique Bidders</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">
                    {new Set(bids.map(b => b.user_id)).size}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bids Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
            </div>
          ) : bids.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <p className="text-slate-600">No bids have been placed for this vehicle yet.</p>
            </div>
          ) : (
            <div>
              {(car.status === 'Active' || car.status === 'Approved' || car.status === 'Upcoming' || car.is_active) && (
                <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-lg flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Shield className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">Bidding Information Protected</p>
                    <p className="text-xs text-amber-800">
                      Bidder details and bid amounts are securely hidden during the active bidding period. Full information will be available once the auction closes.
                    </p>
                  </div>
                </div>
              )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase">Rank</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase">Bidder Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase">Phone</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-700 uppercase">Bid Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase">Bid Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {bids.map((bid, index) => {
                      const isActive = car.status === 'Active' || car.status === 'Approved' || car.status === 'Upcoming' || car.is_active;
                      return (
                        <tr key={bid.id} className={index === 0 && !isActive ? 'bg-green-50' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                              index === 0 && !isActive ? 'bg-green-500 text-white' :
                              index === 1 && !isActive ? 'bg-slate-400 text-white' :
                              index === 2 && !isActive ? 'bg-orange-400 text-white' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                          <td className="px-4 py-2">
                            {isActive ? (
                              <div className="flex items-center gap-2">
                                <EyeOff className="w-4 h-4 text-slate-400" />
                                <span className="text-sm text-slate-500 font-medium">Protected</span>
                              </div>
                            ) : (
                              <span className="text-sm font-medium text-slate-900">{bid.users?.name || 'Unknown'}</span>
                            )}
                      </td>
                          <td className="px-4 py-2">
                            {isActive ? (
                              <div className="flex items-center gap-2">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span className="text-sm text-slate-500">—</span>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-600">{bid.users?.email || '-'}</span>
                            )}
                      </td>
                          <td className="px-4 py-2">
                            {isActive ? (
                              <div className="flex items-center gap-2">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span className="text-sm text-slate-500">—</span>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-600">{bid.users?.phone || '-'}</span>
                            )}
                      </td>
                          <td className="px-4 py-2 text-right">
                            {isActive ? (
                              <div className="flex items-center justify-end gap-2">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span className="text-sm text-slate-500 font-medium">—</span>
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-slate-900">{bid.amount.toLocaleString()}</span>
                            )}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600">
                        {formatDubaiDate(bid.created_at)}
                      </td>
                    </tr>
                      );
                    })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


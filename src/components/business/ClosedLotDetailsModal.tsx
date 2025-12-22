import { useState, useEffect, useMemo } from 'react';
import { X, Download, Calendar, Gauge, MapPin, CheckCircle2, XCircle, Car, TrendingUp, DollarSign, Award, FileText, Trophy } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { formatDubaiDate, formatDate } from '../../utils/dateUtils';
import { useNotification } from '../../contexts/NotificationContext';
import { formatCarForExport } from '../../utils/carExportFormatter';

interface ClosedLotDetailsModalProps {
  lot: any;
  onClose: () => void;
}

export function ClosedLotDetailsModal({ lot, onClose }: ClosedLotDetailsModalProps) {
  const [cars, setCars] = useState<any[]>([]);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bidded' | 'unbidded' | 'all'>('bidded');
  const { showSuccess } = useNotification();

  useEffect(() => {
    loadData();
  }, [lot.id]);

  const loadData = async () => {
    setLoading(true);
    // Load cars in lot
    const { data: carsData } = await supabase
      .from('cars')
      .select('*')
      .eq('lot_id', lot.id);

    if (carsData) {
      setCars(carsData);
      
      // Load bids for all cars in lot
      const carIds = carsData.map(c => c.id);
      const { data: bidsData } = await supabase
        .from('bids')
        .select(`
          *,
          users!inner(name, email, phone),
          cars (reg_no, make_model)
        `)
        .in('car_id', carIds)
        .order('amount', { ascending: false });
      
      if (bidsData) {
        setBids(bidsData);
      }
    }
    setLoading(false);
  };

  const biddedCars = useMemo(() => {
    return cars.filter(car => {
      const carBids = bids.filter(b => b.car_id === car.id);
      return carBids.length > 0;
    });
  }, [cars, bids]);

  const unbiddedCars = useMemo(() => {
    return cars.filter(car => {
      const carBids = bids.filter(b => b.car_id === car.id);
      return carBids.length === 0;
    });
  }, [cars, bids]);

  // Calculate lot statistics
  const lotStats = useMemo(() => {
    const totalVehicles = cars.length;
    const totalBids = bids.length;
    const totalBidAmount = bids.reduce((sum, bid) => sum + (bid.amount || 0), 0);
    const highestBid = bids.length > 0 ? Math.max(...bids.map(b => b.amount || 0)) : 0;
    const vehiclesWithBids = biddedCars.length;
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
  }, [cars, bids, biddedCars]);

  const handleDownloadBidded = () => {
    const wb = XLSX.utils.book_new();
    
    // Sort bidded cars by lot number and then by S# (sr_number)
    const sortedBiddedCars = [...biddedCars].sort((a, b) => {
      const lotA = lot.lot_number || '';
      const lotB = lot.lot_number || '';
      if (lotA !== lotB) {
        return lotA.localeCompare(lotB);
      }
      const srA = String(a.sr_number || '').toLowerCase();
      const srB = String(b.sr_number || '').toLowerCase();
      const numSrA = parseFloat(srA);
      const numSrB = parseFloat(srB);
      if (!isNaN(numSrA) && !isNaN(numSrB)) {
        return numSrA - numSrB;
      }
      return srA.localeCompare(srB);
    });
    
    // Find maximum number of bids for any vehicle to determine column count
    let maxBids = 0;
    sortedBiddedCars.forEach(car => {
      const carBids = bids.filter(b => b.car_id === car.id);
      if (carBids.length > maxBids) {
        maxBids = carBids.length;
      }
    });

    // Export Option 1: All Bids in Same Row (NEW FORMAT)
    const allBidsInRowData: any[] = [];
    sortedBiddedCars.forEach((car, carIndex) => {
      const carBids = bids.filter(b => b.car_id === car.id);
      // Sort all bids by amount descending and time (most recent first for same amount)
      const sortedBids = carBids.sort((a, b) => {
        if (b.amount !== a.amount) {
          return b.amount - a.amount;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // Start with car details
      const baseData = formatCarForExport(car, carIndex, lot.lot_number);
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

      // Fill empty columns for vehicles with fewer bids
      for (let i = sortedBids.length + 1; i <= maxBids; i++) {
        rowData[`Bid ${i} Amount`] = '-';
        rowData[`Bid ${i} Bidder Name`] = '-';
        rowData[`Bid ${i} Bidder Email`] = '-';
        rowData[`Bid ${i} Bidder Phone`] = '-';
        rowData[`Bid ${i} Time`] = '-';
      }

      allBidsInRowData.push(rowData);
    });

    // Export Option 2: All Bids History (include ALL bids, not deduplicated) - Original format
    const allBidsHistoryData: any[] = [];
    sortedBiddedCars.forEach((car, carIndex) => {
      const carBids = bids.filter(b => b.car_id === car.id);
      // Sort all bids by amount descending and time (most recent first for same amount)
      const sortedBids = carBids.sort((a, b) => {
        if (b.amount !== a.amount) {
          return b.amount - a.amount;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      sortedBids.forEach((bid, bidIndex) => {
        // Use standard car format, then add bid information
        const baseData = formatCarForExport(car, carIndex, lot.lot_number);
        allBidsHistoryData.push({
          ...baseData,
          'Rank': bidIndex + 1,
          'Bid ID': bid.id,
          'Bidder Name': bid.users?.name || 'Unknown',
          'Bidder Email': bid.users?.email || '-',
          'Bidder Phone': bid.users?.phone || '-',
          'Bid Amount': bid.amount.toLocaleString(),
          'Bid Time': formatDubaiDate(bid.created_at),
        });
      });
    });

    // Export Option 2: Rank 1 Bidders Only (deduplicated by user, highest bid per user)
    const rank1Data: any[] = [];
    sortedBiddedCars.forEach((car, carIndex) => {
      const carBids = bids.filter(b => b.car_id === car.id);
      // Deduplicate by user_id before ranking - keep highest bid per user
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
      const rank1Bid = sortedBids[0];

      if (rank1Bid) {
        // Use standard car format, then add bid information
        const baseData = formatCarForExport(car, carIndex, lot.lot_number);
        rank1Data.push({
          ...baseData,
          'Rank': 1,
          'Bid ID': rank1Bid.id,
          'Bidder Name': rank1Bid.users?.name || 'Unknown',
          'Bidder Email': rank1Bid.users?.email || '-',
          'Bidder Phone': rank1Bid.users?.phone || '-',
          'Bid Amount': rank1Bid.amount.toLocaleString(),
          'Bid Time': formatDubaiDate(rank1Bid.created_at),
        });
      }
    });

    // Export Option 3: Rank 2 Bidders Only (deduplicated by user, second highest bid per user)
    const rank2Data: any[] = [];
    sortedBiddedCars.forEach((car, carIndex) => {
      const carBids = bids.filter(b => b.car_id === car.id);
      // Deduplicate by user_id before ranking - keep highest bid per user
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
      const rank2Bid = sortedBids[1]; // Second highest

      if (rank2Bid) {
        // Use standard car format, then add bid information
        const baseData = formatCarForExport(car, carIndex, lot.lot_number);
        rank2Data.push({
          ...baseData,
          'Rank': 2,
          'Bid ID': rank2Bid.id,
          'Bidder Name': rank2Bid.users?.name || 'Unknown',
          'Bidder Email': rank2Bid.users?.email || '-',
          'Bidder Phone': rank2Bid.users?.phone || '-',
          'Bid Amount': rank2Bid.amount.toLocaleString(),
          'Bid Time': formatDubaiDate(rank2Bid.created_at),
        });
      }
    });

    // Create all sheets
    const wsAllBidsInRow = XLSX.utils.json_to_sheet(allBidsInRowData);
    const wsAllHistory = XLSX.utils.json_to_sheet(allBidsHistoryData);
    const wsRank1 = XLSX.utils.json_to_sheet(rank1Data);
    const wsRank2 = XLSX.utils.json_to_sheet(rank2Data);
    
    XLSX.utils.book_append_sheet(wb, wsAllBidsInRow, 'All Bids in Same Row');
    XLSX.utils.book_append_sheet(wb, wsAllHistory, 'All Bids History');
    XLSX.utils.book_append_sheet(wb, wsRank1, 'Rank 1 Bidders');
    XLSX.utils.book_append_sheet(wb, wsRank2, 'Rank 2 Bidders');
    
    XLSX.writeFile(wb, `lot_${lot.lot_number}_bidded_cars_${new Date().toISOString().split('T')[0]}.xlsx`);
    showSuccess('Export Successful', 'Bidded cars exported with all bids in same row, all bids history, rank 1, and rank 2 bidders sheets');
  };

  const handleDownloadUnbidded = () => {
    // Sort unbidded cars by lot number and then by S# (sr_number)
    const sortedUnbiddedCars = [...unbiddedCars].sort((a, b) => {
      const lotA = lot.lot_number || '';
      const lotB = lot.lot_number || '';
      if (lotA !== lotB) {
        return lotA.localeCompare(lotB);
      }
      const srA = String(a.sr_number || '').toLowerCase();
      const srB = String(b.sr_number || '').toLowerCase();
      const numSrA = parseFloat(srA);
      const numSrB = parseFloat(srB);
      if (!isNaN(numSrA) && !isNaN(numSrB)) {
        return numSrA - numSrB;
      }
      return srA.localeCompare(srB);
    });
    
    // Use standard export format for unbidded cars
    const exportData = sortedUnbiddedCars.map((car, index) => formatCarForExport(car, index, lot.lot_number));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Unbidded Cars');
    XLSX.writeFile(wb, `lot_${lot.lot_number}_unbidded_cars_${new Date().toISOString().split('T')[0]}.xlsx`);
    showSuccess('Export Successful', 'Unbidded cars exported successfully');
  };

  const handleDownloadAll = () => {
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: All Cars
    // Sort all cars by lot number and then by S# (sr_number)
    const sortedCars = [...cars].sort((a, b) => {
      const lotA = lot.lot_number || '';
      const lotB = lot.lot_number || '';
      if (lotA !== lotB) {
        return lotA.localeCompare(lotB);
      }
      const srA = String(a.sr_number || '').toLowerCase();
      const srB = String(b.sr_number || '').toLowerCase();
      const numSrA = parseFloat(srA);
      const numSrB = parseFloat(srB);
      if (!isNaN(numSrA) && !isNaN(numSrB)) {
        return numSrA - numSrB;
      }
      return srA.localeCompare(srB);
    });
    
    // Sheet 1: All Cars (use standard format, add additional fields)
    const allCarsData = sortedCars.map((car, index) => {
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
      const highestBid = sortedBids.length > 0 ? sortedBids[0] : null;
      
      // Use standard car format, then add additional fields
      const baseData = formatCarForExport(car, index, lot.lot_number);
      return {
        ...baseData,
        'Has Bids': carBids.length > 0 ? 'Yes' : 'No',
        'Total Bids': carBids.length,
        'Highest Bid': highestBid ? highestBid.amount.toLocaleString() : '-',
        'Highest Bidder': highestBid ? highestBid.users?.name || 'Unknown' : '-',
      };
    });

    // Sort bidded cars by lot number and then by S# (sr_number)
    const sortedBiddedCarsForAll = [...biddedCars].sort((a, b) => {
      const lotA = lot.lot_number || '';
      const lotB = lot.lot_number || '';
      if (lotA !== lotB) {
        return lotA.localeCompare(lotB);
      }
      const srA = String(a.sr_number || '').toLowerCase();
      const srB = String(b.sr_number || '').toLowerCase();
      const numSrA = parseFloat(srA);
      const numSrB = parseFloat(srB);
      if (!isNaN(numSrA) && !isNaN(numSrB)) {
        return numSrA - numSrB;
      }
      return srA.localeCompare(srB);
    });

    // Find maximum number of bids for any vehicle to determine column count
    let maxBids = 0;
    sortedBiddedCarsForAll.forEach(car => {
      const carBids = bids.filter(b => b.car_id === car.id);
      if (carBids.length > maxBids) {
        maxBids = carBids.length;
      }
    });
    
    // Sheet 2: All Bids in Same Row (NEW FORMAT)
    const allBidsInRowData: any[] = [];
    sortedBiddedCarsForAll.forEach((car, carIndex) => {
      const carBids = bids.filter(b => b.car_id === car.id);
      // Sort all bids by amount descending and time (most recent first for same amount)
      const sortedBids = carBids.sort((a, b) => {
        if (b.amount !== a.amount) {
          return b.amount - a.amount;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // Start with car details
      const baseData = formatCarForExport(car, carIndex, lot.lot_number);
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

      // Fill empty columns for vehicles with fewer bids
      for (let i = sortedBids.length + 1; i <= maxBids; i++) {
        rowData[`Bid ${i} Amount`] = '-';
        rowData[`Bid ${i} Bidder Name`] = '-';
        rowData[`Bid ${i} Bidder Email`] = '-';
        rowData[`Bid ${i} Bidder Phone`] = '-';
        rowData[`Bid ${i} Time`] = '-';
      }

      allBidsInRowData.push(rowData);
    });
    
    // Sheet 3: All Bids History (include ALL bids, not deduplicated) - Original format
    const allBidsHistoryData: any[] = [];
    sortedBiddedCarsForAll.forEach((car, carIndex) => {
      const carBids = bids.filter(b => b.car_id === car.id);
      // Sort all bids by amount descending and time (most recent first for same amount)
      const sortedBids = carBids.sort((a, b) => {
        if (b.amount !== a.amount) {
          return b.amount - a.amount;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      sortedBids.forEach((bid, bidIndex) => {
        // Use standard car format, then add bid information
        const baseData = formatCarForExport(car, carIndex, lot.lot_number);
        allBidsHistoryData.push({
          ...baseData,
          'Rank': bidIndex + 1,
          'Bid ID': bid.id,
          'Bidder Name': bid.users?.name || 'Unknown',
          'Bidder Email': bid.users?.email || '-',
          'Bidder Phone': bid.users?.phone || '-',
          'Bid Amount': bid.amount.toLocaleString(),
          'Bid Time': formatDubaiDate(bid.created_at),
        });
      });
    });

    // Sheet 4: Rank 1 Bidders Only
    const rank1Data: any[] = [];
    sortedBiddedCarsForAll.forEach((car, carIndex) => {
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
      const rank1Bid = sortedBids[0];

      if (rank1Bid) {
        const baseData = formatCarForExport(car, carIndex, lot.lot_number);
        rank1Data.push({
          ...baseData,
          'Rank': 1,
          'Bid ID': rank1Bid.id,
          'Bidder Name': rank1Bid.users?.name || 'Unknown',
          'Bidder Email': rank1Bid.users?.email || '-',
          'Bidder Phone': rank1Bid.users?.phone || '-',
          'Bid Amount': rank1Bid.amount.toLocaleString(),
          'Bid Time': formatDubaiDate(rank1Bid.created_at),
        });
      }
    });

    // Sheet 5: Rank 2 Bidders Only
    const rank2Data: any[] = [];
    sortedBiddedCarsForAll.forEach((car, carIndex) => {
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
      const rank2Bid = sortedBids[1]; // Second highest

      if (rank2Bid) {
        const baseData = formatCarForExport(car, carIndex, lot.lot_number);
        rank2Data.push({
          ...baseData,
          'Rank': 2,
          'Bid ID': rank2Bid.id,
          'Bidder Name': rank2Bid.users?.name || 'Unknown',
          'Bidder Email': rank2Bid.users?.email || '-',
          'Bidder Phone': rank2Bid.users?.phone || '-',
          'Bid Amount': rank2Bid.amount.toLocaleString(),
          'Bid Time': formatDubaiDate(rank2Bid.created_at),
        });
      }
    });

    // Sort unbidded cars by lot number and then by S# (sr_number)
    const sortedUnbiddedCarsForAll = [...unbiddedCars].sort((a, b) => {
      const lotA = lot.lot_number || '';
      const lotB = lot.lot_number || '';
      if (lotA !== lotB) {
        return lotA.localeCompare(lotB);
      }
      const srA = String(a.sr_number || '').toLowerCase();
      const srB = String(b.sr_number || '').toLowerCase();
      const numSrA = parseFloat(srA);
      const numSrB = parseFloat(srB);
      if (!isNaN(numSrA) && !isNaN(numSrB)) {
        return numSrA - numSrB;
      }
      return srA.localeCompare(srB);
    });

    // Sheet 6: Unbidded Cars (use standard format)
    const unbiddedCarsData = sortedUnbiddedCarsForAll.map((car, index) => formatCarForExport(car, index, lot.lot_number));

    // Create all sheets
    const wsAll = XLSX.utils.json_to_sheet(allCarsData);
    const wsAllBidsInRow = XLSX.utils.json_to_sheet(allBidsInRowData);
    const wsAllHistory = XLSX.utils.json_to_sheet(allBidsHistoryData);
    const wsRank1 = XLSX.utils.json_to_sheet(rank1Data);
    const wsRank2 = XLSX.utils.json_to_sheet(rank2Data);
    const wsUnbidded = XLSX.utils.json_to_sheet(unbiddedCarsData);
    
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Cars');
    XLSX.utils.book_append_sheet(wb, wsAllBidsInRow, 'All Bids in Same Row');
    XLSX.utils.book_append_sheet(wb, wsAllHistory, 'All Bids History');
    XLSX.utils.book_append_sheet(wb, wsRank1, 'Rank 1 Bidders');
    XLSX.utils.book_append_sheet(wb, wsRank2, 'Rank 2 Bidders');
    XLSX.utils.book_append_sheet(wb, wsUnbidded, 'Unbidded Cars');
    
    XLSX.writeFile(wb, `lot_${lot.lot_number}_all_cars_${new Date().toISOString().split('T')[0]}.xlsx`);
    showSuccess('Export Successful', 'All cars exported with all bids in same row format, separate sheets for bidded and unbidded cars');
  };

  const displayCars = activeTab === 'bidded' ? biddedCars : activeTab === 'unbidded' ? unbiddedCars : cars;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[95vh] sm:max-h-[90vh] my-4 sm:my-8 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold truncate text-white">
                    Closed Lot Details
                  </h2>
                  <p className="text-sm sm:text-base text-white text-opacity-90 mt-1 truncate">
                    Lot #{lot.lot_number}
                  </p>
                </div>
              </div>
              {(lot.bidding_start_date || lot.bidding_end_date || lot.early_closed_at) && (
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                  {lot.bidding_start_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Start: {formatDate(lot.bidding_start_date)}</span>
                    </div>
                  )}
                  {(lot.early_closed_at || lot.bidding_end_date) && (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      <span>Closed: {formatDate(lot.early_closed_at || lot.bidding_end_date)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {activeTab === 'bidded' && biddedCars.length > 0 && (
                <button
                  onClick={handleDownloadBidded}
                  className="flex items-center gap-2 px-4 py-2.5 bg-dl-red text-white hover:bg-dl-red-hover rounded-lg transition-all duration-200 text-sm font-semibold shadow-md"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Download Bidded</span>
                  <span className="sm:hidden">Download</span>
                </button>
              )}
              {activeTab === 'unbidded' && unbiddedCars.length > 0 && (
                <button
                  onClick={handleDownloadUnbidded}
                  className="flex items-center gap-2 px-4 py-2.5 bg-dl-red text-white hover:bg-dl-red-hover rounded-lg transition-all duration-200 text-sm font-semibold shadow-md"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Download Unbidded</span>
                  <span className="sm:hidden">Download</span>
                </button>
              )}
              {activeTab === 'all' && cars.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  className="flex items-center gap-2 px-4 py-2.5 bg-dl-red text-white hover:bg-dl-red-hover rounded-lg transition-all duration-200 text-sm font-semibold shadow-md"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Download All</span>
                  <span className="sm:hidden">Download</span>
                </button>
              )}
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

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-white px-4 sm:px-6 flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('bidded')}
              className={`px-4 py-3 text-sm font-semibold border-b-3 transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === 'bidded'
                  ? 'border-dl-red text-dl-red bg-green-50'
                  : 'border-transparent text-slate-600 hover:text-dl-red hover:border-slate-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 inline mr-2" />
              Bidded Cars ({biddedCars.length})
            </button>
            <button
              onClick={() => setActiveTab('unbidded')}
              className={`px-4 py-3 text-sm font-semibold border-b-3 transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === 'unbidded'
                  ? 'border-dl-red text-dl-red bg-orange-50'
                  : 'border-transparent text-slate-600 hover:text-dl-red hover:border-slate-300'
              }`}
            >
              <XCircle className="w-4 h-4 inline mr-2" />
              Unbidded Cars ({unbiddedCars.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-3 text-sm font-semibold border-b-3 transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === 'all'
                  ? 'border-dl-red text-dl-red bg-blue-50'
                  : 'border-transparent text-slate-600 hover:text-dl-red hover:border-slate-300'
              }`}
            >
              <Car className="w-4 h-4 inline mr-2" />
              All Cars ({cars.length})
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-50">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-dl-red"></div>
              <p className="mt-4 text-dl-grey font-medium">Loading lot details...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Lot Summary Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
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
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 uppercase">Bidded</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{lotStats.vehiclesWithBids}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-orange-600 bg-opacity-10 rounded-lg">
                      <XCircle className="w-4 h-4 text-orange-600" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 uppercase">Unbidded</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{unbiddedCars.length}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-blue-600 bg-opacity-10 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 uppercase">Total Bids</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{lotStats.totalBids}</p>
                </div>
              </div>

              {/* Status Banner */}
              <div className="bg-gradient-to-r from-slate-100 to-slate-200 border-2 border-slate-300 rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-600 rounded-lg">
                      <XCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Lot Status: {lot.status}</p>
                      <p className="text-xs text-slate-700">
                        {lot.early_closed_at ? 'Early Closed' : 'Bidding Period Ended'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-700">Closed on</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(lot.early_closed_at || lot.bidding_end_date)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Vehicles List */}
              {displayCars.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-300">
                  <Car className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-slate-900 mb-2">
                    {activeTab === 'bidded' ? 'No Cars with Bids' : activeTab === 'unbidded' ? 'No Unbidded Cars' : 'No Cars Available'}
                  </p>
                  <p className="text-slate-600">
                    {activeTab === 'bidded' 
                      ? 'There are no cars with bids in this lot.' 
                      : activeTab === 'unbidded'
                      ? 'All cars in this lot have received bids.'
                      : 'No cars are available in this lot.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
              {displayCars.map((car) => {
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
                const highestBid = sortedBids.length > 0 ? sortedBids[0] : null;

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
                              </div>
                            </div>
                          </div>
                          
                          {/* Vehicle Details Grid - Only required fields from import sheet (excluding S#) */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mt-4">
                            {lot.lot_number && (
                              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-500">Lot #</p>
                                  <p className="text-sm font-semibold text-slate-900">{lot.lot_number}</p>
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
                            {car.chassis_no && (
                              <div className="flex items-start gap-2 bg-slate-50 rounded-lg p-2">
                                <FileText className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs text-slate-500">Chassis #</p>
                                  <p className="text-sm font-semibold text-slate-900 break-words">{car.chassis_no}</p>
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
                            {(car.location || car.current_location) && (
                              <div className="flex items-start gap-2 bg-slate-50 rounded-lg p-2">
                                <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs text-slate-500">Location</p>
                                  <p className="text-sm font-semibold text-slate-900 break-words">{car.location || car.current_location}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Highest Bid Badge or Status */}
                        {highestBid && (activeTab === 'bidded' || activeTab === 'all') ? (
                          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 shadow-lg flex-shrink-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Award className="w-5 h-5" />
                              <p className="text-xs font-semibold uppercase text-white">
                                Highest Bid
                              </p>
                            </div>
                            <p className="text-base font-bold mb-1 text-white">{highestBid.users?.name || 'Unknown'}</p>
                            <p className="text-sm opacity-90 text-white">AED {highestBid.amount.toLocaleString()}</p>
                          </div>
                        ) : (activeTab === 'unbidded' || activeTab === 'all') && sortedBids.length === 0 ? (
                          <div className="bg-slate-100 text-slate-600 rounded-xl p-4 flex-shrink-0">
                            <p className="text-xs font-semibold uppercase mb-1">No Bids</p>
                            <p className="text-sm">No bids received</p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Bidding Table */}
                    {(activeTab === 'bidded' || activeTab === 'all') && sortedBids.length > 0 && (
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
                                <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {sortedBids.map((bid, index) => (
                                <tr 
                                  key={bid.id} 
                                  className={`transition-colors ${
                                    index === 0 ? 'bg-blue-50 border-l-4 border-blue-400' :
                                    index === 1 ? 'bg-yellow-50 border-l-4 border-yellow-400' :
                                    'hover:bg-slate-50'
                                  }`}
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shadow-sm ${
                                        index === 0 ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' :
                                        index === 0 ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' :
                                        index === 1 ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white' :
                                        'bg-slate-200 text-slate-700'
                                      }`}>
                                        {index + 1}
                                      </span>
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
                                      index === 0 ? 'text-blue-700' :
                                      index === 0 ? 'text-blue-700' :
                                      index === 1 ? 'text-yellow-700' :
                                      'text-slate-900'
                                    }`}>
                                      AED {bid.amount.toLocaleString()}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">
                                    {formatDubaiDate(bid.created_at)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      <span className="text-slate-400">-</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


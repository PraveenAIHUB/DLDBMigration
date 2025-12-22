import { useState, useEffect, useMemo } from 'react';
import { Download, TrendingUp, FileText, LogOut, Building, Car, DollarSign, Calendar, Eye, CheckSquare, Square, Filter, Lock, EyeOff, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { LotBiddingResults } from './LotBiddingResults';
import { CarBiddingDetailsModal } from './CarBiddingDetailsModal';
import { ClosedLotDetailsModal } from './ClosedLotDetailsModal';
import { Logo } from '../common/Logo';
import { formatDate } from '../../utils/dateUtils';
import * as XLSX from 'xlsx';
import { formatDubaiDate } from '../../utils/dateUtils';
import { formatCarForExport } from '../../utils/carExportFormatter';

export function BusinessUserDashboard() {
  const [activeLots, setActiveLots] = useState<any[]>([]);
  const [closedLots, setClosedLots] = useState<any[]>([]);
  const [allCars, setAllCars] = useState<any[]>([]);
  const [selectedCars, setSelectedCars] = useState<Set<string>>(new Set());
  const [selectedActiveLots, setSelectedActiveLots] = useState<Set<string>>(new Set());
  const [selectedClosedLots, setSelectedClosedLots] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'active' | 'closed' | 'cars'>('active');
  const [showFilters, setShowFilters] = useState(false);
  const [lotFilters, setLotFilters] = useState({
    status: 'All',
    lotNumber: '',
    startDateFrom: '',
    startDateTo: '',
  });
  const [carFilters, setCarFilters] = useState({
    lotNumber: '',
    makeModel: '',
    year: '',
    minKm: '',
    maxKm: '',
    location: '',
  });
  const [stats, setStats] = useState({
    totalLots: 0,
    activeLots: 0,
    closedLots: 0,
    totalCars: 0,
    totalBids: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedLot, setSelectedLot] = useState<any | null>(null);
  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  const [selectedClosedLot, setSelectedClosedLot] = useState<any | null>(null);
  const { signOut, user } = useAuth();
  const { showSuccess, showError, showWarning } = useNotification();

  useEffect(() => {
    let isMounted = true;
    let reloadTimeout: NodeJS.Timeout | null = null;
    let isLoading = false;
    
    const loadDataSafe = async () => {
      if (!isMounted || isLoading) return;
      isLoading = true;
      try {
        await loadData();
      } finally {
        isLoading = false;
      }
    };

    // Initial load
    loadDataSafe();
    
    // Set up real-time subscriptions for lots, bids, and cars
    // Use debouncing to prevent excessive reloads
    const debouncedLoadData = () => {
      if (reloadTimeout) clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(() => {
        if (isMounted && !isLoading) {
          loadDataSafe();
        }
      }, 2000); // Wait 2 seconds before reloading to batch updates
    };

    const lotsChannel = supabase
      .channel('business-lots-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots' }, () => {
        debouncedLoadData();
      })
      .subscribe();

    const bidsChannel = supabase
      .channel('business-bids-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        debouncedLoadData();
      })
      .subscribe();

    const carsChannel = supabase
      .channel('business-cars-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, () => {
        debouncedLoadData();
      })
      .subscribe();

    // Periodically refresh car statuses (every 5 minutes)
    // Note: Real-time subscriptions will handle updates, so we don't need to force reload
    const statusRefreshInterval = setInterval(async () => {
      if (!isMounted || isLoading) return;
      try {
        await supabase.rpc('refresh_car_statuses');
        // Also fix any cars that are still active in closed lots
        await supabase.rpc('fix_cars_in_closed_lots');
        // Don't force reload - real-time subscriptions will handle updates automatically
      } catch (error) {
        console.error('Error refreshing car statuses:', error);
      }
    }, 300000); // 5 minutes instead of 30 seconds

    return () => {
      isMounted = false;
      lotsChannel.unsubscribe();
      bidsChannel.unsubscribe();
      carsChannel.unsubscribe();
      clearInterval(statusRefreshInterval);
      if (reloadTimeout) clearTimeout(reloadTimeout);
    };
  }, []); // Empty dependency array - only run once on mount

  const loadData = async () => {
    setLoading(true);

    try {
      // First, refresh car statuses to ensure they're up to date
      try {
        await supabase.rpc('refresh_car_statuses');
        // Also fix any cars that are still active in closed lots
        await supabase.rpc('fix_cars_in_closed_lots');
      } catch (error) {
        console.error('Error refreshing car statuses:', error);
        // Continue even if this fails
      }
    
      // Load all approved lots
      const { data: allLots, error: lotsError } = await supabase
        .from('lots')
        .select('*')
        .eq('approved', true)
        .order('created_at', { ascending: false });

      if (!lotsError && allLots) {
      // Separate active and closed lots
      const active = allLots.filter(lot => 
        lot.status === 'Active' || lot.status === 'Approved'
      );
      const closed = allLots.filter(lot => 
        lot.status === 'Closed' || lot.status === 'Early Closed'
      );
      
      // Load bidding progress for active lots
      const activeLotIds = active.map(l => l.id);
      let lotsWithProgress = active.map(lot => ({
        ...lot,
        totalCars: 0,
        totalBids: 0,
        totalBidAmount: 0,
        highestBid: 0,
      }));
      
      if (activeLotIds.length > 0) {
        const { data: activeCars } = await supabase
          .from('cars')
          .select('id, lot_id')
          .in('lot_id', activeLotIds);

        const activeCarIds = activeCars?.map(c => c.id) || [];
        
        // Load bids for active cars
        let activeBids: any[] = [];
        if (activeCarIds.length > 0) {
          const { data: bidsData } = await supabase
            .from('bids')
            .select('id, car_id, amount')
            .in('car_id', activeCarIds);
          activeBids = bidsData || [];
        }

        // Add progress data to active lots
        lotsWithProgress = active.map(lot => {
          const lotCars = activeCars?.filter(c => c.lot_id === lot.id) || [];
          const lotCarIds = lotCars.map(c => c.id);
          const lotBids = activeBids.filter(b => lotCarIds.includes(b.car_id));
          const totalBidAmount = lotBids.reduce((sum, b) => sum + (b.amount || 0), 0);
          const highestBid = lotBids.length > 0 ? Math.max(...lotBids.map(b => b.amount || 0)) : 0;

          return {
            ...lot,
            totalCars: lotCars.length,
            totalBids: lotBids.length,
            totalBidAmount,
            highestBid,
          };
        });
      }
      
        setActiveLots(lotsWithProgress);
        setClosedLots(closed);
      } else if (lotsError) {
        console.error('Error loading lots:', lotsError);
      }

      // Load all approved lots for stats
      const { data: allApprovedLots } = await supabase
        .from('lots')
        .select('id, status')
        .eq('approved', true);

      // Load cars from approved lots
      const approvedLotIds = allApprovedLots?.map(l => l.id) || [];
      const { data: cars } = await supabase
        .from('cars')
        .select('id')
        .in('lot_id', approvedLotIds.length > 0 ? approvedLotIds : [null]);

      // Load total bids
      const { data: bids } = await supabase
        .from('bids')
        .select('id');

      // Calculate stats (use local variables, not state)
      const activeCount = allLots?.filter(lot => 
        lot.status === 'Active' || lot.status === 'Approved'
      ).length || 0;
      const closedCount = allLots?.filter(lot => 
        lot.status === 'Closed' || lot.status === 'Early Closed'
      ).length || 0;

      setStats({
        totalLots: allApprovedLots?.length || 0,
        activeLots: activeCount,
        closedLots: closedCount,
        totalCars: cars?.length || 0,
        totalBids: bids?.length || 0,
      });

      // Load all cars with bidding details for the Cars tab
      await loadAllCars();
    } catch (error) {
      console.error('Error in loadData:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllCars = async () => {
    // Load all cars from approved lots
    const { data: approvedLots } = await supabase
      .from('lots')
      .select('id, lot_number')
      .eq('approved', true);

    const approvedLotIds = approvedLots?.map(l => l.id) || [];
    
    if (approvedLotIds.length === 0) {
      setAllCars([]);
      return;
    }

    const { data: carsData, error: carsError } = await supabase
      .from('cars')
      .select('*')
      .in('lot_id', approvedLotIds)
      .order('created_at', { ascending: false });

    if (carsError) {
      console.error('Error loading cars:', carsError);
      setAllCars([]);
      return;
    }

    if (carsData) {
      // Load bids for all cars
      const carIds = carsData.map(c => c.id);
      if (carIds.length > 0) {
        const { data: bidsData, error: bidsError } = await supabase
          .from('bids')
          .select(`
            id,
            car_id,
            amount,
            created_at,
            user_id,
            users!inner(name, email, phone)
          `)
          .in('car_id', carIds)
          .order('amount', { ascending: false });
        
        if (bidsError) {
          console.error('Error loading bids with user details:', bidsError);
        }

        // Group bids by car_id and find highest bid
        const bidsByCar: Record<string, any[]> = {};
        bidsData?.forEach(bid => {
          if (!bidsByCar[bid.car_id]) {
            bidsByCar[bid.car_id] = [];
          }
          bidsByCar[bid.car_id].push(bid);
        });

        // Add lot info and bidding details to each car
        const carsWithDetails = carsData.map(car => {
          const lot = approvedLots?.find(l => l.id === car.lot_id);
          const carBids = bidsByCar[car.id] || [];
          const highestBid = carBids.length > 0 ? carBids[0] : null;
          const totalBids = carBids.length;

          return {
            ...car,
            lot_number: lot?.lot_number || '-',
            highest_bid: highestBid?.amount || null,
            highest_bidder: highestBid?.users?.name || null,
            total_bids: totalBids,
            bids: carBids,
          };
        });

        setAllCars(carsWithDetails);
      } else {
        // No cars, but still add lot info
        const carsWithDetails = carsData.map(car => {
          const lot = approvedLots?.find(l => l.id === car.lot_id);
          return {
            ...car,
            lot_number: lot?.lot_number || '-',
            highest_bid: null,
            highest_bidder: null,
            total_bids: 0,
            bids: [],
          };
        });
        setAllCars(carsWithDetails);
      }
    }
  };

  const toggleCarSelection = (carId: string) => {
    const newSelected = new Set(selectedCars);
    if (newSelected.has(carId)) {
      newSelected.delete(carId);
    } else {
      newSelected.add(carId);
    }
    setSelectedCars(newSelected);
  };

  const toggleSelectAllCars = () => {
    if (selectedCars.size === filteredCars.length) {
      setSelectedCars(new Set());
    } else {
      setSelectedCars(new Set(filteredCars.map(c => c.id)));
    }
  };

  const handleExportCars = async () => {
    // Export selected cars (or all if none selected)
    const carsToExport = selectedCars.size > 0 
      ? filteredCars.filter(c => selectedCars.has(c.id))
      : filteredCars;
    
    if (carsToExport.length === 0) {
      showWarning('No Selection', 'Please select at least one car to export');
      return;
    }

    // Separate active and closed cars
    // Active cars: status is Active/Approved/Upcoming OR is_active flag is true
    const activeCars = carsToExport.filter(c => 
      c.status === 'Active' || 
      c.status === 'Approved' || 
      c.status === 'Upcoming' || 
      c.is_active === true
    );
    // Closed cars: status is Closed/Early Closed AND is_active is not true
    const closedCars = carsToExport.filter(c => 
      (c.status === 'Closed' || c.status === 'Early Closed') && 
      c.is_active !== true
    );

    const wb = XLSX.utils.book_new();

    // Export closed cars with full bid details
    if (closedCars.length > 0) {
      // Sort closed cars by lot number and then by S# (sr_number)
      const sortedClosedCars = [...closedCars].sort((a, b) => {
        const lotA = a.lot_number || '';
        const lotB = b.lot_number || '';
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

      // Get all bids for closed cars
      const closedCarIds = sortedClosedCars.map(c => c.id);
      const { data: allBids } = await supabase
        .from('bids')
        .select(`
          *,
          users!inner(name, email, phone)
        `)
        .in('car_id', closedCarIds)
        .order('amount', { ascending: false });

      // Find maximum number of bids for any vehicle to determine column count
      let maxBids = 0;
      sortedClosedCars.forEach(car => {
        const carBids = allBids?.filter(b => b.car_id === car.id) || [];
        if (carBids.length > maxBids) {
          maxBids = carBids.length;
        }
      });

      // All Bids in Same Row sheet (NEW FORMAT)
      const allBidsInRowData: any[] = [];
      sortedClosedCars.forEach((car, carIndex) => {
        const carBids = allBids?.filter(b => b.car_id === car.id) || [];
        const sortedBids = carBids.sort((a, b) => {
          if (b.amount !== a.amount) {
            return b.amount - a.amount;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        // Start with car details
          const baseData = formatCarForExport(car, carIndex, car.lot_number);
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

      // All Bids History sheet (Original format)
      const allBidsHistoryData: any[] = [];
      sortedClosedCars.forEach((car, carIndex) => {
        const carBids = allBids?.filter(b => b.car_id === car.id) || [];
        const sortedBids = carBids.sort((a, b) => {
          if (b.amount !== a.amount) {
            return b.amount - a.amount;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        sortedBids.forEach((bid, bidIndex) => {
          const baseData = formatCarForExport(car, carIndex, car.lot_number);
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

      // Rank 1 sheet
      const rank1Data: any[] = [];
      sortedClosedCars.forEach((car, carIndex) => {
        const carBids = allBids?.filter(b => b.car_id === car.id) || [];
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
        const baseData = formatCarForExport(car, carIndex, car.lot_number);
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

      // Rank 2 sheet
      const rank2Data: any[] = [];
      sortedClosedCars.forEach((car, carIndex) => {
        const carBids = allBids?.filter(b => b.car_id === car.id) || [];
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
        const rank2Bid = sortedBids[1];

        if (rank2Bid) {
          const baseData = formatCarForExport(car, carIndex, car.lot_number);
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

      if (allBidsInRowData.length > 0) {
        const wsAllBidsInRow = XLSX.utils.json_to_sheet(allBidsInRowData);
        XLSX.utils.book_append_sheet(wb, wsAllBidsInRow, 'All Bids in Same Row');
      }
      if (allBidsHistoryData.length > 0) {
        const wsAllHistory = XLSX.utils.json_to_sheet(allBidsHistoryData);
        XLSX.utils.book_append_sheet(wb, wsAllHistory, 'All Bids History');
      }
      if (rank1Data.length > 0) {
        const wsRank1 = XLSX.utils.json_to_sheet(rank1Data);
        XLSX.utils.book_append_sheet(wb, wsRank1, 'Rank 1 Bidders');
      }
      if (rank2Data.length > 0) {
        const wsRank2 = XLSX.utils.json_to_sheet(rank2Data);
        XLSX.utils.book_append_sheet(wb, wsRank2, 'Rank 2 Bidders');
      }
    }

    // Export active cars with only total bids
    if (activeCars.length > 0) {
      // Sort active cars by lot number and then by S# (sr_number)
      const sortedActiveCars = [...activeCars].sort((a, b) => {
        const lotA = a.lot_number || '';
        const lotB = b.lot_number || '';
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

      const activeCarIds = sortedActiveCars.map(c => c.id);
      // For active cars, only fetch user_id to count unique bidders - no bid amounts or user details
      const { data: activeBids } = await supabase
        .from('bids')
        .select('car_id, user_id')
        .in('car_id', activeCarIds);

      const activeExportData: any[] = [];
      sortedActiveCars.forEach((car, index) => {
        // Count unique bidders only - no bid details for active cars
        const carBids = activeBids?.filter(b => b.car_id === car.id) || [];
        const uniqueBidders = new Set(carBids.map(b => b.user_id));
        const totalBids = uniqueBidders.size;

        const baseData = formatCarForExport(car, index, car.lot_number);
        activeExportData.push({
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
          'Total Bids': totalBids,
        });
      });

      const wsActive = XLSX.utils.json_to_sheet(activeExportData);
      XLSX.utils.book_append_sheet(wb, wsActive, 'Active Cars');
    }

    const filename = selectedCars.size > 0 
      ? `cars_export_${selectedCars.size}_cars_${new Date().toISOString().split('T')[0]}.xlsx`
      : `all_cars_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    showSuccess(
      'Export Successful',
      `Exported ${carsToExport.length} car(s) - ${closedCars.length} closed with bid details, ${activeCars.length} active with total bids only`
    );
    if (selectedCars.size > 0) {
      setSelectedCars(new Set());
    }
  };

  const filteredActiveLots = useMemo(() => {
    return activeLots.filter(lot => {
      if (lotFilters.status !== 'All' && lot.status !== lotFilters.status) {
        return false;
      }
      if (lotFilters.lotNumber && !lot.lot_number?.toLowerCase().includes(lotFilters.lotNumber.toLowerCase())) {
        return false;
      }
      if (lotFilters.startDateFrom && lot.bidding_start_date) {
        const startDate = new Date(lot.bidding_start_date);
        const fromDate = new Date(lotFilters.startDateFrom);
        if (startDate < fromDate) return false;
      }
      if (lotFilters.startDateTo && lot.bidding_start_date) {
        const startDate = new Date(lot.bidding_start_date);
        const toDate = new Date(lotFilters.startDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (startDate > toDate) return false;
      }
      return true;
    });
  }, [activeLots, lotFilters]);

  const filteredClosedLots = useMemo(() => {
    return closedLots.filter(lot => {
      if (lotFilters.status !== 'All' && lot.status !== lotFilters.status) {
        return false;
      }
      if (lotFilters.lotNumber && !lot.lot_number?.toLowerCase().includes(lotFilters.lotNumber.toLowerCase())) {
        return false;
      }
      if (lotFilters.startDateFrom && lot.bidding_start_date) {
        const startDate = new Date(lot.bidding_start_date);
        const fromDate = new Date(lotFilters.startDateFrom);
        if (startDate < fromDate) return false;
      }
      if (lotFilters.startDateTo && lot.bidding_start_date) {
        const startDate = new Date(lot.bidding_start_date);
        const toDate = new Date(lotFilters.startDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (startDate > toDate) return false;
      }
      return true;
    });
  }, [closedLots, lotFilters]);

  const filteredCars = useMemo(() => {
    return allCars.filter(car => {
      if (carFilters.lotNumber && !car.lot_number?.toLowerCase().includes(carFilters.lotNumber.toLowerCase())) {
        return false;
      }
      if (carFilters.makeModel && !car.make_model?.toLowerCase().includes(carFilters.makeModel.toLowerCase())) {
        return false;
      }
      if (carFilters.year && car.year?.toString() !== carFilters.year) {
        return false;
      }
      if (carFilters.minKm && (car.km || 0) < parseInt(carFilters.minKm)) {
        return false;
      }
      if (carFilters.maxKm && (car.km || 0) > parseInt(carFilters.maxKm)) {
        return false;
      }
      if (carFilters.location && !car.location?.toLowerCase().includes(carFilters.location.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [allCars, carFilters]);

  const clearLotFilters = () => {
    setLotFilters({
      status: 'All',
      lotNumber: '',
      startDateFrom: '',
      startDateTo: '',
    });
  };

  const clearCarFilters = () => {
    setCarFilters({
      lotNumber: '',
      makeModel: '',
      year: '',
      minKm: '',
      maxKm: '',
      location: '',
    });
  };

  const uniqueCarYears = useMemo(() => {
    const years = new Set<number>();
    allCars.forEach(car => {
      if (car.year) years.add(car.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allCars]);

  const uniqueCarLocations = useMemo(() => {
    const locations = new Set<string>();
    allCars.forEach(car => {
      if (car.location) locations.add(car.location);
    });
    return Array.from(locations).sort();
  }, [allCars]);

  const toggleActiveLotSelection = (lotId: string) => {
    const newSelected = new Set(selectedActiveLots);
    if (newSelected.has(lotId)) {
      newSelected.delete(lotId);
    } else {
      newSelected.add(lotId);
    }
    setSelectedActiveLots(newSelected);
  };

  const toggleClosedLotSelection = (lotId: string) => {
    const newSelected = new Set(selectedClosedLots);
    if (newSelected.has(lotId)) {
      newSelected.delete(lotId);
    } else {
      newSelected.add(lotId);
    }
    setSelectedClosedLots(newSelected);
  };

  const toggleSelectAllActiveLots = () => {
    if (selectedActiveLots.size === filteredActiveLots.length) {
      setSelectedActiveLots(new Set());
    } else {
      setSelectedActiveLots(new Set(filteredActiveLots.map(l => l.id)));
    }
  };

  const toggleSelectAllClosedLots = () => {
    if (selectedClosedLots.size === filteredClosedLots.length) {
      setSelectedClosedLots(new Set());
    } else {
      setSelectedClosedLots(new Set(filteredClosedLots.map(l => l.id)));
    }
  };

  const handleExportLotDetails = async (lotIds: string[], lotsData: any[]) => {
    if (lotIds.length === 0) {
      showWarning('No Selection', 'Please select at least one lot to export');
      return;
    }

    // Load all cars from selected lots
    const { data: carsData } = await supabase
      .from('cars')
      .select('*, lot:lots(id, lot_number)')
      .in('lot_id', lotIds);

    const carIds = carsData?.map(c => c.id) || [];

    // Load all bids for these cars (only need count, not individual bid details)
    let bidsData: any[] = [];
    if (carIds.length > 0) {
      const { data } = await supabase
        .from('bids')
        .select('car_id, user_id, amount')
        .in('car_id', carIds);

      bidsData = data || [];
    }

    // Group bids by car and count unique users
    const bidsByCar: Record<string, any[]> = {};
    bidsData.forEach(bid => {
      if (!bidsByCar[bid.car_id]) {
        bidsByCar[bid.car_id] = [];
      }
      bidsByCar[bid.car_id].push(bid);
    });

    // Create export data - one row per car with total bids
    const exportData: any[] = [];

    lotsData.forEach(lot => {
      const lotCars = carsData?.filter(c => c.lot_id === lot.id) || [];
      
      if (lotCars.length > 0) {
        // Sort cars by lot number first, then by S# (sr_number)
        const sortedCars = [...lotCars].sort((a, b) => {
          // First sort by lot number (should be same, but for safety)
          const lotA = a.lot?.lot_number || '';
          const lotB = b.lot?.lot_number || '';
          if (lotA !== lotB) {
            return lotA.localeCompare(lotB);
          }
          
          // Then sort by S# (sr_number)
          const srA = a.sr_number || '';
          const srB = b.sr_number || '';
          
          // Try numeric comparison first, fallback to string comparison
          const numA = parseFloat(String(srA));
          const numB = parseFloat(String(srB));
          
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          
          // String comparison if not numeric
          return String(srA).localeCompare(String(srB));
        });

        sortedCars.forEach(car => {
          const carBids = bidsByCar[car.id] || [];
          
          // Deduplicate bids by user_id to count unique bidders
          const bidsByUser = new Map<string, any>();
          carBids.forEach(bid => {
            const userId = bid.user_id;
            const existingBid = bidsByUser.get(userId);
            if (!existingBid || bid.amount > existingBid.amount) {
              bidsByUser.set(userId, bid);
            }
          });
          const uniqueBids = Array.from(bidsByUser.values());
          const totalBids = uniqueBids.length;
          
          // Use standard export format with only required fields + Total Bids
            const baseData = formatCarForExport(car, 0, lot.lot_number);
            exportData.push({
            'Lot#': baseData['Lot#'],
            'S#': baseData['S#'], // Uses sr_number from import sheet
            'Fleet #': baseData['Fleet #'],
            'Reg #': baseData['Reg #'],
            'Current Location': baseData['Current Location'],
            'Type / Model': baseData['Type / Model'],
            'Make': baseData['Make'],
            'Chassis #': baseData['Chassis #'],
            'Color': baseData['Color'],
            'Year': baseData['Year'],
            'KM': baseData['KM'],
            'Total Bids': totalBids,
              });
            });
          }
        });

    // Determine if lots are active or closed based on their status
    const isActiveLots = lotsData.some(lot => lot.status === 'Active' || lot.status === 'Approved');
    const isClosedLots = lotsData.some(lot => lot.status === 'Closed' || lot.status === 'Early Closed');
    
    // Use activeTab to determine, or fallback to lot status
    let sheetName = 'Lots Export';
    let filename = `lots_export_${lotIds.length}_lots_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    if (activeTab === 'active' || (isActiveLots && !isClosedLots)) {
      sheetName = 'Active Lots Export';
      filename = `active_lots_export_${lotIds.length}_lots_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else if (activeTab === 'closed' || (isClosedLots && !isActiveLots)) {
      sheetName = 'Closed Lots Export';
      filename = `closed_lots_export_${lotIds.length}_lots_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    // Export to Excel
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
    
    showSuccess(
      'Export Successful',
      `Exported ${exportData.length} vehicle(s) from ${lotIds.length} lot(s) with total bids count`
    );
    
    // Clear selections
    if (activeTab === 'active') {
      setSelectedActiveLots(new Set());
    } else {
      setSelectedClosedLots(new Set());
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-dl-grey-medium border-t-dl-red"></div>
          <p className="mt-6 text-dl-grey font-medium text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dl-grey-bg">
      <header className="bg-white border-b border-dl-grey-medium sticky top-0 z-10 shadow-dl">
        <div className="accent-bar"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Logo className="h-9 sm:h-10" />
              <div className="border-l-2 border-dl-grey-medium pl-3 ml-1">
                <h1 className="text-base sm:text-lg font-bold text-dl-grey">Business User Portal</h1>
                <p className="text-xs text-dl-grey-light hidden md:block">Used Car Team Dashboard</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-dl-red text-white hover:bg-dl-red-hover rounded-dl-sm transition-colors touch-target"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <StatCard
            icon={<Building className="w-6 h-6" />}
            title="Total Lots"
            value={stats.totalLots}
            color="bg-dl-red"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Active Lots"
            value={stats.activeLots}
            color="bg-green-600"
          />
          <StatCard
            icon={<FileText className="w-6 h-6" />}
            title="Closed Lots"
            value={stats.closedLots}
            color="bg-dl-grey"
          />
          <StatCard
            icon={<Car className="w-6 h-6" />}
            title="Total Vehicles"
            value={stats.totalCars}
            color="bg-dl-red"
          />
          <StatCard
            icon={<DollarSign className="w-6 h-6" />}
            title="Total Bids"
            value={stats.totalBids}
            color="bg-dl-yellow"
          />
        </div>

        {/* Tab Navigation */}
        <div className="card-dl mb-4 sm:mb-6">
          <div className="border-b border-dl-grey-medium">
            <nav className="flex -mb-px overflow-x-auto scrollbar-hide -mx-6 sm:mx-0 px-6 sm:px-0">
              <button
                onClick={() => {
                  setActiveTab('active');
                  setSelectedActiveLots(new Set());
                  setSelectedClosedLots(new Set());
                  setSelectedCars(new Set());
                }}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold border-b-3 transition-colors whitespace-nowrap flex-shrink-0 touch-target ${
                  activeTab === 'active'
                    ? 'border-dl-red text-dl-red'
                    : 'border-transparent text-dl-grey-light hover:text-dl-grey hover:border-dl-grey-medium'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-1 sm:mr-2" />
                Active Lots ({stats.activeLots})
              </button>
              <button
                onClick={() => {
                  setActiveTab('closed');
                  setSelectedActiveLots(new Set());
                  setSelectedClosedLots(new Set());
                  setSelectedCars(new Set());
                }}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold border-b-3 transition-colors whitespace-nowrap flex-shrink-0 touch-target ${
                  activeTab === 'closed'
                    ? 'border-dl-red text-dl-red'
                    : 'border-transparent text-dl-grey-light hover:text-dl-grey hover:border-dl-grey-medium'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-1 sm:mr-2" />
                Closed Lots({stats.closedLots})
              </button>
              <button
                onClick={() => {
                  setActiveTab('cars');
                  setSelectedActiveLots(new Set());
                  setSelectedClosedLots(new Set());
                  setSelectedCars(new Set());
                }}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold border-b-3 transition-colors whitespace-nowrap flex-shrink-0 touch-target ${
                  activeTab === 'cars'
                    ? 'border-dl-red text-dl-red'
                    : 'border-transparent text-dl-grey-light hover:text-dl-grey hover:border-dl-grey-medium'
                }`}
              >
                <Car className="w-4 h-4 inline mr-1 sm:mr-2" />
                All Cars ({stats.totalCars})
              </button>
            </nav>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {activeTab === 'active' ? 'Active Lots' : activeTab === 'closed' ? 'Closed Lots' : 'All Cars'}
                </h2>
                <p className="text-sm sm:text-base text-slate-600 mt-1">
                  {activeTab === 'active' 
                    ? 'View bidding progress for active lots' 
                    : activeTab === 'closed'
                    ? 'View bidding results and download bidded/unbidded cars for closed lots'
                    : 'View all car details with bidding information'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {activeTab === 'cars' && (
                  <>
                    {selectedCars.size > 0 && (
                      <button
                        onClick={() => setSelectedCars(new Set())}
                        className="px-3 sm:px-4 py-2 min-h-[44px] text-gray-700 hover:text-gray-900 text-sm rounded-lg border border-dl-grey-medium hover:bg-dl-grey-bg transition-colors touch-target"
                      >
                        <span className="hidden sm:inline">Clear Selection ({selectedCars.size})</span>
                        <span className="sm:hidden">Clear ({selectedCars.size})</span>
                      </button>
                    )}
                    <button
                      onClick={handleExportCars}
                      className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors text-sm touch-target"
                    >
                      <Download className="w-4 h-4 flex-shrink-0" />
                      <span className="hidden sm:inline">
                        {selectedCars.size > 0 ? `Export Selected (${selectedCars.size})` : 'Export All Cars'}
                      </span>
                      <span className="sm:hidden">Export</span>
                    </button>
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-lg transition-colors text-sm touch-target ${
                        showFilters
                          ? 'bg-dl-red text-white hover:bg-dl-red-hover'
                          : 'bg-dl-grey-bg text-slate-700 hover:bg-dl-grey-medium'
                      }`}
                    >
                      <Filter className="w-4 h-4 flex-shrink-0" />
                      <span className="hidden sm:inline">Filters</span>
                    </button>
                  </>
                )}
                {activeTab !== 'cars' && (
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-lg transition-colors text-sm touch-target ${
                      showFilters
                        ? 'bg-dl-red text-white hover:bg-dl-red-hover'
                        : 'bg-dl-grey-bg text-slate-700 hover:bg-dl-grey-medium'
                    }`}
                  >
                    <Filter className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Filters</span>
                  </button>
                )}
                {activeTab === 'active' && selectedActiveLots.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExportLotDetails(Array.from(selectedActiveLots), filteredActiveLots.filter(l => selectedActiveLots.has(l.id)))}
                      className="flex items-center gap-2 px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Export Selected ({selectedActiveLots.size})</span>
                      <span className="sm:hidden">Export ({selectedActiveLots.size})</span>
                    </button>
                    <button
                      onClick={() => setSelectedActiveLots(new Set())}
                      className="px-3 py-2 text-gray-700 hover:text-gray-900 text-sm"
                    >
                      Clear
                    </button>
                  </div>
                )}
                {activeTab === 'closed' && selectedClosedLots.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExportLotDetails(Array.from(selectedClosedLots), filteredClosedLots.filter(l => selectedClosedLots.has(l.id)))}
                      className="flex items-center gap-2 px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Export Selected ({selectedClosedLots.size})</span>
                      <span className="sm:hidden">Export ({selectedClosedLots.size})</span>
                    </button>
                    <button
                      onClick={() => setSelectedClosedLots(new Set())}
                      className="px-3 py-2 text-gray-700 hover:text-gray-900 text-sm"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeTab === 'cars' ? (
            <>
              {showFilters && (
                <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Advanced Filters</h3>
                    <button
                      onClick={clearCarFilters}
                      className="text-xs text-slate-600 hover:text-slate-900"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Lot Number</label>
                      <input
                        type="text"
                        placeholder="Search lot number..."
                        value={carFilters.lotNumber}
                        onChange={(e) => setCarFilters({ ...carFilters, lotNumber: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Make/Model</label>
                      <input
                        type="text"
                        placeholder="Search make/model..."
                        value={carFilters.makeModel}
                        onChange={(e) => setCarFilters({ ...carFilters, makeModel: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Year</label>
                      <select
                        value={carFilters.year}
                        onChange={(e) => setCarFilters({ ...carFilters, year: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      >
                        <option value="">All Years</option>
                        {uniqueCarYears.map(year => (
                          <option key={year} value={year.toString()}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Min KM</label>
                      <input
                        type="number"
                        placeholder="Min KM"
                        value={carFilters.minKm}
                        onChange={(e) => setCarFilters({ ...carFilters, minKm: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Max KM</label>
                      <input
                        type="number"
                        placeholder="Max KM"
                        value={carFilters.maxKm}
                        onChange={(e) => setCarFilters({ ...carFilters, maxKm: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
                      <input
                        type="text"
                        placeholder="Search location..."
                        value={carFilters.location}
                        onChange={(e) => setCarFilters({ ...carFilters, location: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
              {filteredCars.length === 0 ? (
                <div className="p-12 text-center">
                  <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Cars Found</h3>
                  <p className="text-gray-600">There are no cars available at the moment.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                <table className="w-full min-w-[1000px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                        <div className="flex items-center min-h-[44px]">
                          <input
                            type="checkbox"
                            checked={selectedCars.size === filteredCars.length && filteredCars.length > 0}
                            onChange={toggleSelectAllCars}
                            className="w-4 h-4 rounded border-slate-300 text-dl-red focus:ring-2 focus:ring-dl-red"
                          />
                        </div>
                      </th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap">S.No</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap">Lot #</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden sm:table-cell">Fleet #</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden sm:table-cell">Reg No</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase">Make/Model</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden md:table-cell">Chassis #</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden md:table-cell">Color</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden md:table-cell">Year</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden lg:table-cell">KM</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden lg:table-cell">Location</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap">Status</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden md:table-cell" title="Total number of bids placed">Bids</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap" title="For active cars: Total bids count. For closed cars: Highest bid amount">Bid Info</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden lg:table-cell">Bidder</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-700 uppercase whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredCars.map((car, index) => (
                      <tr key={car.id} className={`hover:bg-slate-50 transition-colors ${selectedCars.has(car.id) ? 'bg-dl-grey-bg' : ''}`}>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <div className="flex items-center min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={selectedCars.has(car.id)}
                              onChange={() => toggleCarSelection(car.id)}
                              className="w-4 h-4 rounded border-slate-300 text-dl-red focus:ring-2 focus:ring-dl-red"
                            />
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-900">{index + 1}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-slate-900">{car.lot_number}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-slate-900 hidden sm:table-cell">{car.fleet_no || '-'}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-slate-900 hidden sm:table-cell">{car.reg_no || '-'}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-900">
                          <div className="break-words max-w-[250px]">{car.make_model}</div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden md:table-cell">{car.chassis_no || '-'}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden md:table-cell">{car.color || '-'}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden md:table-cell">{car.year || '-'}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden lg:table-cell">{car.km?.toLocaleString() || '-'}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden lg:table-cell">{car.location || car.current_location || '-'}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md border ${
                            car.status === 'Active' ? 'bg-green-100 text-green-800 border-green-200' :
                            car.status === 'Closed' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                            car.status === 'Upcoming' ? 'bg-dl-grey-bg text-dl-red border-dl-grey-medium' :
                            'bg-slate-100 text-slate-800 border-slate-200'
                          }`}>
                            {car.status}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden md:table-cell">{car.total_bids || 0}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold">
                          {(car.status === 'Active' || car.status === 'Approved' || car.status === 'Upcoming' || car.is_active) ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center justify-center px-2 py-1 bg-amber-50 border border-amber-200 rounded-md">
                                <EyeOff className="w-3 h-3 text-amber-600" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-green-600">{car.highest_bid ? `${car.highest_bid.toLocaleString()}` : '-'}</span>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden lg:table-cell">
                          {(car.status === 'Active' || car.status === 'Approved' || car.status === 'Upcoming' || car.is_active) ? (
                            <div className="flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-xs text-slate-500 font-medium">Protected</span>
                            </div>
                          ) : (
                            <span className="break-words whitespace-normal">{car.highest_bidder || '-'}</span>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <div className="flex items-center justify-center gap-1 sm:gap-2">
                            <button
                              onClick={() => setSelectedCar(car)}
                              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 min-h-[44px] bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors text-xs touch-target"
                              title="View Bidding Details"
                            >
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          ) : activeTab === 'active' ? (
            <>
              {showFilters && (
                <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Advanced Filters</h3>
                    <button
                      onClick={clearLotFilters}
                      className="text-xs text-slate-600 hover:text-slate-900"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                      <select
                        value={lotFilters.status}
                        onChange={(e) => setLotFilters({ ...lotFilters, status: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      >
                        <option value="All">All Status</option>
                        <option value="Active">Active</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Lot Number</label>
                      <input
                        type="text"
                        placeholder="Search lot number..."
                        value={lotFilters.lotNumber}
                        onChange={(e) => setLotFilters({ ...lotFilters, lotNumber: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Bidding Start Date From</label>
                      <input
                        type="date"
                        value={lotFilters.startDateFrom}
                        onChange={(e) => setLotFilters({ ...lotFilters, startDateFrom: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Bidding Start Date To</label>
                      <input
                        type="date"
                        value={lotFilters.startDateTo}
                        onChange={(e) => setLotFilters({ ...lotFilters, startDateTo: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
              {filteredActiveLots.length === 0 ? (
              <div className="p-12 text-center">
                <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Lots</h3>
                <p className="text-gray-600">There are no active lots at the moment. Active lots will appear here once bidding starts.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                        <button
                          onClick={toggleSelectAllActiveLots}
                          className="p-1 sm:p-2 hover:bg-gray-200 rounded min-h-[44px] flex items-center touch-target"
                          aria-label="Select all"
                        >
                          {selectedActiveLots.size === filteredActiveLots.length && filteredActiveLots.length > 0 ? (
                            <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-dl-red" />
                          ) : (
                            <Square className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap">Lot #</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden md:table-cell">Start Date</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden lg:table-cell">End Date</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap">Vehicles</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden md:table-cell">Bids</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden sm:table-cell">Status</th>
                      {/* Actions column removed for active lots */}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredActiveLots.map((lot) => (
                      <tr key={lot.id} className={`hover:bg-slate-50 transition-colors ${selectedActiveLots.has(lot.id) ? 'bg-dl-grey-bg' : ''}`}>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <button
                            onClick={() => toggleActiveLotSelection(lot.id)}
                            className="p-1 sm:p-2 hover:bg-gray-200 rounded min-h-[44px] flex items-center touch-target"
                            aria-label="Select lot"
                          >
                            {selectedActiveLots.has(lot.id) ? (
                              <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-dl-red" />
                            ) : (
                              <Square className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-slate-900">{lot.lot_number}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden md:table-cell">
                          {lot.bidding_start_date ? formatDate(lot.bidding_start_date) : '-'}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden lg:table-cell">
                          {lot.bidding_end_date ? formatDate(lot.bidding_end_date) : '-'}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600">{lot.totalCars || 0}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden md:table-cell">{lot.totalBids || 0}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 hidden sm:table-cell">
                          <span className="inline-flex px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">
                            {lot.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </>
          ) : (
            <>
              {showFilters && (
                <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Advanced Filters</h3>
                    <button
                      onClick={clearLotFilters}
                      className="text-xs text-slate-600 hover:text-slate-900"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                      <select
                        value={lotFilters.status}
                        onChange={(e) => setLotFilters({ ...lotFilters, status: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      >
                        <option value="All">All Status</option>
                        <option value="Closed">Closed</option>
                        <option value="Early Closed">Early Closed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Lot Number</label>
                      <input
                        type="text"
                        placeholder="Search lot number..."
                        value={lotFilters.lotNumber}
                        onChange={(e) => setLotFilters({ ...lotFilters, lotNumber: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Bidding Start Date From</label>
                      <input
                        type="date"
                        value={lotFilters.startDateFrom}
                        onChange={(e) => setLotFilters({ ...lotFilters, startDateFrom: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Bidding Start Date To</label>
                      <input
                        type="date"
                        value={lotFilters.startDateTo}
                        onChange={(e) => setLotFilters({ ...lotFilters, startDateTo: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
              {filteredClosedLots.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Closed Lots</h3>
                <p className="text-gray-600">There are no closed lots available yet. Closed lots will appear here once bidding periods end.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                        <button
                          onClick={toggleSelectAllClosedLots}
                          className="p-1 sm:p-2 hover:bg-gray-200 rounded min-h-[44px] flex items-center touch-target"
                          aria-label="Select all"
                        >
                          {selectedClosedLots.size === filteredClosedLots.length && filteredClosedLots.length > 0 ? (
                            <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-dl-red" />
                          ) : (
                            <Square className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap">Lot #</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden md:table-cell">Start Date</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap">Status</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap hidden sm:table-cell">Closed Date</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-700 uppercase whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredClosedLots.map((lot) => (
                      <tr key={lot.id} className={`hover:bg-slate-50 transition-colors ${selectedClosedLots.has(lot.id) ? 'bg-dl-grey-bg' : ''}`}>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <button
                            onClick={() => toggleClosedLotSelection(lot.id)}
                            className="p-1 sm:p-2 hover:bg-gray-200 rounded min-h-[44px] flex items-center touch-target"
                            aria-label="Select lot"
                          >
                            {selectedClosedLots.has(lot.id) ? (
                              <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-dl-red" />
                            ) : (
                              <Square className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-slate-900">{lot.lot_number}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden md:table-cell">
                          {lot.bidding_start_date ? formatDate(lot.bidding_start_date) : '-'}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md ${
                            lot.status === 'Early Closed'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}>
                            {lot.status}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 hidden sm:table-cell">
                          {lot.early_closed_at || lot.bidding_end_date
                            ? formatDate(lot.early_closed_at || lot.bidding_end_date)
                            : '-'}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                            <button
                              onClick={() => setSelectedClosedLot(lot)}
                              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 min-h-[44px] bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors text-xs sm:text-sm touch-target"
                            >
                              <FileText className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="hidden sm:inline">View Details</span>
                              <span className="sm:hidden">View</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </>
          )}
        </div>
      </main>

      {selectedLot && (
        <LotBiddingResults
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
        />
      )}

      {selectedClosedLot && (
        <ClosedLotDetailsModal
          lot={selectedClosedLot}
          onClose={() => setSelectedClosedLot(null)}
        />
      )}

      {selectedCar && (
        <CarBiddingDetailsModal
          car={selectedCar}
          onClose={() => setSelectedCar(null)}
        />
      )}
    </div>
  );
}

function StatCard({ icon, title, value, color }: { icon: React.ReactNode; title: string; value: number; color: string }) {
  return (
    <div className="card-dl hover:shadow-dl-lg transition-shadow duration-200">
      <div className="flex items-center gap-4">
        <div className={`${color} text-white p-3 rounded-dl flex-shrink-0 shadow-md`}>
          <div className="w-7 h-7">{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-dl-grey-light text-sm font-medium truncate mb-1">{title}</p>
          <p className="text-3xl sm:text-4xl font-bold text-dl-grey">{value}</p>
        </div>
      </div>
    </div>
  );
}


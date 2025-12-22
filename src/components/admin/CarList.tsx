import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Filter, Download, X as XIcon } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { BulkActionsPanel } from './BulkActionsPanel';
import { CarTable } from './CarTable';
import * as XLSX from 'xlsx';
import { formatCarForExport } from '../../utils/carExportFormatter';

export function CarList({ onDataChange }: { onDataChange: () => void }) {
  const [cars, setCars] = useState<any[]>([]);
  const [filteredCars, setFilteredCars] = useState<any[]>([]);
  const [selectedCars, setSelectedCars] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { showSuccess, showWarning } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    lotNumber: '',
    makeModel: '',
    year: '',
    minKm: '',
    maxKm: '',
    location: '',
  });

  // Create a stable filter key to detect filter changes
  const filterKey = useMemo(() => {
    return `${searchTerm}|${statusFilter}|${advancedFilters.lotNumber}|${advancedFilters.makeModel}|${advancedFilters.year}|${advancedFilters.minKm}|${advancedFilters.maxKm}|${advancedFilters.location}`;
  }, [searchTerm, statusFilter, advancedFilters]);

  // Track previous filter key to detect changes
  const prevFilterKeyRef = useRef<string>('');

  useEffect(() => {
    loadCars();
    
    // Listen for lot deletion and approval events to refresh car list
    const handleLotDeleted = () => {
      loadCars();
    };
    
    const handleLotApproved = () => {
      loadCars();
    };
    
    window.addEventListener('lotDeleted', handleLotDeleted);
    window.addEventListener('lotApproved', handleLotApproved);
    
    return () => {
      window.removeEventListener('lotDeleted', handleLotDeleted);
      window.removeEventListener('lotApproved', handleLotApproved);
    };
  }, []);

  useEffect(() => {
    filterCars();
  }, [cars, searchTerm, statusFilter, advancedFilters]);

  // Clear selection when filters change (but not on initial mount)
  useEffect(() => {
    // Only clear if filters actually changed (not on initial mount)
    if (prevFilterKeyRef.current !== '' && prevFilterKeyRef.current !== filterKey) {
      setSelectedCars(new Set());
    }
    // Update the ref for next comparison
    prevFilterKeyRef.current = filterKey;
  }, [filterKey]);

  const loadCars = async () => {
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
    
      // Load all cars with their lot information
      const { data: carsData, error: carsError } = await supabase
      .from('cars')
      .select('*, lot:lots(id, approved, lot_number, status)')
      .order('created_at', { ascending: false });

      if (carsError) {
        console.error('Error loading cars:', carsError);
        showWarning('Error', `Failed to load cars: ${carsError.message}`);
        setCars([]);
        return;
      }

      if (carsData) {
        // Admin should only see cars from approved lots
        const filteredCarsData = carsData.filter(car => car.lot?.approved === true);

        // Load bids for all cars
        const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select('car_id, amount');

        if (bidsError) {
          console.error('Error loading bids:', bidsError);
          // Continue without bids data
        }

      const carsWithBids = filteredCarsData.map(car => {
        const carBids = bidsData?.filter(bid => bid.car_id === car.id) || [];
        const highestBid = carBids.length > 0 ? Math.max(...carBids.map(b => b.amount)) : null;
        return {
          ...car,
          highest_bid: highestBid,
          highest_bid_count: carBids.length
        };
      });

      setCars(carsWithBids);
      } else {
        setCars([]);
    }
    } catch (error) {
      console.error('Unexpected error loading cars:', error);
      showWarning('Error', 'An unexpected error occurred while loading cars.');
      setCars([]);
    } finally {
    setLoading(false);
    }
  };

  const filterCars = () => {
    let filtered = [...cars];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(car =>
        car.make_model?.toLowerCase().includes(term) ||
        car.reg_no?.toLowerCase().includes(term) ||
        car.location?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter(car => car.status === statusFilter);
    }

    // Advanced filters
    if (advancedFilters.lotNumber) {
      filtered = filtered.filter(car =>
        car.lot?.lot_number?.toLowerCase().includes(advancedFilters.lotNumber.toLowerCase())
      );
    }
    if (advancedFilters.makeModel) {
      filtered = filtered.filter(car =>
        car.make_model?.toLowerCase().includes(advancedFilters.makeModel.toLowerCase())
      );
    }
    if (advancedFilters.year) {
      filtered = filtered.filter(car => car.year?.toString() === advancedFilters.year);
    }
    if (advancedFilters.minKm) {
      filtered = filtered.filter(car => (car.km || 0) >= parseInt(advancedFilters.minKm));
    }
    if (advancedFilters.maxKm) {
      filtered = filtered.filter(car => (car.km || 0) <= parseInt(advancedFilters.maxKm));
    }
    if (advancedFilters.location) {
      filtered = filtered.filter(car =>
        car.location?.toLowerCase().includes(advancedFilters.location.toLowerCase())
      );
    }

    setFilteredCars(filtered);
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      lotNumber: '',
      makeModel: '',
      year: '',
      minKm: '',
      maxKm: '',
      location: '',
    });
  };

  const uniqueYears = useMemo(() => {
    const years = new Set<number>();
    cars.forEach(car => {
      if (car.year) years.add(car.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [cars]);

  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>();
    cars.forEach(car => {
      if (car.location) locations.add(car.location);
    });
    return Array.from(locations).sort();
  }, [cars]);

  const handleSelectAll = () => {
    if (selectedCars.size === filteredCars.length) {
      setSelectedCars(new Set());
    } else {
      setSelectedCars(new Set(filteredCars.map(car => car.id)));
    }
  };

  const handleSelectCar = (carId: string) => {
    const newSelected = new Set(selectedCars);
    if (newSelected.has(carId)) {
      newSelected.delete(carId);
    } else {
      newSelected.add(carId);
    }
    setSelectedCars(newSelected);
  };

  const handleBulkUpdate = async () => {
    await loadCars();
    setSelectedCars(new Set());
    onDataChange();
  };

  const handleExportBiddingDetails = async () => {
    if (selectedCars.size === 0) {
      showWarning('No Selection', 'Please select at least one car to export');
      return;
    }

    const selectedCarIds = Array.from(selectedCars);
    const selectedCarsData = filteredCars.filter(c => selectedCarIds.includes(c.id));

    // Load all bids for selected cars with user information
    const { data: bidsData } = await supabase
      .from('bids')
      .select(`
        *,
        users (name, email, phone),
        cars (id, make_model, reg_no, lot:lots(lot_number))
      `)
      .in('car_id', selectedCarIds)
      .order('created_at', { ascending: false });

    // Group bids by car
    const bidsByCar: Record<string, any[]> = {};
    bidsData?.forEach(bid => {
      if (!bidsByCar[bid.car_id]) {
        bidsByCar[bid.car_id] = [];
      }
      bidsByCar[bid.car_id].push(bid);
    });

    // Create export data with all bidding details using standard format
    const exportData: any[] = [];
    let carIndex = 0;
    
    selectedCarsData.forEach(car => {
      const carBids = bidsByCar[car.id] || [];
      
      if (carBids.length === 0) {
        // Export car info even if no bids - use standard format
        const baseData = formatCarForExport(car, carIndex, car.lot?.lot_number);
        exportData.push({
          ...baseData,
          'Bidder Name': '-',
          'Bidder Email': '-',
          'Bidder Phone': '-',
          'Bid Date': '-',
          'Total Bids': 0,
        });
      } else {
        // Export each bid as a separate row - use standard format
        carBids.forEach((bid, bidIndex) => {
          const baseData = formatCarForExport(car, carIndex, car.lot?.lot_number);
          exportData.push({
            ...baseData,
            'Bidder Name': bid.users?.name || '-',
            'Bidder Email': bid.users?.email || '-',
            'Bidder Phone': bid.users?.phone || '-',
            'Bid Date': new Date(bid.created_at).toLocaleString(),
            'Total Bids': carBids.length,
          });
        });
      }
      carIndex++;
    });

    // Export to Excel
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bidding Details');
    XLSX.writeFile(wb, `bidding_details_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showSuccess(
      'Export Successful',
      `Exported bidding details for ${selectedCars.size} car(s) with ${exportData.length} bid record(s)`
    );
  };


  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Car Inventory</h2>
            <p className="text-sm sm:text-base text-slate-600 mt-1">View and manage all vehicles</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by make/model, reg no, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>
          </div>

          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent appearance-none"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Closed">Closed</option>
                <option value="Disabled">Disabled</option>
                <option value="Reopened">Reopened</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showFilters
                ? 'bg-dl-red text-white hover:bg-dl-red-hover'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Advanced</span>
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Advanced Filters</h3>
              <button
                onClick={clearAdvancedFilters}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Lot Number</label>
                <input
                  type="text"
                  placeholder="Search lot number..."
                  value={advancedFilters.lotNumber}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, lotNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Make/Model</label>
                <input
                  type="text"
                  placeholder="Search make/model..."
                  value={advancedFilters.makeModel}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, makeModel: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Year</label>
                <select
                  value={advancedFilters.year}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, year: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                >
                  <option value="">All Years</option>
                  {uniqueYears.map(year => (
                    <option key={year} value={year.toString()}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
                <select
                  value={advancedFilters.location}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, location: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                >
                  <option value="">All Locations</option>
                  {uniqueLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Min KM</label>
                <input
                  type="number"
                  placeholder="Min KM"
                  value={advancedFilters.minKm}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, minKm: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Max KM</label>
                <input
                  type="number"
                  placeholder="Max KM"
                  value={advancedFilters.maxKm}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, maxKm: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedCars.size > 0 && (
        <>
          <div className="bg-green-50 border-b border-green-200 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-medium text-green-900">
                  {selectedCars.size} car{selectedCars.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportBiddingDetails}
                  className="flex items-center gap-2 px-4 py-2 bg-dl-grey-bg text-dl-grey border-2 border-dl-grey-medium hover:bg-dl-grey-light hover:text-white hover:border-dl-grey rounded-lg transition-all duration-200 text-sm font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Export Bidding Details
                </button>
                <button
                  onClick={() => setSelectedCars(new Set())}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
          <BulkActionsPanel
            selectedCount={selectedCars.size}
            selectedCarIds={Array.from(selectedCars)}
            onUpdate={handleBulkUpdate}
            onClear={() => setSelectedCars(new Set())}
          />
        </>
      )}

      <CarTable
        cars={filteredCars}
        selectedCars={selectedCars}
        onSelectAll={handleSelectAll}
        onSelectCar={handleSelectCar}
        loading={loading}
        onUpdate={loadCars}
      />

    </div>
  );
}

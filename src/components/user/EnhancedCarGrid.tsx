import { useState, useEffect, useMemo, useRef } from 'react';
import { MapPin, Gauge, Calendar, TrendingUp, Clock, Filter, Grid, List, CheckSquare, Square, Download, Upload, X, Menu, CheckCircle2 } from 'lucide-react';
import { CarDetailModal } from './CarDetailModal';
import { MobileCarCard } from './MobileCarCard';
import { MobileFilterPanel } from './MobileFilterPanel';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import * as XLSX from 'xlsx';

interface EnhancedCarGridProps {
  cars: any[];
  onBidPlaced: () => void;
  // Expose state for parent control
  onViewModeChange?: (mode: 'tile' | 'list') => void;
  onFilterToggle?: () => void;
  onSelectAllToggle?: () => void;
  onImportBidsClick?: () => void;
  onSelectionChange?: (selectedCount: number, totalCount: number) => void;
  externalViewMode?: 'tile' | 'list';
  externalShowFilters?: boolean;
}

type ViewMode = 'tile' | 'list';

export function EnhancedCarGrid({ 
  cars, 
  onBidPlaced,
  externalViewMode,
  externalShowFilters,
  onViewModeChange,
  onFilterToggle,
  onSelectAllToggle,
  onImportBidsClick,
  onSelectionChange
}: EnhancedCarGridProps) {
  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('tile');
  const [selectedCars, setSelectedCars] = useState<Set<string>>(new Set());
  const [internalShowFilters, setInternalShowFilters] = useState(false);
  const [showBulkBidModal, setShowBulkBidModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const selectionStorageKey = 'bulk_selected_car_ids';
  const bulkModalStorageKey = 'bulk_modal_open';

  // Use external state if provided, otherwise use internal state
  const viewMode = externalViewMode !== undefined ? externalViewMode : internalViewMode;
  const showFilters = externalShowFilters !== undefined ? externalShowFilters : internalShowFilters;
  
  const setViewMode = (mode: ViewMode) => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };
  
  const setShowFilters = (show: boolean) => {
    if (onFilterToggle && show !== showFilters) {
      onFilterToggle();
    } else {
      setInternalShowFilters(show);
    }
  };

  // Handle external import modal trigger
  useEffect(() => {
    const handleOpenImportModal = () => {
      setShowImportModal(true);
    };
    window.addEventListener('openImportModal', handleOpenImportModal);
    return () => {
      window.removeEventListener('openImportModal', handleOpenImportModal);
    };
  }, []);
  const [userBids, setUserBids] = useState<Record<string, number>>({});
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useNotification();

  // Filter states
  const [filters, setFilters] = useState({
    location: '',
    makeModel: '',
    year: '',
    minKm: '',
    maxKm: '',
    chassisNo: '',
    regNo: '',
    fleetNo: '',
    lotNumber: '',
    color: '',
    bodyType: '',
  });

  // Create a stable filter key to detect filter changes
  const filterKey = useMemo(() => {
    return `${filters.location}|${filters.makeModel}|${filters.year}|${filters.minKm}|${filters.maxKm}|${filters.chassisNo}|${filters.regNo}|${filters.fleetNo}|${filters.lotNumber}|${filters.color}|${filters.bodyType}`;
  }, [filters]);

  // Track previous filter key to detect changes
  const prevFilterKeyRef = useRef<string>('');

  useEffect(() => {
    loadUserBids();
  }, [cars, user]);

  // Restore selection (and modal state) when returning to this tab/session
  useEffect(() => {
    const savedSelection = sessionStorage.getItem(selectionStorageKey);
    if (savedSelection) {
      try {
        const ids: string[] = JSON.parse(savedSelection);
        const availableIds = new Set(cars.map(c => c.id));
        const validIds = ids.filter(id => availableIds.has(id));
        if (validIds.length > 0) {
          setSelectedCars(new Set(validIds));
          // Restore modal open state only if we still have valid selections
          const savedModal = sessionStorage.getItem(bulkModalStorageKey);
          if (savedModal === 'true') {
            setShowBulkBidModal(true);
          }
        } else {
          sessionStorage.removeItem(selectionStorageKey);
          sessionStorage.removeItem(bulkModalStorageKey);
        }
      } catch {
        sessionStorage.removeItem(selectionStorageKey);
        sessionStorage.removeItem(bulkModalStorageKey);
      }
    }
  }, [cars]);

  // Clear selection when filters change (but not on initial mount)
  useEffect(() => {
    // Only clear if filters actually changed (not on initial mount)
    if (prevFilterKeyRef.current !== '' && prevFilterKeyRef.current !== filterKey) {
      setSelectedCars(new Set());
    }
    // Update the ref for next comparison
    prevFilterKeyRef.current = filterKey;
  }, [filterKey]);

  // Persist selection and modal state
  useEffect(() => {
    if (selectedCars.size > 0) {
      sessionStorage.setItem(selectionStorageKey, JSON.stringify(Array.from(selectedCars)));
    } else {
      sessionStorage.removeItem(selectionStorageKey);
      sessionStorage.removeItem(bulkModalStorageKey);
    }
  }, [selectedCars]);

  useEffect(() => {
    if (showBulkBidModal) {
      sessionStorage.setItem(bulkModalStorageKey, 'true');
    } else {
      sessionStorage.removeItem(bulkModalStorageKey);
    }
  }, [showBulkBidModal]);

  const loadUserBids = async () => {
    if (!user) return;
    
    const carIds = cars.map(c => c.id);
    if (carIds.length === 0) {
      setUserBids({});
      return;
    }

    // Get only the most recent bid per car for this user
    // Since we update existing bids, there should only be one bid per user per car
    const { data } = await supabase
      .from('bids')
      .select('car_id, amount, created_at')
      .in('car_id', carIds)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      const bids: Record<string, number> = {};
      // Get latest bid per car for the user (most recent)
      // Only one bid per user per car should exist
      data.forEach(bid => {
        // Only set if we haven't seen this car_id yet (since data is ordered by created_at desc)
        // This ensures we only show the current bid, not previous ones
        if (!bids[bid.car_id]) {
          bids[bid.car_id] = bid.amount;
        }
      });
      setUserBids(bids);
    } else {
      // No bids found, clear the user bids
      setUserBids({});
    }
  };

  // Filter cars based on filter criteria
  const filteredCars = useMemo(() => {
    return cars.filter(car => {
      if (filters.location && !car.location?.toLowerCase().includes(filters.location.toLowerCase())) {
        return false;
      }
      if (filters.makeModel && !car.make_model?.toLowerCase().includes(filters.makeModel.toLowerCase())) {
        return false;
      }
      if (filters.year && car.year?.toString() !== filters.year) {
        return false;
      }
      if (filters.minKm && (car.km || 0) < parseInt(filters.minKm)) {
        return false;
      }
      if (filters.maxKm && (car.km || 0) > parseInt(filters.maxKm)) {
        return false;
      }
      // Chassis # filter (most important)
      if (filters.chassisNo && !(car.chassis_no || '').toLowerCase().includes(filters.chassisNo.toLowerCase())) {
        return false;
      }
      // Registration # filter
      if (filters.regNo && !(car.reg_no || '').toLowerCase().includes(filters.regNo.toLowerCase())) {
        return false;
      }
      // Fleet # filter
      if (filters.fleetNo && !(car.fleet_no || '').toLowerCase().includes(filters.fleetNo.toLowerCase())) {
        return false;
      }
      // Lot # filter
      if (filters.lotNumber) {
        const carLotNumber = (car.lot?.lot_number || car.lot_number || '').toLowerCase();
        if (!carLotNumber.includes(filters.lotNumber.toLowerCase())) {
        return false;
      }
      }
      // Color filter
      if (filters.color && !(car.color || '').toLowerCase().includes(filters.color.toLowerCase())) {
        return false;
      }
      // Body type filter
      if (filters.bodyType && (car.body_type || '').toLowerCase() !== filters.bodyType.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [cars, filters]);

  // Get unique values for filter dropdowns
  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>();
    cars.forEach(car => {
      if (car.location) locations.add(car.location);
    });
    return Array.from(locations).sort();
  }, [cars]);

  const uniqueLotNumbers = useMemo(() => {
    const lotNumbers = new Set<string>();
    cars.forEach(car => {
      const lotNumber = car.lot?.lot_number || car.lot_number;
      if (lotNumber) lotNumbers.add(lotNumber);
    });
    return Array.from(lotNumbers).sort();
  }, [cars]);

  const uniqueMakeModels = useMemo(() => {
    const makeModels = new Set<string>();
    cars.forEach(car => {
      if (car.make_model) makeModels.add(car.make_model);
    });
    return Array.from(makeModels).sort();
  }, [cars]);

  const uniqueYears = useMemo(() => {
    const years = new Set<number>();
    cars.forEach(car => {
      if (car.year) years.add(car.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [cars]);

  const uniqueBodyTypes = useMemo(() => {
    const bodyTypes = new Set<string>();
    cars.forEach(car => {
      if (car.body_type) bodyTypes.add(car.body_type);
    });
    return Array.from(bodyTypes).sort();
  }, [cars]);

  const uniqueColors = useMemo(() => {
    const colors = new Set<string>();
    cars.forEach(car => {
      if (car.color) colors.add(car.color);
    });
    return Array.from(colors).sort();
  }, [cars]);

  const toggleCarSelection = (carId: string) => {
    const newSelected = new Set(selectedCars);
    if (newSelected.has(carId)) {
      newSelected.delete(carId);
    } else {
      newSelected.add(carId);
    }
    setSelectedCars(newSelected);
    // Notify parent of selection change
    if (onSelectionChange) {
      onSelectionChange(newSelected.size, filteredCars.length);
    }
  };

  const toggleSelectAll = () => {
    const newSelected = selectedCars.size === filteredCars.length 
      ? new Set() 
      : new Set(filteredCars.map(c => c.id));
    setSelectedCars(newSelected);
    // Notify parent of selection change
    if (onSelectionChange) {
      onSelectionChange(newSelected.size, filteredCars.length);
    }
  };

  // Handle external select all toggle from banner
  useEffect(() => {
    const handleSelectAllToggle = () => {
      // Inline the logic to avoid closure issues
      setSelectedCars(prevSelected => {
        const newSelected = prevSelected.size === filteredCars.length && filteredCars.length > 0
          ? new Set()
          : new Set(filteredCars.map(c => c.id));
        // Notify parent of selection change
        if (onSelectionChange) {
          onSelectionChange(newSelected.size, filteredCars.length);
        }
        return newSelected;
      });
    };
    window.addEventListener('selectAllToggle', handleSelectAllToggle);
    return () => {
      window.removeEventListener('selectAllToggle', handleSelectAllToggle);
    };
  }, [filteredCars, onSelectionChange]); // Include onSelectionChange in dependencies

  // Notify parent when selection or filtered cars change
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedCars.size, filteredCars.length);
    }
  }, [selectedCars.size, filteredCars.length, onSelectionChange]);

  const clearFilters = () => {
    setFilters({
      location: '',
      makeModel: '',
      year: '',
      minKm: '',
      maxKm: '',
      chassisNo: '',
      regNo: '',
      fleetNo: '',
      lotNumber: '',
      color: '',
      bodyType: '',
    });
  };

  const getTimeRemaining = (endDate: string) => {
    const now = new Date().getTime();
    const end = new Date(endDate).getTime();
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const handleExportToExcel = () => {
    const selectedCarsData = filteredCars.filter(c => selectedCars.has(c.id));
    
    if (selectedCarsData.length === 0) {
      showWarning('No Selection', 'Please select at least one car to export');
      return;
    }

    // Use standard export format, then add Bid Amount column for user to fill
    const exportData = selectedCarsData.map((car, index) => {
      const baseData = formatCarForExport(car, index, car.lot?.lot_number);
      return {
        ...baseData,
      'Bid Amount': '', // Empty for user to fill
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cars');
    XLSX.writeFile(wb, `cars_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    setShowExportModal(false);
    showSuccess(
      'Export Successful',
      `Exported ${selectedCarsData.length} car(s) to Excel. Please add bid amounts and import back.`
    );
  };

  const handleImportBids = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!user) {
          showError('Authentication Required', 'You must be logged in to import bids');
          return;
        }

        const bidsToSubmit: Array<{ car_id: string; amount: number }> = [];
        const errors: string[] = [];

        for (const row of jsonData as any[]) {
          const carId = row['Car ID'] || row['car_id'] || row['Car ID'] || row['carId'];
          const bidAmount = row['Bid Amount'] || row['bid_amount'] || row['Bid Amount'] || row['bidAmount'];

          if (!carId) {
            errors.push(`Row missing Car ID: ${JSON.stringify(row)}`);
            continue;
          }

          if (!bidAmount || isNaN(parseFloat(bidAmount))) {
            errors.push(`Row missing or invalid bid amount for Car ID ${carId}`);
            continue;
          }

          const amount = parseFloat(bidAmount);
          if (amount <= 0) {
            errors.push(`Invalid bid amount ${amount} for Car ID ${carId}`);
            continue;
          }

          // Check if car exists and bidding is still open
          const car = cars.find(c => c.id === carId);
          if (!car) {
            errors.push(`Car not found: ${carId}`);
            continue;
          }

          const now = new Date().getTime();
          const endTime = new Date(car.bidding_end_date).getTime();
          if (now > endTime) {
            errors.push(`Bidding closed for car: ${car.make_model}`);
            continue;
          }

          bidsToSubmit.push({ car_id: carId, amount });
        }

        if (bidsToSubmit.length === 0) {
          showWarning('No Valid Bids', 'No valid bids to submit. Please check your Excel file.');
          return;
        }

        // Submit all bids - ensure only one bid per user per car
        for (const bid of bidsToSubmit) {
          // Delete ALL existing bids for this user on this car first (ensures only one bid exists)
          const { error: deleteError } = await supabase
            .from('bids')
            .delete()
            .eq('car_id', bid.car_id)
            .eq('user_id', user.id);

          if (deleteError) {
            showError('Submission Failed', `Error clearing existing bids: ${deleteError.message}`);
            return;
          }

          // Insert new bid (only one bid per user per car)
          const { error: insertError } = await supabase.from('bids').insert({
            car_id: bid.car_id,
            user_id: user.id,
            amount: bid.amount,
          });

          if (insertError) {
            showError('Submission Failed', `Error submitting bid: ${insertError.message}`);
          return;
          }
        }

        if (errors.length > 0) {
          showWarning(
            'Partial Success',
            `Submitted ${bidsToSubmit.length} bid(s) successfully. ${errors.length} error(s) occurred:\n${errors.slice(0, 5).join('\n')}`
          );
        } else {
          showSuccess('Bids Submitted', `Successfully submitted ${bidsToSubmit.length} bid(s)!`);
        }

        setShowImportModal(false);
        loadUserBids();
        onBidPlaced();
      } catch (err: any) {
        showError('Import Failed', `Error importing file: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <>
      {/* MOBILE TOOLBAR */}
      <div className="lg:hidden mb-6 space-y-3">
        {/* Mobile: Filter & View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-primary flex-1 flex items-center justify-center gap-2 touch-target"
          >
            <Filter className="w-5 h-5" />
            <span>Filters</span>
              {Object.values(filters).some(v => v !== '' && v !== null && v !== undefined) && (
                <span className="bg-white text-dl-red rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">!</span>
              )}
          </button>

          {/* View Mode Toggle for Mobile */}
          <div className="flex items-center gap-0 border-2 border-dl-grey-medium rounded-dl-sm overflow-hidden">
            <button
              onClick={() => setViewMode('tile')}
              className={`p-2 transition-colors touch-target ${
                viewMode === 'tile' ? 'bg-dl-red text-white' : 'bg-white text-dl-grey'
              }`}
              title="Grid View"
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors touch-target ${
                viewMode === 'list' ? 'bg-dl-red text-white' : 'bg-white text-dl-grey'
              }`}
              title="List View"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile: Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleSelectAll}
            className="btn-secondary flex items-center gap-2 text-sm touch-target flex-1"
          >
            {selectedCars.size === filteredCars.length && filteredCars.length > 0 ? (
              <>
                <CheckSquare className="w-5 h-5" />
                <span>Deselect</span>
              </>
            ) : (
              <>
                <Square className="w-5 h-5" />
                <span>Select All</span>
              </>
            )}
          </button>

          {selectedCars.size > 0 && (
            <>
              <button
                onClick={() => setShowExportModal(true)}
                className="bg-dl-red text-white p-2 rounded-dl-sm hover:bg-dl-red-hover transition-colors touch-target"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => setSelectedCars(new Set())}
                className="bg-dl-grey-medium text-dl-grey px-3 py-2 rounded-dl-sm hover:bg-dl-grey-light hover:text-white transition-colors text-sm font-semibold touch-target"
              >
                Clear
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => setShowImportModal(true)}
          className="bg-dl-red text-white w-full py-2 rounded-dl-sm hover:bg-dl-red-hover transition-colors flex items-center justify-center gap-2 font-semibold touch-target"
        >
          <Upload className="w-5 h-5" />
          <span>Import Bids from Excel</span>
        </button>

        {/* Mobile: Results Count */}
        <div className="text-sm text-dl-grey-light font-medium text-center">
          Showing {filteredCars.length} of {cars.length} cars
          {selectedCars.size > 0 && ` • ${selectedCars.size} selected`}
        </div>
      </div>

      {/* DESKTOP TOOLBAR - Hidden since controls are in banner */}
      {externalViewMode === undefined && externalShowFilters === undefined && (
        <div className="hidden lg:block mb-6 space-y-4">
          {/* Desktop: Top Row - Filters, View Toggle, Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn-primary flex items-center gap-2 ${
                  Object.values(filters).some(v => v !== '' && v !== null && v !== undefined) ? 'ring-2 ring-dl-red' : ''
                }`}
              >
                <Filter className="w-5 h-5" />
                <span>Filters</span>
                {Object.values(filters).some(v => v !== '' && v !== null && v !== undefined) && (
                  <span className="bg-white text-dl-red rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">!</span>
                )}
              </button>

              <button
                onClick={toggleSelectAll}
                className="btn-secondary flex items-center gap-2"
              >
                {selectedCars.size === filteredCars.length && filteredCars.length > 0 ? (
                  <>
                    <CheckSquare className="w-5 h-5" />
                    <span>Deselect All ({selectedCars.size})</span>
                  </>
                ) : (
                  <>
                    <Square className="w-5 h-5" />
                    <span>Select All</span>
                  </>
                )}
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-0 border-2 border-dl-grey-medium rounded-dl-sm overflow-hidden">
                <button
                  onClick={() => setViewMode('tile')}
                  className={`px-4 py-2 transition-colors ${
                    viewMode === 'tile' ? 'bg-dl-red text-white' : 'bg-white text-dl-grey hover:bg-dl-grey-bg'
                  }`}
                  title="Grid View"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 transition-colors ${
                    viewMode === 'list' ? 'bg-dl-red text-white' : 'bg-white text-dl-grey hover:bg-dl-grey-bg'
                  }`}
                  title="List View"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {selectedCars.size > 0 && (
                <>
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="bg-dl-red text-white px-4 py-2 rounded-dl-sm hover:bg-dl-red-hover transition-colors flex items-center gap-2 font-semibold"
                  >
                    <Download className="w-5 h-5" />
                    <span>Export ({selectedCars.size})</span>
                  </button>
                  <button
                    onClick={() => setSelectedCars(new Set())}
                    className="bg-dl-grey-medium text-dl-grey px-4 py-2 rounded-dl-sm hover:bg-dl-grey-light hover:text-white transition-colors font-semibold"
                  >
                    Clear Selection
                  </button>
                </>
              )}

              <button
                onClick={() => setShowImportModal(true)}
                className="bg-dl-red text-white px-4 py-2 rounded-dl-sm hover:bg-dl-red-hover transition-colors flex items-center gap-2 font-semibold"
              >
                <Upload className="w-5 h-5" />
                <span>Import Bids</span>
              </button>
            </div>
          </div>
        </div>
      )}
      

      {/* Desktop: Results Count */}
      <div className="text-sm text-dl-grey-light font-medium mb-6">
        Showing {filteredCars.length} of {cars.length} cars
        {selectedCars.size > 0 && <span className="text-dl-red font-semibold"> • {selectedCars.size} selected</span>}
      </div>

      {/* Mobile Filter Panel */}
      <MobileFilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFilterChange={setFilters}
        uniqueLocations={uniqueLocations}
        uniqueLotNumbers={uniqueLotNumbers}
        uniqueMakeModels={uniqueMakeModels}
        uniqueYears={uniqueYears}
        uniqueColors={uniqueColors}
        uniqueBodyTypes={uniqueBodyTypes}
        onClearFilters={clearFilters}
      />

      {/* Desktop Filters Panel */}
      {showFilters && (
          <div className="hidden lg:block card-dl mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Chassis # - Most Important */}
              <div>
                <label className="block text-sm font-semibold text-dl-grey mb-2">
                  Chassis # <span className="text-dl-red">*</span>
                </label>
                <input
                  type="text"
                  value={filters.chassisNo}
                  onChange={(e) => setFilters({ ...filters, chassisNo: e.target.value })}
                  placeholder="Search by Chassis #..."
                  className="input-dl w-full"
                />
              </div>

              {/* Registration # */}
              <div>
                <label className="block text-sm font-semibold text-dl-grey mb-2">Registration #</label>
                <input
                  type="text"
                  value={filters.regNo}
                  onChange={(e) => setFilters({ ...filters, regNo: e.target.value })}
                  placeholder="Search by Reg #..."
                  className="input-dl w-full"
                />
              </div>

              {/* Fleet # */}
              <div>
                <label className="block text-sm font-semibold text-dl-grey mb-2">Fleet #</label>
                <input
                  type="text"
                  value={filters.fleetNo}
                  onChange={(e) => setFilters({ ...filters, fleetNo: e.target.value })}
                  placeholder="Search by Fleet #..."
                  className="input-dl w-full"
                />
              </div>

              {/* Lot # */}
              <div>
                <label className="block text-sm font-semibold text-dl-grey mb-2">Lot #</label>
                <select
                  value={filters.lotNumber}
                  onChange={(e) => setFilters({ ...filters, lotNumber: e.target.value })}
                  className="input-dl w-full"
                >
                  <option value="">All Lots</option>
                  {uniqueLotNumbers.map(lotNumber => (
                    <option key={lotNumber} value={lotNumber}>{lotNumber}</option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold text-dl-grey mb-2">Location</label>
                <select
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  className="input-dl w-full"
                >
                  <option value="">All Locations</option>
                  {uniqueLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* Make/Model */}
              <div>
                <label className="block text-sm font-semibold text-dl-grey mb-2">Make/Model</label>
                <input
                  type="text"
                  value={filters.makeModel}
                  onChange={(e) => setFilters({ ...filters, makeModel: e.target.value })}
                  placeholder="Search make/model..."
                  className="input-dl w-full"
                />
              </div>

              {/* Year */}
              <div>
                <label className="block text-sm font-semibold text-dl-grey mb-2">Year</label>
                <select
                  value={filters.year}
                  onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                  className="input-dl w-full"
                >
                  <option value="">All Years</option>
                  {uniqueYears.map(year => (
                    <option key={year} value={year.toString()}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-semibold text-dl-grey mb-2">Color</label>
                <select
                  value={filters.color}
                  onChange={(e) => setFilters({ ...filters, color: e.target.value })}
                  className="input-dl w-full"
                >
                  <option value="">All Colors</option>
                  {uniqueColors.map(color => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
              </div>

              {/* Body Type */}
              <div>
                <label className="block text-sm font-semibold text-dl-grey mb-2">Body Type</label>
                <select
                  value={filters.bodyType}
                  onChange={(e) => setFilters({ ...filters, bodyType: e.target.value })}
                  className="input-dl w-full"
                >
                  <option value="">All Body Types</option>
                  {uniqueBodyTypes.map(body => (
                    <option key={body} value={body}>{body}</option>
                  ))}
                </select>
              </div>

              {/* KM Range */}
              <div>
                <label className="block text-sm font-semibold text-dl-grey mb-2">KM Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.minKm}
                    onChange={(e) => setFilters({ ...filters, minKm: e.target.value })}
                    placeholder="Min"
                    className="input-dl w-full"
                  />
                  <input
                    type="number"
                    value={filters.maxKm}
                    onChange={(e) => setFilters({ ...filters, maxKm: e.target.value })}
                    placeholder="Max"
                    className="input-dl w-full"
                  />
                </div>
              </div>

            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="btn-secondary"
              >
                Clear All Filters
              </button>
            </div>
          </div>
      )}

      {/* Car Display */}
      {viewMode === 'tile' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 items-start">
          {filteredCars.map((car) => {
            const userBid = userBids[car.id];
            const isSelected = selectedCars.has(car.id);

            return (
              <MobileCarCard
                key={car.id}
                car={car}
                isSelected={isSelected}
                userBid={userBid}
                onSelect={toggleCarSelection}
                onClick={setSelectedCar}
              />
            );
          })}
        </div>
      ) : (
        /* List View */
        <>
          {/* Mobile List View */}
          <div className="lg:hidden space-y-3">
            {filteredCars.map((car) => {
              const userBid = userBids[car.id];
              const timeRemaining = getTimeRemaining(car.bidding_end_date);
              const isSelected = selectedCars.has(car.id);

              return (
                <div
                  key={car.id}
                  onClick={() => setSelectedCar(car)}
                  className={`card-dl cursor-pointer transition-all relative overflow-hidden ${
                    isSelected ? 'ring-2 ring-dl-red bg-red-50' : ''
                  } ${
                    userBid && !isSelected ? 'ring-2 ring-dl-red bg-red-50/50 border border-dl-red/30' : ''
                  } ${
                    userBid && isSelected ? 'ring-2 ring-dl-red bg-red-50 border-l-4 border-dl-red' : ''
                  }`}
                >
                  {/* Highlight indicator stripe */}
                  {userBid && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-dl-red via-dl-red-hover to-dl-red z-0"></div>
                  )}
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3 pt-2 relative z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCarSelection(car.id);
                      }}
                      className="p-1 -m-1 touch-target flex-shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-6 h-6 text-dl-red" />
                      ) : (
                        <Square className="w-6 h-6 text-dl-grey-light" />
                      )}
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                      {/* User Bid Badge */}
                      {userBid && (
                        <div className="px-2.5 py-1 rounded-full text-xs font-semibold text-dl-red bg-dl-grey-bg border border-dl-red shadow-sm flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                          <span>You Bid</span>
                        </div>
                      )}
                      <div className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        timeRemaining === 'Ended' ? 'text-red-600 bg-red-100' :
                        timeRemaining.includes('d') ? 'text-green-600 bg-green-100' :
                        timeRemaining.includes('h') ? 'text-orange-600 bg-orange-100' :
                        'text-red-600 bg-red-100'
                      }`}>
                        <Clock className="w-3 h-3 inline mr-1" />
                        {timeRemaining}
                      </div>
                    </div>
                  </div>

                  {/* Car Title */}
                  <h3 className="text-lg font-bold text-dl-grey mb-3">
                    {car.make_model || 'Vehicle'}
                  </h3>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-dl-grey-light">Reg No:</span>
                      <span className="ml-2 font-semibold text-dl-grey">{car.reg_no || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-dl-grey-light">Year:</span>
                      <span className="ml-2 font-semibold text-dl-grey">{car.year || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-dl-grey-light">Mileage:</span>
                      <span className="ml-2 font-semibold text-dl-grey">
                        {car.km ? `${car.km.toLocaleString()} km` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-dl-grey-light">Location:</span>
                      <span className="ml-2 font-semibold text-dl-grey">{car.location || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Bid Row */}
                  {userBid && (
                    <div className="border-t border-dl-grey-medium pt-3 mb-3">
                      <div className="flex justify-end items-center">
                        <div className="text-right">
                          <p className="text-xs text-dl-grey-light mb-1">Your Current Bid</p>
                          <p className="text-base font-bold text-dl-red">
                            AED {userBid.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCar(car);
                    }}
                    className="btn-primary w-full mt-3"
                  >
                    View & Bid
                  </button>
                </div>
              );
            })}
          </div>

          {/* Desktop List View */}
          <div className="hidden lg:block card-dl p-0 overflow-x-auto">
            <table className="w-full table-dl table-fixed">
            <colgroup>
              <col className="w-12" />
              <col className="w-[220px]" />
              <col className="w-[120px]" />
              <col className="w-[80px]" />
              <col className="w-[120px]" />
              <col className="w-[200px]" />
              <col className="w-[140px]" />
              <col className="w-[140px]" />
              <col className="w-[120px]" />
            </colgroup>
            <thead>
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-dl-grey-bg rounded"
                  >
                    {selectedCars.size === filteredCars.length && filteredCars.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-dl-red" />
                    ) : (
                      <Square className="w-5 h-5 text-dl-grey-light" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-dl-grey uppercase">Make/Model</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-dl-grey uppercase">Reg No</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-dl-grey uppercase">Year</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-dl-grey uppercase">Mileage</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-dl-grey uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-dl-grey uppercase">Your Bid</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-dl-grey uppercase">Time Left</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-dl-grey uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCars.map((car) => {
                const userBid = userBids[car.id];
                const timeRemaining = getTimeRemaining(car.bidding_end_date);
                const isSelected = selectedCars.has(car.id);

                return (
                  <tr
                    key={car.id}
                    className={`hover:bg-dl-grey-bg-alt transition-colors relative h-16 ${isSelected ? 'bg-red-50' : ''} ${
                      userBid && !isSelected ? 'bg-red-50 border-l-4 border-dl-red' : ''
                    } ${
                      userBid && isSelected ? 'bg-red-50 border-l-4 border-dl-red' : ''
                    }`}
                  >
                    <td className="px-4 py-3 relative z-10 align-middle w-12">
                      <button
                        onClick={() => toggleCarSelection(car.id)}
                        className="p-1 hover:bg-dl-grey-bg rounded"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-dl-red" />
                        ) : (
                          <Square className="w-5 h-5 text-dl-grey-light" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-dl-grey relative z-10 align-middle">
                      <div className="flex items-center gap-2">
                        {userBid && (
                          <CheckCircle2 className="w-5 h-5 text-dl-red flex-shrink-0" />
                        )}
                        <span className="truncate flex-1">{car.make_model || '-'}</span>
                        {userBid && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold text-dl-red bg-dl-grey-bg border border-dl-red whitespace-nowrap flex-shrink-0">
                            Your Bid
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-dl-grey-light align-middle truncate">{car.reg_no || '-'}</td>
                    <td className="px-4 py-3 text-sm text-dl-grey-light align-middle">{car.year || '-'}</td>
                    <td className="px-4 py-3 text-sm text-dl-grey-light align-middle truncate">{car.km ? `${car.km.toLocaleString()} km` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-dl-grey-light align-middle truncate">{car.location || '-'}</td>
                    <td className="px-4 py-3 relative z-10 align-middle">
                      {userBid ? (
                        <span className="text-sm font-bold text-dl-red whitespace-nowrap">
                          AED {userBid.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-dl-grey-light">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`text-sm font-semibold whitespace-nowrap ${
                        timeRemaining === 'Ended' ? 'text-red-600' :
                        timeRemaining.includes('d') ? 'text-green-600' :
                        timeRemaining.includes('h') ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {timeRemaining}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <button
                        onClick={() => setSelectedCar(car)}
                        className="btn-primary px-3 py-1 text-sm whitespace-nowrap"
                      >
                        View & Bid
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Bulk Bid Modal */}
      {showBulkBidModal && (
        <BulkBidModal
          cars={filteredCars.filter(c => selectedCars.has(c.id))}
          onClose={() => setShowBulkBidModal(false)}
          onSuccess={() => {
            setShowBulkBidModal(false);
            setSelectedCars(new Set());
            loadUserBids();
            onBidPlaced();
          }}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Export to Excel</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              This will export {selectedCars.size} selected car(s) to Excel. You can add bid amounts and import back.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleExportToExcel}
                className="flex-1 px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors"
              >
                Export
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Import Bids from Excel</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              Upload an Excel file with Car ID and Bid Amount columns.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportBids(file);
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <button
              onClick={() => setShowImportModal(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {selectedCar && (
        <CarDetailModal
          car={selectedCar}
          onClose={() => setSelectedCar(null)}
          onBidPlaced={() => {
            // Refresh user bids immediately
            loadUserBids();
            // Notify parent
            onBidPlaced();
          }}
        />
      )}

      {/* Floating Bulk Bid Button - Fixed on right side */}
      {selectedCars.size > 0 && (
        <button
          onClick={() => setShowBulkBidModal(true)}
          className="fixed right-4 sm:right-6 bottom-4 sm:bottom-6 z-40 bg-gradient-to-r from-green-600 to-green-700 text-white px-5 sm:px-6 py-3 sm:py-4 rounded-full shadow-2xl hover:from-green-700 hover:to-green-800 transition-all duration-300 flex items-center gap-2 sm:gap-3 font-bold text-sm sm:text-base hover:scale-105 active:scale-95 touch-target"
          style={{
            boxShadow: '0 10px 25px rgba(22, 163, 74, 0.4)',
          }}
          aria-label={`Bulk Bid on ${selectedCars.size} selected car${selectedCars.size > 1 ? 's' : ''}`}
        >
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="hidden sm:inline">Bulk Bid</span>
          <span className="bg-white text-green-700 rounded-full px-2.5 py-0.5 text-xs sm:text-sm font-bold min-w-[24px] sm:min-w-[28px] text-center">
            {selectedCars.size}
          </span>
        </button>
      )}
    </>
  );
}

// Bulk Bid Modal Component
function BulkBidModal({ cars, onClose, onSuccess }: { cars: any[]; onClose: () => void; onSuccess: () => void }) {
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, userProfile } = useAuth();

  useEffect(() => {
    const amounts: Record<string, string> = {};
    cars.forEach(car => {
      amounts[car.id] = '';
    });
    setBidAmounts(amounts);
  }, [cars]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check if terms are accepted (stored in localStorage)
    if (user) {
      const termsAcceptedKey = `terms_accepted_${user.id}`;
      const termsAccepted = localStorage.getItem(termsAcceptedKey);
    if (!termsAccepted) {
        setError('Please accept the Terms and Conditions first. The terms modal should appear when you first visit the bidding page.');
      return;
      }
    }

    if (!userProfile?.approved) {
      setError('Your account is pending approval. You cannot bid until approved.');
      return;
    }

    const bids: Array<{ car_id: string; amount: number }> = [];
    const errors: string[] = [];

    cars.forEach(car => {
      const amountStr = bidAmounts[car.id]?.trim();
      if (!amountStr) {
        errors.push(`Missing bid amount for ${car.make_model}`);
        return;
      }

      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Invalid bid amount for ${car.make_model}`);
        return;
      }

      if (amount <= 0) {
        errors.push(`Bid for ${car.make_model} must be greater than 0`);
        return;
      }

      // Check if bidding is still open
      const now = new Date().getTime();
      const endTime = new Date(car.bidding_end_date).getTime();
      if (now > endTime) {
        errors.push(`Bidding closed for ${car.make_model}`);
        return;
      }

      bids.push({ car_id: car.id, amount });
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }

    if (bids.length === 0) {
      setError('No valid bids to submit');
      return;
    }

    setLoading(true);

    try {
      if (!user) {
        throw new Error('User not found');
      }

      // For each bid, ensure only one bid per user per car
      for (const bid of bids) {
        // Delete ALL existing bids for this user on this car first (in case of duplicates)
        const { error: deleteError } = await supabase
          .from('bids')
          .delete()
          .eq('car_id', bid.car_id)
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;

        // Insert new bid (only one bid per user per car)
        const { error: insertError } = await supabase.from('bids').insert({
          car_id: bid.car_id,
          user_id: user.id,
          amount: bid.amount,
        });

        if (insertError) throw insertError;
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit bids');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-dl shadow-dl-lg w-full max-w-4xl max-h-[90vh] my-4 flex flex-col">
        {/* Header */}
        <div className="bg-dl-red text-white p-4 sm:p-6 flex items-center justify-between rounded-t-dl">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Bulk Bid Submission</h2>
            <p className="text-sm text-white/90 mt-1">Submit bids for {cars.length} vehicle{cars.length > 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-full transition-colors touch-target"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          {/* Error Message */}
          {error && (
            <div className="m-4 sm:m-6 p-4 bg-red-50 border-l-4 border-dl-red rounded-dl text-red-700 text-sm whitespace-pre-line">
              <p className="font-semibold mb-2">⚠️ Please fix the following issues:</p>
              {error}
            </div>
          )}

          {/* Cars List */}
          <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            {cars.map((car, index) => (
              <div key={car.id} className="card-dl border-l-4 border-dl-red">
                {/* Car Info Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="bg-dl-red text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-dl-grey text-base sm:text-lg line-clamp-2">{car.make_model}</h3>
                        <p className="text-sm text-dl-grey-light mt-1">
                          <span className="font-medium">Reg:</span> {car.reg_no || 'N/A'}
                          <span className="mx-2">•</span>
                          <span className="font-medium">Location:</span> {car.location || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="flex flex-wrap gap-3 text-xs text-dl-grey-light ml-8">
                      {car.year && (
                        <span>
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {car.year}
                        </span>
                      )}
                      {car.km && (
                        <span>
                          <Gauge className="w-3 h-3 inline mr-1" />
                          {car.km.toLocaleString()} km
                        </span>
                      )}
                    </div>
                  </div>

                </div>

                {/* Bid Input */}
                <div>
                  <label className="block text-sm font-semibold text-dl-grey mb-2">
                    Your Bid Amount (AED) *
                  </label>
                  <input
                    type="number"
                    value={bidAmounts[car.id] || ''}
                    onChange={(e) => setBidAmounts({ ...bidAmounts, [car.id]: e.target.value })}
                    min="1"
                    step="0.01"
                    required
                    className="input-dl w-full text-lg font-semibold"
                    placeholder="Enter bid amount (AED)"
                  />
                  <p className="text-xs text-dl-grey-light mt-2">
                    💡 Enter your bid amount
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-dl-grey-medium p-4 sm:p-6 bg-dl-grey-bg-alt">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1 sm:flex-none sm:px-8 order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 sm:flex-auto order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    Submitting Bids...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5 inline mr-2" />
                    Submit {cars.length} Bid{cars.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}


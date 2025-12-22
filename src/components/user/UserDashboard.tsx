import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Car, LogOut, User as UserIcon, TrendingUp, ArrowUpDown, Search, X, Download, Filter, Grid, List, CheckSquare, Square, Upload, Info, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { EnhancedCarGrid } from './EnhancedCarGrid';
import { Logo } from '../common/Logo';
import { formatDate } from '../../utils/dateUtils';
import * as XLSX from 'xlsx';
import { formatCarForExport } from '../../utils/carExportFormatter';
import { TermsModal } from './TermsModal';

type SortOption = 
  | 'bidded-first'
  | 'km-low-high'
  | 'km-high-low'
  | 'year-new-old'
  | 'year-old-new'
  | 'make-asc'
  | 'make-desc';

export function UserDashboard() {
  // CRITICAL: Check route FIRST before ANY hooks - this must be synchronous
  // This prevents the component from running any logic if on admin/business route
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isAdminRoute = currentPath.includes('/admin');
  const isBusinessRoute = currentPath.includes('/business');
  
  // ABSOLUTE GUARD: If on admin/business route, return null IMMEDIATELY before any hooks
  // This prevents React from even calling useAuth or any other hooks
  if (isAdminRoute || isBusinessRoute) {
    return null;
  }
  
  const { userProfile, signOut, user, loading: authLoading, isAdmin, isBusinessUser } = useAuth();
  
  // Additional guard: Don't render anything for admins or business users
  if (isAdmin || isBusinessUser) {
    return null;
  }
  
  const [cars, setCars] = useState<any[]>([]);
  const [sortedCars, setSortedCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOption, setSortOption] = useState<SortOption>('bidded-first');
  const [biddedCarIds, setBiddedCarIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'tile' | 'list'>('tile');
  const [showFilters, setShowFilters] = useState(false);
  const [allSelected, setAllSelected] = useState(false);
  const [showBulkBidInfo, setShowBulkBidInfo] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const { showSuccess, showWarning } = useNotification();

  // Check if user is approved
  const isApproved = userProfile?.approved === true;

  // Check if terms need to be accepted on first visit to bidding page
  // IMPORTANT: Never show terms modal for admin or business users
  useEffect(() => {
    // Don't show terms modal for admins or business users
    if (isAdmin || isBusinessUser) {
      return;
    }
    
    if (user && !authLoading) {
      const termsAcceptedKey = `terms_accepted_${user.id}`;
      const termsAccepted = localStorage.getItem(termsAcceptedKey);
      
      // Show modal if terms haven't been accepted yet
      if (!termsAccepted) {
        setShowTermsModal(true);
      }
    }
  }, [user, authLoading, isAdmin, isBusinessUser]);

  const handleAcceptTerms = () => {
    setShowTermsModal(false);
  };

  useEffect(() => {
    if (!user?.id) {
      // No user - clear any stored load time
      sessionStorage.removeItem('userDashboard_lastLoad');
      setLoading(false);
      return;
    }

    // Wait for user profile to load before checking approval status
    if (authLoading) {
      console.log('Waiting for user profile to load...');
      return;
    }

    // CRITICAL: Don't load cars if user is not approved
    // Unapproved users should only see the approval pending message
    if (!isApproved) {
      console.log('User is not approved - skipping car load and showing approval pending message');
      setCars([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    let reloadTimeout: NodeJS.Timeout | null = null;
    let isLoading = false;
    const MIN_RELOAD_INTERVAL = 60000; // Don't reload if less than 60 seconds since last load
    const STORAGE_KEY = 'userDashboard_lastLoad';
    const USER_ID_KEY = 'userDashboard_userId';
    
    // Check if this is a different user - if so, clear load time
    const lastUserId = sessionStorage.getItem(USER_ID_KEY);
    if (lastUserId !== user.id) {
      // Different user logged in - clear load time to force fresh load
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.setItem(USER_ID_KEY, user.id);
    }
    
    // Get last load time from sessionStorage to persist across remounts
    const getLastLoadTime = () => {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? parseInt(stored, 10) : 0;
    };
    
    const setLastLoadTime = (time: number) => {
      sessionStorage.setItem(STORAGE_KEY, time.toString());
      sessionStorage.setItem(USER_ID_KEY, user.id); // Store current user ID
    };
    
    const loadActiveCarsSafe = async (force = false) => {
      if (!isMounted) return;
      
      // Check if we should skip reload (unless forced)
      const lastLoadTime = getLastLoadTime();
      const timeSinceLastLoad = Date.now() - lastLoadTime;
      if (!force && timeSinceLastLoad < MIN_RELOAD_INTERVAL) {
        console.log('Skipping reload - too soon since last load', Math.round(timeSinceLastLoad / 1000), 'seconds ago');
        return;
      }
      
      if (isLoading) {
        // If already loading, wait a bit and try again
        setTimeout(() => {
          if (isMounted && !isLoading) {
            loadActiveCarsSafe(force);
          }
        }, 500);
        return;
      }
      isLoading = true;
      try {
        await loadActiveCars();
        setLastLoadTime(Date.now());
      } catch (error) {
        console.error('Error in loadActiveCarsSafe:', error);
      } finally {
        isLoading = false;
      }
    };

    // Check if we need to do initial load
    const lastLoadTime = getLastLoadTime();
    const timeSinceLastLoad = Date.now() - lastLoadTime;
    const isDifferentUser = lastUserId !== user.id;
    const shouldLoadInitially = lastLoadTime === 0 || timeSinceLastLoad >= MIN_RELOAD_INTERVAL || isDifferentUser;
    
    if (shouldLoadInitially) {
      // Initial load - always load on fresh login (different user) or if time interval passed
      if (isDifferentUser) {
        console.log('Loading cars - different user logged in (fresh login)');
      } else {
        console.log('Loading cars - time interval passed or first load');
      }
      loadActiveCarsSafe(true);
    } else {
      // Data was recently loaded by same user, just set loading to false
      setLoading(false);
      console.log('Skipping initial load - data was recently loaded', Math.round(timeSinceLastLoad / 1000), 'seconds ago');
    }

    // Track if we're currently refreshing statuses to avoid reload loops
    let isRefreshingStatuses = false;
    
    // Use debouncing to prevent excessive reloads
    const debouncedLoadCars = (force = false, skipIfRefreshing = false) => {
      // Skip reload if we're refreshing statuses (to prevent reload loops)
      if (skipIfRefreshing && isRefreshingStatuses) {
        console.log('Skipping reload - status refresh in progress');
        return;
      }
      
      if (reloadTimeout) clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(() => {
        if (isMounted && !isLoading) {
          loadActiveCarsSafe(force);
        }
      }, 5000); // Increased to 5 seconds to batch more updates and reduce refresh frequency
    };

    // Only subscribe to real-time changes if user is approved
    // This prevents unnecessary subscriptions and reloads
    let subscription: any = null;
    let bidsSubscription: any = null;
    
    if (isApproved) {
      subscription = supabase
        .channel('cars-changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'cars'
        }, (payload) => {
          // Skip if we're refreshing statuses to prevent reload loops
          if (isRefreshingStatuses) {
            console.log('Skipping car change - status refresh in progress');
            return;
          }
          
          // Only reload if the change affects visible cars
          // Check if status changed to/from Active, or bidding fields changed
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          const statusChanged = oldStatus !== newStatus;
          const becameActive = newStatus === 'Active' && oldStatus !== 'Active';
          const becameInactive = newStatus !== 'Active' && oldStatus === 'Active';
          
          // Check if bidding-related fields changed
          const biddingChanged = 
            payload.old?.bidding_enabled !== payload.new?.bidding_enabled ||
            payload.old?.bidding_start_date !== payload.new?.bidding_start_date ||
            payload.old?.bidding_end_date !== payload.new?.bidding_end_date;
          
          if (statusChanged || becameActive || becameInactive || biddingChanged) {
            console.log('Relevant car change detected - will reload:', {
              event: payload.eventType,
              statusChanged,
              becameActive,
              becameInactive,
              biddingChanged
            });
            debouncedLoadCars(true, true); // Skip if refreshing statuses
          } else {
            console.log('Ignoring car change - not relevant to visible cars:', payload.eventType);
          }
        })
        .subscribe();

      bidsSubscription = supabase
        .channel('bids-changes')
        .on('postgres_changes', { 
          event: 'INSERT', // Only listen to new bids
          schema: 'public', 
          table: 'bids' 
        }, (payload) => {
          // Skip if we're refreshing statuses
          if (isRefreshingStatuses) {
            console.log('Skipping bid change - status refresh in progress');
            return;
          }
          
          // Only reload if the bid is for a car we're showing
          // We'll reload to update bid counts
          console.log('New bid detected - will reload cars');
          debouncedLoadCars(true, true); // Skip if refreshing statuses
        })
        .subscribe();
    }

    // Handle visibility change - only reload if tab was hidden for more than 5 minutes
    // Track when tab was hidden to calculate actual hidden duration
    let tabHiddenAt: number | null = null;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab was hidden - record the time
        tabHiddenAt = Date.now();
        console.log('Tab hidden');
      } else if (document.visibilityState === 'visible') {
        // Tab became visible
        if (tabHiddenAt) {
          const hiddenDuration = Date.now() - tabHiddenAt;
          const lastLoadTime = getLastLoadTime();
          const timeSinceLastLoad = Date.now() - lastLoadTime;
          
          // Only reload if:
          // 1. Tab was hidden for more than 5 minutes, AND
          // 2. Data hasn't been loaded recently (more than 60 seconds ago)
          if (hiddenDuration > 300000 && timeSinceLastLoad > 60000) {
            console.log('Tab visible again after long absence - reloading', {
              hiddenDuration: Math.round(hiddenDuration / 1000),
              timeSinceLastLoad: Math.round(timeSinceLastLoad / 1000)
            });
            loadActiveCarsSafe(true);
          } else {
            console.log('Tab visible again - skipping reload', {
              hiddenDuration: Math.round(hiddenDuration / 1000),
              timeSinceLastLoad: Math.round(timeSinceLastLoad / 1000),
              reason: hiddenDuration <= 300000 ? 'tab not hidden long enough' : 'data recently loaded'
            });
          }
          tabHiddenAt = null; // Reset
        } else {
          // Tab was already visible when we started tracking - just log
          console.log('Tab visible - no reload needed (was already visible)');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodically refresh car statuses (every 5 minutes)
    // Note: Real-time subscriptions will handle updates, so we don't need to force reload
    const statusRefreshInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        isRefreshingStatuses = true;
        await supabase.rpc('refresh_car_statuses');
        // Also fix any cars that are still active in closed lots
        try {
          await supabase.rpc('fix_cars_in_closed_lots');
        } catch (fixError) {
          console.error('Error fixing cars in closed lots:', fixError);
        }
        // Don't force reload - real-time subscriptions will handle updates automatically
        // Reset flag after a short delay to allow subscriptions to process
        setTimeout(() => {
          isRefreshingStatuses = false;
        }, 3000);
      } catch (error) {
        console.error('Error refreshing car statuses:', error);
        isRefreshingStatuses = false;
      }
    }, 300000); // 5 minutes

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
      if (bidsSubscription) bidsSubscription.unsubscribe();
      clearInterval(statusRefreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reloadTimeout) clearTimeout(reloadTimeout);
    };
  }, [user?.id, isApproved, authLoading]); // Reload when user ID, approval status, or auth loading state changes

  // Apply sorting whenever cars or sortOption changes
  useEffect(() => {
    applySorting();
  }, [cars, sortOption, biddedCarIds]);

  // Filter cars based on search query
  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortedCars.length > 0 ? sortedCars : cars;
    }

    const query = searchQuery.toLowerCase().trim();
    const carsToSearch = sortedCars.length > 0 ? sortedCars : cars;
    
    return carsToSearch.filter(car => {
      // Search in multiple fields
      const chassisNo = (car.chassis_no || '').toLowerCase();
      const regNo = (car.reg_no || '').toLowerCase();
      const fleetNo = (car.fleet_no || '').toLowerCase();
      const srNumber = (car.sr_number || '').toLowerCase();
      const makeModel = (car.make_model || '').toLowerCase();
      const location = (car.location || '').toLowerCase();
      const engineNo = (car.engine_no || '').toLowerCase();
      
      return chassisNo.includes(query) ||
             regNo.includes(query) ||
             fleetNo.includes(query) ||
             srNumber.includes(query) ||
             makeModel.includes(query) ||
             location.includes(query) ||
             engineNo.includes(query);
    });
  }, [searchQuery, sortedCars, cars]);

  const loadActiveCars = async () => {
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

      // Only load cars from approved lots
      const { data: approvedLots, error: lotsError } = await supabase
        .from('lots')
        .select('id, lot_number, status, approved')
        .eq('approved', true)
        .in('status', ['Approved', 'Active']);

      if (lotsError) {
        console.error('Error loading approved lots:', lotsError);
        setCars([]);
        setLoading(false);
        return;
      }

      const lotIds = approvedLots?.map(l => l.id) || [];
      console.log('Approved lots:', approvedLots?.length, 'Lot IDs:', lotIds);
      console.log('Approved lots details:', approvedLots?.map(l => ({
        id: l.id,
        lot_number: l.lot_number,
        status: l.status,
        approved: l.approved
      })));

      if (lotIds.length === 0) {
        console.warn('No approved lots found. Cars will not be displayed.');
        console.log('To fix: Ensure lots have approved=true and status IN (\'Approved\', \'Active\')');
        setCars([]);
        setLoading(false);
        return;
      }

      // Check all cars in these lots to see what we have (for diagnostics)
      const { data: allCarsInLots, error: allCarsError } = await supabase
        .from('cars')
        .select('id, lot_id, status, bidding_enabled, bidding_start_date, bidding_end_date, make_model')
        .in('lot_id', lotIds);

      console.log('All cars in approved lots (before filtering):', allCarsInLots?.length);
      if (allCarsInLots && allCarsInLots.length > 0) {
        console.log('Sample cars:', allCarsInLots.slice(0, 5).map(c => ({
          id: c.id,
          make_model: c.make_model,
          status: c.status,
          bidding_enabled: c.bidding_enabled,
          bidding_start: c.bidding_start_date,
          bidding_end: c.bidding_end_date
        })));
      }
      
      // Check which cars meet the criteria (for diagnostics)
      const now = new Date().toISOString();
      const carsMeetingCriteria = allCarsInLots?.filter(car => {
        const hasValidDates = car.bidding_start_date && car.bidding_end_date;
        const isWithinDates = hasValidDates && 
          car.bidding_start_date <= now && 
          car.bidding_end_date >= now;
        const isActive = car.status === 'Active';
        const biddingEnabled = car.bidding_enabled === true;
        return isActive && isWithinDates && biddingEnabled;
      });
      console.log('Cars meeting ALL criteria (status=Active, within dates, bidding_enabled=true):', carsMeetingCriteria?.length);
      if (carsMeetingCriteria && carsMeetingCriteria.length === 0 && allCarsInLots && allCarsInLots.length > 0) {
        console.warn('Cars exist but none meet criteria. Reasons:');
        allCarsInLots.forEach(car => {
          const reasons = [];
          if (car.status !== 'Active') reasons.push(`status=${car.status} (not Active)`);
          if (!car.bidding_enabled) reasons.push('bidding_enabled=false');
          if (!car.bidding_start_date || !car.bidding_end_date) reasons.push('missing dates');
          if (car.bidding_start_date && car.bidding_end_date) {
            if (car.bidding_start_date > now) reasons.push(`start date in future (${car.bidding_start_date})`);
            if (car.bidding_end_date < now) reasons.push(`end date in past (${car.bidding_end_date})`);
          }
          if (reasons.length > 0) {
            console.warn(`Car ${car.id} (${car.make_model}): ${reasons.join(', ')}`);
          }
        });
      }

      // Now get cars with the lot join (this will respect RLS)
      // Filter for active cars only - ensure bidding is enabled and within date range
      // Note: RLS policy requires lot.approved=true, lot.status IN ('Approved','Active'), 
      // car.status='Active', and dates to be valid and within range
      const { data, error } = await supabase
        .from('cars')
        .select('*, lot:lots!inner(approved, status, lot_number)')
        .in('lot_id', lotIds)
        .eq('status', 'Active')
        .eq('bidding_enabled', true)
        .lte('bidding_start_date', now)
        .gte('bidding_end_date', now)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading cars:', error);
        console.error('Query error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }

      console.log('Cars returned by query (after RLS):', data?.length);
      if (data && data.length > 0) {
        console.log('Sample returned cars:', data.slice(0, 3).map(c => ({
          id: c.id,
          make_model: c.make_model,
          status: c.status,
          lot_status: c.lot?.status,
          lot_approved: c.lot?.approved,
          bidding_enabled: c.bidding_enabled,
          bidding_start: c.bidding_start_date,
          bidding_end: c.bidding_end_date
        })));
      } else if (data && data.length === 0) {
        console.warn('Query returned 0 cars. Possible reasons:');
        console.warn('1. RLS policy is blocking access');
        console.warn('2. Cars don\'t meet all criteria (status=Active, bidding_enabled=true, within dates)');
        console.warn('3. Lots are not properly approved or have wrong status');
      }

      if (error) {
        console.error('Query failed. Setting cars to empty array.');
        setCars([]);
        setLoading(false);
        return;
      }

      if (!data) {
        console.warn('Query returned null/undefined data. Setting cars to empty array.');
        setCars([]);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        // Filter to ensure lot is approved and active, and car is within bidding period
        const now = new Date().toISOString();
        const filteredCars = data.filter(car => {
          const lotApproved = car.lot?.approved === true;
          const lotActive = car.lot?.status === 'Approved' || car.lot?.status === 'Active';
          const carActive = car.status === 'Active';
          const biddingEnabled = car.bidding_enabled === true;
          const withinDates = car.bidding_start_date && car.bidding_end_date &&
            car.bidding_start_date <= now && car.bidding_end_date >= now;
          
          return lotApproved && lotActive && carActive && biddingEnabled && withinDates;
        });
        console.log('Filtered cars:', filteredCars.length);
        console.log('Filtered cars details:', filteredCars.map(c => ({
          id: c.id,
          make_model: c.make_model,
          status: c.status,
          lot_status: c.lot?.status,
          lot_approved: c.lot?.approved,
          bidding_start: c.bidding_start_date,
          bidding_end: c.bidding_end_date
        })));
        
        // Get car IDs that user has bid on (if user is logged in)
        if (user && filteredCars.length > 0) {
          const carIds = filteredCars.map(c => c.id);
          const { data: userBids } = await supabase
            .from('bids')
            .select('car_id')
            .eq('user_id', user.id)
            .in('car_id', carIds);
          
          setBiddedCarIds(new Set(userBids?.map(bid => bid.car_id) || []));
        } else {
          setBiddedCarIds(new Set());
        }
        
        setCars(filteredCars);
      } else {
        console.log('No data returned or error occurred');
        setCars([]);
      }
    } catch (err) {
      console.error('Error in loadActiveCars:', err);
      setCars([]);
    } finally {
      setLoading(false);
    }
  };

  const applySorting = () => {
    if (cars.length === 0) {
      setSortedCars([]);
      return;
    }

    // Create a copy to avoid mutating the original array
    const sorted = [...cars].sort((a, b) => {
      switch (sortOption) {
        case 'bidded-first':
          const aHasBid = biddedCarIds.has(a.id);
          const bHasBid = biddedCarIds.has(b.id);
          if (aHasBid && !bHasBid) return -1;
          if (!aHasBid && bHasBid) return 1;
          return 0;

        case 'km-low-high':
          const aKm = a.km ?? Infinity;
          const bKm = b.km ?? Infinity;
          return aKm - bKm;

        case 'km-high-low':
          const aKmDesc = a.km ?? -Infinity;
          const bKmDesc = b.km ?? -Infinity;
          return bKmDesc - aKmDesc;

        case 'year-new-old':
          const aYear = a.year ?? -Infinity;
          const bYear = b.year ?? -Infinity;
          return bYear - aYear;

        case 'year-old-new':
          const aYearAsc = a.year ?? Infinity;
          const bYearAsc = b.year ?? Infinity;
          return aYearAsc - bYearAsc;

        case 'make-asc':
          const aMake = (a.make_model || '').toLowerCase();
          const bMake = (b.make_model || '').toLowerCase();
          return aMake.localeCompare(bMake);

        case 'make-desc':
          const aMakeDesc = (a.make_model || '').toLowerCase();
          const bMakeDesc = (b.make_model || '').toLowerCase();
          return bMakeDesc.localeCompare(aMakeDesc);

        default:
          return 0;
      }
    });

    setSortedCars(sorted);
  };


  const handleSignOut = async () => {
    try {
      await signOut();
      // signOut() already handles redirect, no need to redirect again
    } catch (error) {
      console.error('Sign out error:', error);
      // signOut() already handles redirect even on error
    }
  };

  const handleExportFullList = () => {
    const carsToExport = filteredBySearch.length > 0 ? filteredBySearch : cars;
    
    if (carsToExport.length === 0) {
      showWarning('No Cars', 'There are no cars to export');
      return;
    }

    // Sort cars by lot number first, then by S# (sr_number) within each lot
    const sortedCarsForExport = [...carsToExport].sort((a, b) => {
      const lotA = a.lot?.lot_number || '';
      const lotB = b.lot?.lot_number || '';
      
      // First sort by lot number
      if (lotA !== lotB) {
        return lotA.localeCompare(lotB);
      }
      
      // If same lot, sort by S# (sr_number)
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

    // Get unique lot numbers for the export
    const lotNumbers = new Set<string>();
    sortedCarsForExport.forEach(car => {
      if (car.lot?.lot_number) {
        lotNumbers.add(car.lot.lot_number);
      }
    });
    const lotNumberStr = Array.from(lotNumbers).join(', ');

    // Use standard export format, then add additional columns for user inspection
    // S# will use the original sr_number from import sheet (stored in car.sr_number)
    const exportData = sortedCarsForExport.map((car, index) => {
      const baseData = formatCarForExport(car, index, car.lot?.lot_number);
      return {
        ...baseData,
        'Notes': '', // Empty column for user to add notes during physical inspection
        'Bid Amount': '', // Empty column for user to add bid amounts after inspection
      };
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths for better readability
    const colWidths = [
      { wch: 6 },   // S.No
      { wch: 8 },   // Lot #
      { wch: 18 },  // Chassis #
      { wch: 15 },  // Registration #
      { wch: 12 },  // Fleet #
      { wch: 12 },  // SR #
      { wch: 15 },  // Engine #
      { wch: 25 },  // Make/Model
      { wch: 6 },   // Year
      { wch: 10 },  // KM
      { wch: 20 },  // Location
      { wch: 20 },  // Current Location
      { wch: 12 },  // Color
      { wch: 12 },  // Fuel Type
      { wch: 12 },  // Transmission
      { wch: 15 },  // Body Type
      { wch: 6 },   // Seats
      { wch: 6 },   // Doors
      { wch: 18 },  // Bidding Start
      { wch: 18 },  // Bidding End
      { wch: 10 },  // Status
      { wch: 30 },  // Notes
      { wch: 12 },  // Bid Amount
    ];
    ws['!cols'] = colWidths;

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cars List');
    
    // Generate filename with date and lot info
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = lotNumberStr 
      ? `cars_list_lot_${lotNumberStr.replace(/,/g, '_')}_${dateStr}.xlsx`
      : `cars_list_${dateStr}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    
    // Show success notification
    showSuccess(
      'Export Successful',
      `Exported ${carsToExport.length} car(s) to Excel. You can now print this list for your physical inspection.`
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Terms and Conditions Modal */}
      {showTermsModal && user && (
        <TermsModal
          userId={user.id}
          onAccept={handleAcceptTerms}
        />
      )}
      <header className="bg-white shadow-lg sticky top-0 z-20 border-b-4 border-dl-red">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <Logo className="h-10 sm:h-12" />
              <div className="border-l-2 border-dl-red pl-4">
                <p className="text-sm sm:text-base text-dl-grey font-bold tracking-wide uppercase">Live Auctions</p>
                <p className="text-xs text-dl-grey-light hidden sm:block font-sans">Used Vehicles Bidding Platform</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  window.location.href = '/profile';
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-dl-grey hover:bg-slate-50 rounded-lg transition-all duration-200 border border-transparent hover:border-slate-200"
                aria-label="Profile"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-dl-red to-red-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {userProfile?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="hidden lg:inline text-sm font-semibold truncate max-w-[120px]">{userProfile?.name}</span>
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 bg-dl-red text-white hover:bg-dl-red-hover rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-semibold"
                aria-label="Sign Out"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Banner Card Section with All Controls */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-6 sm:pt-8 pb-4 sm:pb-5">
        <div className="bg-gradient-to-r from-dl-red via-red-700 to-dl-red rounded-3xl shadow-2xl relative overflow-hidden border-2 border-dl-red/20">
          {/* Pattern overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)`
            }}></div>
          </div>
          
          <div className="relative z-10 p-6 sm:p-8 lg:p-10">
            {/* Top Section - Title and Stats */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-bold uppercase tracking-wider mb-4 border border-white/30">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  Live Auctions
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-3 leading-tight font-sans">
                  Used Vehicles Bidding
                </h2>
                <p className="text-base sm:text-lg text-white/90 font-medium max-w-2xl mx-auto lg:mx-0">
                  Discover quality used vehicles at competitive prices. Bid now and drive away with your perfect vehicle!
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-4 border-2 border-white/30 shadow-xl">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    <p className="text-xs text-white/80 font-bold uppercase tracking-wider">Live Now</p>
                  </div>
                  <p className="text-3xl font-extrabold text-white">{cars.length}</p>
                  <p className="text-sm text-white/70 font-medium">Cars</p>
                </div>
              </div>
            </div>

            {/* Controls Section - Form Style Layout */}
            {cars.length > 0 && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl py-4 sm:py-5 shadow-xl border border-white/30 w-full">
                <div className="flex flex-nowrap items-center justify-center gap-1.5 sm:gap-2 lg:gap-2.5 px-3 sm:px-4">
                  {/* Search Bar */}
                  <div className="relative flex-shrink w-[180px] sm:w-[220px] md:w-[260px] lg:w-[300px] xl:w-[350px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-dl-red" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full pl-10 pr-8 py-2.5 sm:py-3 bg-white border-2 border-slate-200 rounded-xl text-dl-grey placeholder-slate-400 focus:outline-none focus:border-dl-red transition-colors font-medium text-sm sm:text-base"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 text-slate-400 hover:text-dl-red transition-colors rounded-lg hover:bg-slate-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Filter Button */}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2.5 bg-white text-dl-grey border-2 border-slate-200 rounded-xl hover:bg-slate-50 hover:border-dl-red transition-all duration-200 shadow-md font-semibold whitespace-nowrap flex-shrink-0"
                    title="Filter vehicles"
                  >
                    <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden md:inline text-xs sm:text-sm">Filter</span>
                  </button>

                  {/* Grid/List Toggle */}
                  <div className="flex items-center bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                    <button
                      onClick={() => setViewMode('tile')}
                      className={`p-2 sm:p-2.5 transition-colors ${
                        viewMode === 'tile' ? 'bg-dl-red text-white' : 'bg-white text-dl-grey hover:bg-slate-50'
                      }`}
                      title="Grid View"
                    >
                      <Grid className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <div className="w-px h-6 bg-slate-200"></div>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 sm:p-2.5 transition-colors ${
                        viewMode === 'list' ? 'bg-dl-red text-white' : 'bg-white text-dl-grey hover:bg-slate-50'
                      }`}
                      title="List View"
                    >
                      <List className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>

                  {/* Select All Button */}
                  <button
                    className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2.5 bg-white text-dl-grey border-2 border-slate-200 rounded-xl hover:bg-slate-50 hover:border-dl-red transition-all duration-200 shadow-md font-semibold whitespace-nowrap flex-shrink-0"
                    title="Select all vehicles"
                    onClick={() => {
                      // This will be handled by EnhancedCarGrid
                      const event = new CustomEvent('selectAllToggle');
                      window.dispatchEvent(event);
                    }}
                  >
                    {allSelected ? (
                      <>
                        <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden md:inline text-xs sm:text-sm">Deselect</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden md:inline text-xs sm:text-sm">Select All</span>
                      </>
                    )}
                  </button>

                  {/* Sort Dropdown */}
                  <div className="relative flex items-center gap-1.5 bg-white border-2 border-slate-200 rounded-xl px-2.5 sm:px-3 py-2.5 w-[140px] sm:w-[160px] md:w-[180px] flex-shrink-0 overflow-hidden">
                    <ArrowUpDown className="w-4 h-4 sm:w-5 sm:h-5 text-dl-red flex-shrink-0" />
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as SortOption)}
                      className="flex-1 bg-transparent text-xs sm:text-sm font-semibold text-dl-grey focus:outline-none cursor-pointer appearance-none pr-5 sm:pr-6"
                    >
                      <option value="bidded-first">My Bids First</option>
                      <option value="km-low-high">KM: Low to High</option>
                      <option value="km-high-low">KM: High to Low</option>
                      <option value="year-new-old">Year: Newest First</option>
                      <option value="year-old-new">Year: Oldest First</option>
                      <option value="make-asc">Make/Model: A-Z</option>
                      <option value="make-desc">Make/Model: Z-A</option>
                    </select>
                    <div className="absolute right-2.5 sm:right-3 top-1/2 transform -translate-y-1/2 pointer-events-none z-10">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-dl-grey" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Import Bids Button */}
                  <button
                    onClick={() => {
                      // Trigger import modal in EnhancedCarGrid
                      const event = new CustomEvent('openImportModal');
                      window.dispatchEvent(event);
                    }}
                    className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2.5 bg-dl-red text-white rounded-xl hover:bg-dl-red-hover transition-all duration-200 shadow-md hover:shadow-lg font-semibold whitespace-nowrap flex-shrink-0"
                    title="Import bids from Excel"
                  >
                    <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden md:inline text-xs sm:text-sm">Import Bids</span>
                  </button>

                  {/* Export Button */}
                  <button
                    onClick={handleExportFullList}
                    className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2.5 bg-dl-grey text-white rounded-xl hover:bg-dl-grey-light transition-all duration-200 shadow-md hover:shadow-lg font-semibold whitespace-nowrap flex-shrink-0"
                    title="Export full list to Excel"
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden md:inline text-xs sm:text-sm">Export</span>
                  </button>
                </div>

                {/* Search Results Indicator */}
                {searchQuery && (
                  <div className="mt-4 flex items-center gap-2 text-sm bg-white/80 rounded-lg px-4 py-2">
                    <div className="w-2 h-2 bg-dl-red rounded-full"></div>
                    <p className="text-dl-grey font-medium">
                      Found <span className="font-bold text-dl-red">{filteredBySearch.length}</span> vehicle{filteredBySearch.length !== 1 ? 's' : ''} matching "{searchQuery}"
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Decorative bottom border */}
            <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-r from-dl-grey via-dl-grey-light to-dl-grey"></div>
          </div>
        </div>
      </div>

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-2 sm:pt-3 pb-8 sm:pb-12">
        {!isApproved && (
          <div className="mb-8 bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-dl-yellow rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-dl-yellow rounded-xl flex-shrink-0">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-dl-grey mb-2">Account Pending Approval</h3>
                <p className="text-base text-dl-grey-light leading-relaxed">
                  Your account is currently under review. You will be able to place bids once your account is approved by our team.
                </p>
              </div>
            </div>
          </div>
        )}


        {loading ? (
          <div className="text-center py-32">
            <div className="inline-block animate-spin rounded-full h-20 w-20 border-4 border-slate-200 border-t-dl-red"></div>
            <p className="mt-8 text-xl text-dl-grey font-semibold">Loading used vehicles...</p>
            <p className="mt-2 text-dl-grey-light">Please wait while we fetch the latest auctions</p>
          </div>
        ) : !isApproved ? (
          // Don't show "No Active Auctions" for unapproved users - they already see the approval pending message above
          null
        ) : cars.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl shadow-xl border-2 border-dashed border-slate-300">
            <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Car className="w-16 h-16 text-slate-400" />
            </div>
            <h3 className="text-3xl font-bold text-dl-grey mb-4">No Active Auctions</h3>
            <p className="text-lg text-dl-grey-light max-w-md mx-auto">There are no vehicles available for bidding at the moment. New auctions will be posted soon!</p>
          </div>
        ) : (
          <>
            {/* Bulk Bid Information Banner */}
            {showBulkBidInfo && cars.length > 0 && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg shadow-sm overflow-hidden">
                <div className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Sparkles className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <p className="text-xs sm:text-sm text-green-800">
                        <strong>Bulk Bid:</strong> Select multiple vehicles and use the <strong className="text-green-900">"Bulk Bid"</strong> button on the right to place bids on all selected cars at once.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowBulkBidInfo(false)}
                      className="flex-shrink-0 p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded transition-colors"
                      aria-label="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

          <EnhancedCarGrid 
            cars={filteredBySearch} 
            onBidPlaced={loadActiveCars}
            externalViewMode={viewMode}
            externalShowFilters={showFilters}
            onViewModeChange={setViewMode}
            onFilterToggle={() => setShowFilters(!showFilters)}
            onSelectAllToggle={() => {
              const event = new CustomEvent('selectAllToggle');
              window.dispatchEvent(event);
            }}
            onSelectionChange={(selectedCount, totalCount) => {
              setAllSelected(selectedCount === totalCount && totalCount > 0);
            }}
          />
          <          />
        )}
      </main>

    </div>
  );
}

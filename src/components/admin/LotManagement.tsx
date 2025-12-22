import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, Clock, Eye, X, Trash2, Upload, Download, CheckSquare, Square, Filter, X as XIcon, Edit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../contexts/NotificationContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { LotApprovalModal } from './LotApprovalModal';
import { LotDetailsModal } from './LotDetailsModal';
import { LotEditModal } from './LotEditModal';
import { ExcelUploadModal } from './ExcelUploadModal';
import { ExportModal } from './ExportModal';
import * as XLSX from 'xlsx';

interface LotManagementProps {
  onDataChange?: () => void;
}

export function LotManagement({ onDataChange }: LotManagementProps = {}) {
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [selectedLot, setSelectedLot] = useState<any | null>(null);
  const [approvalLot, setApprovalLot] = useState<any | null>(null);
  const [editLot, setEditLot] = useState<any | null>(null);
  const [deleteLot, setDeleteLot] = useState<any | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: 'All',
    lotNumber: '',
    startDateFrom: '',
    startDateTo: '',
  });
  const { showSuccess, showError } = useNotification();
  const confirm = useConfirm();

  useEffect(() => {
    // Refresh car and lot statuses on load to ensure they're up to date
    // Silently fail if RPC doesn't exist or user doesn't have permission (403)
    const refreshStatuses = async () => {
      try {
        const { error } = await supabase.rpc('refresh_car_statuses');
        if (error) {
          // Only log if it's not a permission/not found error (403, PGRST301, etc.)
          if (error.code !== 'PGRST301' && error.code !== '42501' && error.status !== 403 && !error.message.includes('permission denied') && !error.message.includes('does not exist')) {
            console.error('Error refreshing statuses:', error);
          }
        }
      } catch (error: any) {
        // Silently ignore 403 and permission errors
        if (error?.status !== 403 && error?.code !== 'PGRST301' && error?.code !== '42501' && !error?.message?.includes('permission denied')) {
          console.error('Error refreshing statuses:', error);
        }
      }
    };
    
    refreshStatuses();
    loadLots();
    
    // Subscribe to real-time changes for lots
    const subscription = supabase
      .channel('lots-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots' }, () => {
        loadLots();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadLots = async () => {
    const { data, error } = await supabase
      .from('lots')
      .select('*, uploaded_by:admin_users!uploaded_by(name), approved_by:admin_users!approved_by(name)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Load cars and bids for each lot to calculate statistics
      const lotIds = data.map(l => l.id);
      
      // Load all cars for these lots
      const { data: carsData } = await supabase
        .from('cars')
        .select('id, lot_id')
        .in('lot_id', lotIds.length > 0 ? lotIds : [null]);

      const carIds = carsData?.map(c => c.id) || [];
      
      // Load all bids for these cars
      let bidsData: any[] = [];
      if (carIds.length > 0) {
        const { data: bids } = await supabase
          .from('bids')
          .select('id, car_id, amount')
          .in('car_id', carIds);
        bidsData = bids || [];
      }

      // Calculate statistics for each lot
      const lotsWithStats = data.map(lot => {
        const lotCars = carsData?.filter(c => c.lot_id === lot.id) || [];
        const lotCarIds = lotCars.map(c => c.id);
        const lotBids = bidsData.filter(b => lotCarIds.includes(b.car_id));
        const totalBids = lotBids.length;
        const highestBid = lotBids.length > 0 ? Math.max(...lotBids.map(b => b.amount || 0)) : 0;

        return {
          ...lot,
          totalCars: lotCars.length,
          totalBids,
          highestBid,
        };
      });

      setLots(lotsWithStats);
    }
    setLoading(false);
  };

  const handleApprove = async (lotId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: adminData } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!adminData) return;

    // Update status to 'Approved' when approving
    const { error } = await supabase
      .from('lots')
      .update({
        approved: true,
        approved_by: adminData.id,
        approved_at: new Date().toISOString(),
        status: 'Approved',
      })
      .eq('id', lotId);

    if (!error) {
      loadLots();
      if (onDataChange) onDataChange();
    } else {
      console.error('Error approving lot:', error);
      showError('Approval Failed', `Error approving lot: ${error.message}`);
    }
  };

  const handleEarlyClose = async (lotId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: adminData } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!adminData) return;

    // Update lot status first
    const { error } = await supabase
      .from('lots')
      .update({
        early_closed: true,
        early_closed_by: adminData.id,
        early_closed_at: new Date().toISOString(),
        status: 'Early Closed',
      })
      .eq('id', lotId);

    if (!error) {
      // The database trigger will automatically close all cars in this lot
      // But we can also explicitly update them to ensure consistency
      await supabase
        .from('cars')
        .update({ 
          status: 'Closed',
          updated_at: new Date().toISOString()
        })
        .eq('lot_id', lotId)
        .neq('status', 'Closed');
      
      loadLots();
      if (onDataChange) onDataChange();
    }
  };

  const handleDeleteLot = async (lotId: string) => {
    try {
      // First, get the count of cars and related data in this lot
      const { data: carsData, error: carsError } = await supabase
        .from('cars')
        .select('id')
        .eq('lot_id', lotId);

      if (carsError) {
        showError('Error', `Error checking vehicles: ${carsError.message}`);
        return;
      }

      const carCount = carsData?.length || 0;
      const carIds = carsData?.map(c => c.id) || [];

      // Get count of bids that will be deleted (cascade from cars)
      let bidCount = 0;
      if (carIds.length > 0) {
        const { count } = await supabase
          .from('bids')
          .select('*', { count: 'exact', head: true })
          .in('car_id', carIds);
        bidCount = count || 0;
      }

      // Get count of questions that will be deleted (cascade from lot/cars)
      const { count: questionCount } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('lot_id', lotId);
      
      const totalQuestionCount = questionCount || 0;

      // Delete the lot (cars, bids, and questions will be cascade deleted)
      const { error } = await supabase
        .from('lots')
        .delete()
        .eq('id', lotId);

      if (error) {
        console.error('Delete error:', error);
        showError('Delete Failed', `Error deleting lot: ${error.message}`);
        return;
      }

      // Build success message
      let message = `Deleted:\n`;
      message += `- ${carCount} vehicle(s)\n`;
      if (bidCount > 0) {
        message += `- ${bidCount} bid(s)\n`;
      }
      if (totalQuestionCount > 0) {
        message += `- ${totalQuestionCount} question(s)\n`;
      }

      showSuccess('Lot Deleted Successfully', message);
      loadLots();
      setDeleteLot(null);

      // Trigger a page refresh or reload car list if there's a callback
      // This will be handled by the parent component if needed
      window.dispatchEvent(new CustomEvent('lotDeleted', { detail: { lotId } }));
    } catch (error: any) {
      console.error('Unexpected error deleting lot:', error);
      showError('Unexpected Error', `An unexpected error occurred: ${error.message || 'Unknown error'}`);
    }
  };

  const toggleLotSelection = (lotId: string) => {
    const newSelected = new Set(selectedLots);
    if (newSelected.has(lotId)) {
      newSelected.delete(lotId);
    } else {
      newSelected.add(lotId);
    }
    setSelectedLots(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedLots.size === filteredLots.length) {
      setSelectedLots(new Set());
    } else {
      setSelectedLots(new Set(filteredLots.map(l => l.id)));
    }
  };

  const handleExportLotDetails = async () => {
    if (selectedLots.size === 0) {
      showError('No Selection', 'Please select at least one lot to export');
      return;
    }

    const selectedLotIds = Array.from(selectedLots);
    const selectedLotsData = filteredLots.filter(l => selectedLotIds.includes(l.id));

    // Load all cars from selected lots
    const { data: carsData } = await supabase
      .from('cars')
      .select('*, lot:lots(id, lot_number)')
      .in('lot_id', selectedLotIds);

    const carIds = carsData?.map(c => c.id) || [];

    // Load all bids for these cars with user information
    let bidsData: any[] = [];
    if (carIds.length > 0) {
      const { data } = await supabase
        .from('bids')
        .select(`
          *,
          users (name, email, phone),
          cars (id, make_model, reg_no, lot:lots(lot_number))
        `)
        .in('car_id', carIds)
        .order('created_at', { ascending: false });

      bidsData = data || [];
    }

    // Group bids by car
    const bidsByCar: Record<string, any[]> = {};
    bidsData.forEach(bid => {
      if (!bidsByCar[bid.car_id]) {
        bidsByCar[bid.car_id] = [];
      }
      bidsByCar[bid.car_id].push(bid);
    });

    // Create export data
    const exportData: any[] = [];

    selectedLotsData.forEach(lot => {
      const lotCars = carsData?.filter(c => c.lot_id === lot.id) || [];
      
      if (lotCars.length === 0) {
        // Export lot info even if no cars
        exportData.push({
          'Lot Number': lot.lot_number,
          'Lot Name': lot.name || '-',
          'Lot Status': lot.status,
          'Bidding Start': lot.bidding_start_date ? new Date(lot.bidding_start_date).toLocaleString() : '-',
          'Bidding End': lot.bidding_end_date ? new Date(lot.bidding_end_date).toLocaleString() : '-',
          'Car ID': '-',
          'Make/Model': '-',
          'Registration No': '-',
          'Year': '-',
          'KM': '-',
          'Location': '-',
          'Status': '-',
          'Bidder Name': '-',
          'Bidder Email': '-',
          'Bidder Phone': '-',
          'Bid Date': '-',
          'Total Bids': 0,
        });
      } else {
        lotCars.forEach(car => {
          const carBids = bidsByCar[car.id] || [];
          
          if (carBids.length === 0) {
            exportData.push({
              'Lot Number': lot.lot_number,
              'Lot Name': lot.name || '-',
              'Lot Status': lot.status,
              'Bidding Start': lot.bidding_start_date ? new Date(lot.bidding_start_date).toLocaleString() : '-',
              'Bidding End': lot.bidding_end_date ? new Date(lot.bidding_end_date).toLocaleString() : '-',
              'Car ID': car.id,
              'Make/Model': car.make_model,
              'Registration No': car.reg_no || '-',
              'Year': car.year || '-',
              'KM': car.km || '-',
              'Location': car.location || '-',
              'Status': car.status || '-',
              'Bidder Name': '-',
              'Bidder Email': '-',
              'Bidder Phone': '-',
              'Bid Date': '-',
              'Total Bids': 0,
            });
          } else {
            carBids.forEach((bid, index) => {
              exportData.push({
                'Lot Number': lot.lot_number,
                'Lot Name': lot.name || '-',
                'Lot Status': lot.status,
                'Bidding Start': lot.bidding_start_date ? new Date(lot.bidding_start_date).toLocaleString() : '-',
                'Bidding End': lot.bidding_end_date ? new Date(lot.bidding_end_date).toLocaleString() : '-',
                'Car ID': car.id,
                'Make/Model': car.make_model,
                'Registration No': car.reg_no || '-',
                'Year': car.year || '-',
                'KM': car.km || '-',
                'Location': car.location || '-',
                'Status': car.status || '-',
                'Bidder Name': bid.users?.name || '-',
                'Bidder Email': bid.users?.email || '-',
                'Bidder Phone': bid.users?.phone || '-',
                'Bid Date': new Date(bid.created_at).toLocaleString(),
                'Total Bids': carBids.length,
              });
            });
          }
        });
      }
    });

    // Export to Excel
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lot Bidding Details');
    XLSX.writeFile(wb, `lot_bidding_details_${selectedLots.size}_lots_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    alert(`Exported bidding details for ${selectedLots.size} lot(s) with ${exportData.length} record(s)`);
    setSelectedLots(new Set());
  };

  const filteredLots = useMemo(() => {
    return lots.filter(lot => {
      if (filters.status !== 'All' && lot.status !== filters.status) {
        return false;
      }
      if (filters.lotNumber && !lot.lot_number?.toLowerCase().includes(filters.lotNumber.toLowerCase())) {
        return false;
      }
      if (filters.startDateFrom && lot.bidding_start_date) {
        const startDate = new Date(lot.bidding_start_date);
        const fromDate = new Date(filters.startDateFrom);
        if (startDate < fromDate) return false;
      }
      if (filters.startDateTo && lot.bidding_start_date) {
        const startDate = new Date(lot.bidding_start_date);
        const toDate = new Date(filters.startDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (startDate > toDate) return false;
      }
      return true;
    });
  }, [lots, filters]);

  const clearFilters = () => {
    setFilters({
      status: 'All',
      lotNumber: '',
      startDateFrom: '',
      startDateTo: '',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Approved': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Active': return 'bg-green-100 text-green-800 border-green-200';
      case 'Closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Early Closed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-dl-red"></div>
        <p className="mt-4 text-slate-600">Loading lots...</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Lot Management</h2>
              <p className="text-sm sm:text-base text-slate-600 mt-1">Manage and approve lots for bidding</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                  showFilters
                    ? 'bg-dl-red text-white hover:bg-dl-red-hover'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>
              <ExcelUploadButton onComplete={() => {
                loadLots();
                if (onDataChange) onDataChange();
              }} />
              <ExportButton />
              {selectedLots.size > 0 && (
                <>
                  <button
                    onClick={handleExportLotDetails}
                    className="flex items-center gap-2 px-4 py-2 bg-dl-grey-bg text-dl-grey border-2 border-dl-grey-medium hover:bg-dl-grey-light hover:text-white hover:border-dl-grey rounded-lg transition-all duration-200 text-sm font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export Selected ({selectedLots.size})</span>
                    <span className="sm:hidden">Export ({selectedLots.size})</span>
                  </button>
                  <button
                    onClick={() => setSelectedLots(new Set())}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Advanced Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                  >
                    <option value="All">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                    <option value="Early Closed">Early Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Lot Number</label>
                  <input
                    type="text"
                    placeholder="Search lot number..."
                    value={filters.lotNumber}
                    onChange={(e) => setFilters({ ...filters, lotNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Bidding Start Date From</label>
                  <input
                    type="date"
                    value={filters.startDateFrom}
                    onChange={(e) => setFilters({ ...filters, startDateFrom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Bidding Start Date To</label>
                  <input
                    type="date"
                    value={filters.startDateTo}
                    onChange={(e) => setFilters({ ...filters, startDateTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedLots.size > 0 && (
          <div className="bg-green-50 border-b border-green-200 px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-900">
                {selectedLots.size} lot{selectedLots.size !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle px-4 sm:px-0">
            <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    {selectedLots.size === filteredLots.length && filteredLots.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-dl-red" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Lot Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Bidding Period</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Vehicles</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase hidden md:table-cell">Bids</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Uploaded</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLots.map((lot) => (
                <tr key={lot.id} className={`hover:bg-slate-50 transition-colors ${selectedLots.has(lot.id) ? 'bg-green-50' : ''}`}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleLotSelection(lot.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      {selectedLots.has(lot.id) ? (
                        <CheckSquare className="w-5 h-5 text-green-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{lot.lot_number}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md border ${getStatusColor(lot.status)}`}>
                      {lot.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {lot.bidding_start_date && lot.bidding_end_date ? (
                      <div className="text-xs">
                        <div>{new Date(lot.bidding_start_date).toLocaleString('en-US', { timeZone: 'Asia/Dubai', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="text-slate-500">to</div>
                        <div>{new Date(lot.bidding_end_date).toLocaleString('en-US', { timeZone: 'Asia/Dubai', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{lot.totalCars || 0}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">{lot.totalBids || 0}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(lot.created_at).toLocaleString('en-US', { timeZone: 'Asia/Dubai', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedLot(lot)}
                        className="p-2 text-dl-red hover:bg-dl-grey-bg rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditLot(lot)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Edit Lot"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {!lot.approved && (
                        <button
                          onClick={() => setApprovalLot(lot)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Approve Lot"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {(lot.status === 'Active' || lot.status === 'Approved') && !lot.early_closed && (
                        <button
                          onClick={() => handleEarlyClose(lot.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Early Close"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteLot(lot)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Lot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {selectedLot && (
        <LotDetailsModal
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
          onUpdate={loadLots}
        />
      )}

      {approvalLot && (
        <LotApprovalModal
          lot={approvalLot}
          onClose={async () => {
            setApprovalLot(null);
            await loadLots(); // Refresh list when closing
          }}
          onApprove={async () => {
            const lotId = approvalLot.id;
            setApprovalLot(null);
            await loadLots(); // Refresh list after approval
            // Also trigger a custom event to refresh car list and stats
            window.dispatchEvent(new CustomEvent('lotApproved', { detail: { lotId } }));
          }}
        />
      )}

      {editLot && (
        <LotEditModal
          lot={editLot}
          onClose={async () => {
            setEditLot(null);
            await loadLots(); // Refresh list when closing
          }}
          onUpdate={async () => {
            await loadLots(); // Refresh list after update
            // Also trigger a custom event to refresh car list and stats
            window.dispatchEvent(new CustomEvent('lotUpdated', { detail: { lotId: editLot.id } }));
          }}
        />
      )}

      {deleteLot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Delete Lot</h3>
                <p className="text-sm text-slate-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-slate-700 mb-2">
                Are you sure you want to delete lot <span className="font-bold">{deleteLot.lot_number}</span>?
              </p>
              <p className="text-sm text-red-600 font-medium">
                ⚠️ This will permanently delete the lot and ALL vehicles associated with it.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteLot(null)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLot(deleteLot.id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Lot
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Helper component for Upload button
function ExcelUploadButton({ onComplete }: { onComplete: () => void }) {
  const [showModal, setShowModal] = useState(false);
  
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors text-sm"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Import Excel</span>
        <span className="sm:hidden">Import</span>
      </button>
      {showModal && (
        <ExcelUploadModal
          onClose={() => setShowModal(false)}
          onComplete={() => {
            setShowModal(false);
            onComplete();
          }}
        />
      )}
    </>
  );
}

// Helper component for Export button
function ExportButton() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-dl-grey-bg text-dl-grey border-2 border-dl-grey-medium hover:bg-dl-grey-light hover:text-white hover:border-dl-grey rounded-lg transition-all duration-200 text-sm font-semibold"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Export</span>
        <span className="sm:hidden">Export</span>
      </button>
      {showModal && (
        <ExportModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}


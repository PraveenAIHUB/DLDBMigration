import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, User, Building, Filter, Edit2, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../contexts/NotificationContext';
import { useConfirm } from '../../contexts/ConfirmContext';

interface BidderApprovalManagementProps {
  onUpdate: () => void;
}

export function BidderApprovalManagement({ onUpdate }: BidderApprovalManagementProps) {
  const [bidders, setBidders] = useState<any[]>([]);
  const [allBidders, setAllBidders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [savingNameId, setSavingNameId] = useState<string | null>(null);
  const { confirm: confirmAction } = useConfirm();
  const [advancedFilters, setAdvancedFilters] = useState({
    name: '',
    email: '',
    phone: '',
    registeredDateFrom: '',
    registeredDateTo: '',
  });
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadBidders();
  }, []);

  const filteredBidders = useMemo(() => {
    return allBidders.filter(bidder => {
      // Apply status filter
      if (filter === 'pending') {
        if (bidder.approved) return false;
      } else if (filter === 'approved') {
        if (!bidder.approved) return false;
      }
      
      // Apply search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesName = bidder.name?.toLowerCase().includes(search);
        const matchesEmail = bidder.email?.toLowerCase().includes(search);
        const matchesPhone = bidder.phone?.toLowerCase().includes(search);
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }
      
      // Apply advanced filters
      if (advancedFilters.name && !bidder.name?.toLowerCase().includes(advancedFilters.name.toLowerCase())) {
        return false;
      }
      if (advancedFilters.email && !bidder.email?.toLowerCase().includes(advancedFilters.email.toLowerCase())) {
        return false;
      }
      if (advancedFilters.phone && !bidder.phone?.toLowerCase().includes(advancedFilters.phone.toLowerCase())) {
        return false;
      }
      if (advancedFilters.registeredDateFrom) {
        const registeredDate = new Date(bidder.created_at);
        const fromDate = new Date(advancedFilters.registeredDateFrom);
        if (registeredDate < fromDate) return false;
      }
      if (advancedFilters.registeredDateTo) {
        const registeredDate = new Date(bidder.created_at);
        const toDate = new Date(advancedFilters.registeredDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (registeredDate > toDate) return false;
      }
      
      return true;
    });
  }, [allBidders, filter, searchTerm, advancedFilters]);

  const loadBidders = async () => {
    // First, try to get all users (bidders are users who are not admins or business users)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Filter to show bidders:
      // 1. Users with role = 'bidder'
      // 2. Users without role set (legacy users)
      // 3. Exclude users that are in admin_users or business_users tables
      const { data: adminUsers } = await supabase
        .from('admin_users')
        .select('id');
      
      const { data: businessUsers } = await supabase
        .from('business_users')
        .select('id');
      
      const adminIds = new Set(adminUsers?.map(a => a.id) || []);
      const businessIds = new Set(businessUsers?.map(b => b.id) || []);
      
      const biddersList = data.filter(u => {
        // Exclude admins and business users
        if (adminIds.has(u.id) || businessIds.has(u.id)) return false;
        
        // Include if role is 'bidder' or role is null/undefined
        if (u.role === 'bidder' || !u.role) return true;
        
        return false;
      });
      
      setAllBidders(biddersList);
      setBidders(biddersList);
    } else if (error) {
      console.error('Error loading bidders:', error);
      showError('Loading Error', `Error loading bidders: ${error.message}`);
    }
    setLoading(false);
  };

  const handleApprove = async (bidderId: string) => {
    if (approvingId) return; // Prevent double-clicks
    
    setApprovingId(bidderId);
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Auth error:', authError);
        showError('Authentication Required', 'You must be logged in to approve bidders.');
        setApprovingId(null);
        return;
      }

      console.log('Current user:', user.email);

      // Get admin user ID
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (adminError) {
        console.error('Admin lookup error:', adminError);
        showError('Verification Error', `Could not verify admin status. ${adminError.message}`);
        setApprovingId(null);
        return;
      }

      if (!adminData) {
        showError('Unauthorized', 'You are not authorized as an admin.');
        setApprovingId(null);
        return;
      }

      console.log('Admin ID:', adminData.id);
      console.log('Approving bidder ID:', bidderId);

      // Update the user
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({
          approved: true,
          approved_by: adminData.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', bidderId)
        .select();

      if (updateError) {
        console.error('Update error:', updateError);
        console.error('Error details:', JSON.stringify(updateError, null, 2));
        showError('Approval Failed', `Error approving bidder: ${updateError.message}\n\nCode: ${updateError.code}`);
        setApprovingId(null);
        return;
      }

      console.log('Update successful:', updateData);

      // Reload bidders list
      await loadBidders();
      
      // Update stats in parent component
      if (onUpdate) {
        onUpdate();
      }

      // Show success message
      showSuccess('Bidder Approved', 'Bidder approved successfully!');
      
    } catch (error: any) {
      console.error('Unexpected error:', error);
      showError('Unexpected Error', `An unexpected error occurred: ${error.message || 'Unknown error'}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (bidderId: string) => {
    const confirmed = await confirmAction({
      title: 'Reject Bidder',
      message: 'Are you sure you want to reject this bidder? This action cannot be undone.',
      confirmText: 'Reject',
      cancelText: 'Cancel',
      type: 'danger',
    });
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', bidderId);

      if (error) {
        console.error('Delete error:', error);
        showError('Rejection Failed', `Error rejecting bidder: ${error.message}`);
        return;
      }

      // Reload bidders list
      await loadBidders();
      
      // Update stats in parent component
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      showError('Unexpected Error', `An unexpected error occurred: ${error.message || 'Unknown error'}`);
    }
  };

  const handleEditName = (bidder: any) => {
    setEditingNameId(bidder.id);
    setEditingNameValue(bidder.name || '');
  };

  const handleCancelEditName = () => {
    setEditingNameId(null);
    setEditingNameValue('');
  };

  const handleSaveName = async (bidderId: string) => {
    if (!editingNameValue.trim()) {
      showError('Validation Error', 'Name cannot be empty.');
      return;
    }

    setSavingNameId(bidderId);

    try {
      const { error } = await supabase
        .from('users')
        .update({ name: editingNameValue.trim() })
        .eq('id', bidderId);

      if (error) {
        console.error('Update error:', error);
        showError('Update Failed', `Error updating name: ${error.message}`);
        setSavingNameId(null);
        return;
      }

      showSuccess('Name Updated', 'Customer name updated successfully.');
      
      // Reload bidders list
      await loadBidders();
      
      // Update stats in parent component
      if (onUpdate) {
        onUpdate();
      }

      // Reset editing state
      setEditingNameId(null);
      setEditingNameValue('');
    } catch (error: any) {
      console.error('Unexpected error:', error);
      showError('Unexpected Error', `An unexpected error occurred: ${error.message || 'Unknown error'}`);
    } finally {
      setSavingNameId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-blue-600"></div>
        <p className="mt-4 text-slate-600">Loading bidders...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Bidder Approval</h2>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Review and approve bidder registrations</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'pending'
                  ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Pending ({allBidders.filter(b => !b.approved).length})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'approved'
                  ? 'bg-green-100 text-green-800 border-2 border-green-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Approved ({allBidders.filter(b => b.approved).length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({allBidders.length})
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showFilters
                  ? 'bg-dl-red text-white hover:bg-dl-red-hover'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Advanced
            </button>
          </div>
        </div>
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
          />
        </div>
        {showFilters && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Advanced Filters</h3>
              <button
                onClick={() => {
                  setAdvancedFilters({
                    name: '',
                    email: '',
                    phone: '',
                    registeredDateFrom: '',
                    registeredDateTo: '',
                  });
                }}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="Filter by name..."
                  value={advancedFilters.name}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="text"
                  placeholder="Filter by email..."
                  value={advancedFilters.email}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="Filter by phone..."
                  value={advancedFilters.phone}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Registered From</label>
                <input
                  type="date"
                  value={advancedFilters.registeredDateFrom}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, registeredDateFrom: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Registered To</label>
                <input
                  type="date"
                  value={advancedFilters.registeredDateTo}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, registeredDateTo: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Registered</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredBidders.map((bidder) => (
              <tr key={bidder.id} className={`hover:bg-slate-50 transition-colors ${!bidder.approved ? 'bg-yellow-50' : ''}`}>
                <td className="px-4 py-3">
                  {bidder.user_type === 'organization' ? (
                    <Building className="w-5 h-5 text-slate-600" />
                  ) : (
                    <User className="w-5 h-5 text-slate-600" />
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingNameId === bidder.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingNameValue}
                        onChange={(e) => setEditingNameValue(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                        placeholder="Enter name"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveName(bidder.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEditName();
                          }
                        }}
                      />
                      <button
                        onClick={() => handleSaveName(bidder.id)}
                        disabled={savingNameId === bidder.id || !editingNameValue.trim()}
                        className={`p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors ${
                          savingNameId === bidder.id || !editingNameValue.trim() ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Save"
                      >
                        {savingNameId === bidder.id ? (
                          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={handleCancelEditName}
                        disabled={savingNameId === bidder.id}
                        className={`p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
                          savingNameId === bidder.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{bidder.name}</span>
                      <button
                        onClick={() => handleEditName(bidder)}
                        className="p-1 text-slate-400 hover:text-dl-red hover:bg-slate-100 rounded transition-colors"
                        title="Edit Name (Admin Only)"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{bidder.email}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{bidder.phone}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                    bidder.approved
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {bidder.approved ? 'Approved' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {new Date(bidder.created_at).toLocaleString('en-US', { timeZone: 'Asia/Dubai', month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  {!bidder.approved ? (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleApprove(bidder.id)}
                        disabled={approvingId === bidder.id}
                        className={`p-2 text-dl-red hover:bg-red-50 rounded-lg transition-colors ${
                          approvingId === bidder.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Approve"
                      >
                        {approvingId === bidder.id ? (
                          <div className="w-4 h-4 border-2 border-dl-red border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleReject(bidder.id)}
                        disabled={!!approvingId}
                        className={`p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
                          approvingId ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Approved</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}


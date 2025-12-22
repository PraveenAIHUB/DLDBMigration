import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, User, Filter, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useConfirm } from '../../contexts/ConfirmContext';
import { BusinessUserModal } from './BusinessUserModal';

export function BusinessUserManagement() {
  const [businessUsers, setBusinessUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    name: '',
    email: '',
    phone: '',
    createdDateFrom: '',
    createdDateTo: '',
  });
  const confirm = useConfirm();

  useEffect(() => {
    loadBusinessUsers();
  }, []);

  const loadBusinessUsers = async () => {
    const { data, error } = await supabase
      .from('business_users')
      .select('*, created_by:admin_users!created_by(name)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBusinessUsers(data);
    }
    setLoading(false);
  };

  const filteredUsers = useMemo(() => {
    return businessUsers.filter(user => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!user.name?.toLowerCase().includes(term) &&
            !user.email?.toLowerCase().includes(term) &&
            !user.phone?.toLowerCase().includes(term)) {
          return false;
        }
      }
      if (filters.name && !user.name?.toLowerCase().includes(filters.name.toLowerCase())) {
        return false;
      }
      if (filters.email && !user.email?.toLowerCase().includes(filters.email.toLowerCase())) {
        return false;
      }
      if (filters.phone && !user.phone?.toLowerCase().includes(filters.phone.toLowerCase())) {
        return false;
      }
      if (filters.createdDateFrom) {
        const createdDate = new Date(user.created_at);
        const fromDate = new Date(filters.createdDateFrom);
        if (createdDate < fromDate) return false;
      }
      if (filters.createdDateTo) {
        const createdDate = new Date(user.created_at);
        const toDate = new Date(filters.createdDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (createdDate > toDate) return false;
      }
      return true;
    });
  }, [businessUsers, searchTerm, filters]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      name: '',
      email: '',
      phone: '',
      createdDateFrom: '',
      createdDateTo: '',
    });
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Business User',
      message: 'Are you sure you want to delete this business user? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
    });
    
    if (!confirmed) return;

    const { error } = await supabase
      .from('business_users')
      .delete()
      .eq('id', id);

    if (!error) {
      loadBusinessUsers();
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-blue-600"></div>
        <p className="mt-4 text-slate-600">Loading business users...</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Business Users</h2>
              <p className="text-slate-600 mt-1">Manage Used Car Team members</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showFilters
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setShowModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Business User
              </button>
            </div>
          </div>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
          </div>
          {showFilters && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    placeholder="Filter by name..."
                    value={filters.name}
                    onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="text"
                    placeholder="Filter by email..."
                    value={filters.email}
                    onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="Filter by phone..."
                    value={filters.phone}
                    onChange={(e) => setFilters({ ...filters, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Created From</label>
                  <input
                    type="date"
                    value={filters.createdDateFrom}
                    onChange={(e) => setFilters({ ...filters, createdDateFrom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Created To</label>
                  <input
                    type="date"
                    value={filters.createdDateTo}
                    onChange={(e) => setFilters({ ...filters, createdDateTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Created By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Created At</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{user.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{user.phone || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{user.created_by?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(user.created_at).toLocaleString('en-US', { timeZone: 'Asia/Dubai', month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
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

      {showModal && (
        <BusinessUserModal
          user={selectedUser}
          onClose={() => {
            setShowModal(false);
            setSelectedUser(null);
          }}
          onSuccess={loadBusinessUsers}
        />
      )}
    </>
  );
}


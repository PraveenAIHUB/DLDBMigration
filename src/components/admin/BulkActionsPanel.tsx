import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../contexts/NotificationContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Calendar, Eye, EyeOff, X, Trash2 } from 'lucide-react';

interface BulkActionsPanelProps {
  selectedCount: number;
  selectedCarIds: string[];
  onUpdate: () => void;
  onClear: () => void;
}

// Convert Dubai local datetime-local to UTC for database
const toUTC = (localDateTime: string) => {
  if (!localDateTime) return null;
  
  // Parse the datetime-local string (treat as Dubai timezone)
  const [datePart, timePart] = localDateTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  // Create date string in ISO format for Dubai timezone
  // Dubai is UTC+4, so we need to subtract 4 hours to get UTC
  const dubaiDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const utcDate = new Date(dubaiDate.getTime() - (4 * 60 * 60 * 1000)); // Subtract 4 hours
  
  return utcDate.toISOString();
};

export function BulkActionsPanel({ selectedCount, selectedCarIds, onUpdate, onClear }: BulkActionsPanelProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { showSuccess, showError, showWarning } = useNotification();
  const confirm = useConfirm();

  const handleBulkAction = async (action: 'enable' | 'disable' | 'dates') => {
    setLoading(true);
    try {
      if (action === 'enable') {
        await supabase
          .from('cars')
          .update({ bidding_enabled: true })
          .in('id', selectedCarIds);
      } else if (action === 'disable') {
        await supabase
          .from('cars')
          .update({ bidding_enabled: false })
          .in('id', selectedCarIds);
      } else if (action === 'dates') {
        if (!startDate || !endDate) {
          showWarning('Missing Dates', 'Please select both start and end dates');
          setLoading(false);
          return;
        }
        await supabase
          .from('cars')
          .update({
            bidding_start_date: toUTC(startDate),
            bidding_end_date: toUTC(endDate),
          })
          .in('id', selectedCarIds);
      }
      onUpdate();
      if (action === 'dates') {
        setStartDate('');
        setEndDate('');
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      showError('Update Failed', 'Failed to update cars. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('cars')
        .delete()
        .in('id', selectedCarIds);

      if (error) {
        showError('Delete Failed', `Error deleting vehicles: ${error.message}`);
      } else {
        showSuccess('Vehicles Deleted', `${selectedCarIds.length} vehicle(s) deleted successfully.`);
        onUpdate();
        setShowDeleteConfirm(false);
        onClear();
      }
    } catch (error) {
      console.error('Delete error:', error);
      showError('Delete Failed', 'Failed to delete vehicles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-dl-grey-bg border-y border-dl-grey-medium p-3 sm:p-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-semibold text-slate-900 text-sm sm:text-base">
            {selectedCount} car{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onClear}
            className="text-slate-700 hover:text-slate-900 text-xs sm:text-sm font-medium flex items-center gap-1"
          >
            <X className="w-3 h-3 sm:w-4 sm:h-4" />
            Clear
          </button>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm"
              placeholder="Start Date"
            />
            <span className="text-slate-700 text-center sm:text-left hidden sm:inline">to</span>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm"
              placeholder="End Date"
            />
            <button
              onClick={() => handleBulkAction('dates')}
              disabled={loading || !startDate || !endDate}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50 text-xs sm:text-sm"
            >
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Set Dates</span>
              <span className="sm:hidden">Dates</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('enable')}
              disabled={loading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50 text-xs sm:text-sm"
            >
              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Enable</span>
            </button>
            <button
              onClick={() => handleBulkAction('disable')}
              disabled={loading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-xs sm:text-sm"
            >
              <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Disable</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors disabled:opacity-50 text-xs sm:text-sm"
            >
              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Delete</span>
              <span className="sm:hidden">Del</span>
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-4 sm:p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Delete Vehicles</h3>
                <p className="text-sm text-slate-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-slate-700 mb-2">
                Are you sure you want to delete <span className="font-bold">{selectedCount}</span> selected vehicle{selectedCount !== 1 ? 's' : ''}?
              </p>
              <p className="text-sm text-red-600 font-medium">
                ⚠️ This will permanently delete the selected vehicle(s) and all associated bids.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete Vehicles'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

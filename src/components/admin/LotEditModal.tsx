import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dubaiLocalToUTC, toDubaiLocalDateTime, getDubaiLocalInputNow } from '../../utils/dateUtils';

interface LotEditModalProps {
  lot: any;
  onClose: () => void;
  onUpdate: () => void;
}

export function LotEditModal({ lot, onClose, onUpdate }: LotEditModalProps) {
  const [lotNumber, setLotNumber] = useState(lot.lot_number || '');
  const [biddingStartDate, setBiddingStartDate] = useState('');
  const [biddingEndDate, setBiddingEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // When the modal opens, pre-fill the dates with current lot dates
  useEffect(() => {
    if (lot?.bidding_start_date) {
      setBiddingStartDate(toDubaiLocalDateTime(lot.bidding_start_date));
    } else {
      setBiddingStartDate(getDubaiLocalInputNow());
    }

    if (lot?.bidding_end_date) {
      setBiddingEndDate(toDubaiLocalDateTime(lot.bidding_end_date));
    } else {
      setBiddingEndDate(getDubaiLocalInputNow(60));
    }
  }, [lot?.bidding_start_date, lot?.bidding_end_date, lot?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!lotNumber.trim()) {
      setError('Lot number is required');
      setLoading(false);
      return;
    }

    if (!biddingStartDate || !biddingEndDate) {
      setError('Both bidding start and end dates are required');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to edit lots');
        setLoading(false);
        return;
      }

      const { data: adminData } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!adminData) {
        setError('You are not authorized as an admin');
        setLoading(false);
        return;
      }

      // Convert Dubai timezone to UTC
      const startUTC = dubaiLocalToUTC(biddingStartDate);
      const endUTC = dubaiLocalToUTC(biddingEndDate);
      
      if (!startUTC || !endUTC) {
        setError('Error converting dates. Please check the date format.');
        setLoading(false);
        return;
      }

      // Validate that end date is after start date
      if (new Date(endUTC) <= new Date(startUTC)) {
        setError('Bidding end date must be after bidding start date');
        setLoading(false);
        return;
      }

      // Check if lot number is already taken by another lot
      if (lotNumber.trim() !== lot.lot_number) {
        const { data: existingLot } = await supabase
          .from('lots')
          .select('id')
          .eq('lot_number', lotNumber.trim())
          .neq('id', lot.id)
          .maybeSingle();

        if (existingLot) {
          setError('Lot number already exists. Please use a different lot number.');
          setLoading(false);
          return;
        }
      }

      // Determine status based on dates
      const now = new Date();
      const startDate = new Date(startUTC);
      const endDate = new Date(endUTC);
      
      let lotStatus = lot.status || 'Approved';
      let shouldClearEarlyClosed = false;
      
      // If lot is early closed, check if new dates allow reactivation
      if (lot.early_closed) {
        // If new start date is in the future, allow reactivation
        if (now < startDate) {
          // Reactivating - clear early_closed flag and recalculate status
          shouldClearEarlyClosed = true;
          if (lot.approved) {
            lotStatus = 'Approved'; // Will become Active when dates arrive
          }
        } else if (now >= startDate && now <= endDate) {
          // Dates are now active - reactivate the lot
          shouldClearEarlyClosed = true;
          lotStatus = 'Active';
        } else {
          // Dates are in the past or present but not active - keep early closed
          lotStatus = 'Early Closed';
        }
      } else {
        // Lot is not early closed - recalculate normally
        if (now >= startDate && now <= endDate) {
          lotStatus = 'Active';
        } else if (now > endDate) {
          lotStatus = 'Closed';
        } else if (lot.approved) {
          lotStatus = 'Approved';
        }
      }

      // Update lot
      const updateData: any = {
        lot_number: lotNumber.trim(),
        bidding_start_date: startUTC,
        bidding_end_date: endUTC,
        status: lotStatus,
        updated_at: new Date().toISOString(),
      };
      
      // Clear early_closed flag if reactivating, otherwise preserve it
      if (shouldClearEarlyClosed) {
        updateData.early_closed = false;
        updateData.early_closed_at = null;
        updateData.early_closed_by = null;
      } else if (lot.early_closed) {
        // Preserve early_closed flag and related fields
        updateData.early_closed = true;
      }

      const { error: updateError } = await supabase
        .from('lots')
        .update(updateData)
        .eq('id', lot.id);

      if (updateError) {
        setError('Failed to update lot: ' + updateError.message);
        setLoading(false);
        return;
      }

      // Calculate car status based on the same logic as lot status
      let carStatus = 'Upcoming';
      if (now >= startDate && now <= endDate) {
        carStatus = 'Active';
      } else if (now > endDate) {
        carStatus = 'Closed';
      }

      // Update all cars in this lot to have bidding dates and status
      // If lot is being reactivated (shouldClearEarlyClosed), update cars to match new dates
      // If lot is being closed, ensure cars are closed
      const { error: carsUpdateError } = await supabase
        .from('cars')
        .update({
          bidding_start_date: startUTC,
          bidding_end_date: endUTC,
          status: carStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('lot_id', lot.id);

      // If lot status is now "Closed" or "Early Closed", ensure all cars are closed
      // (This is a safety check - the above update should have handled it, but we do it explicitly for consistency)
      if (lotStatus === 'Closed' || lotStatus === 'Early Closed') {
        await supabase
          .from('cars')
          .update({ 
            status: 'Closed',
            updated_at: new Date().toISOString()
          })
          .eq('lot_id', lot.id)
          .neq('status', 'Closed');
      }

      if (carsUpdateError) {
        console.error('Error updating car dates:', carsUpdateError);
        // Don't fail the whole operation, just log the error
      }

      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Check if lot can have its number changed (only if not approved/active/closed)
  const canEditLotNumber = !lot.approved && lot.status === 'Pending';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900">Edit Lot</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Lot Number {canEditLotNumber ? '*' : '(Cannot be changed)'}
            </label>
            <input
              type="text"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              disabled={!canEditLotNumber}
              className={`w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent ${
                !canEditLotNumber ? 'bg-slate-100 cursor-not-allowed' : ''
              }`}
              required
            />
            {!canEditLotNumber && (
              <p className="mt-1 text-xs text-slate-500">
                Lot number cannot be changed once the lot is approved or active.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bidding Start Date & Time (Dubai Time) *
            </label>
            <input
              type="datetime-local"
              value={biddingStartDate}
              onChange={(e) => setBiddingStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bidding End Date & Time (Dubai Time) *
            </label>
            <input
              type="datetime-local"
              value={biddingEndDate}
              onChange={(e) => setBiddingEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


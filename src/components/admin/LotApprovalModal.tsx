import { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../contexts/NotificationContext';
import { dubaiLocalToUTC, toDubaiLocalDateTime, getDubaiLocalInputNow } from '../../utils/dateUtils';

interface LotApprovalModalProps {
  lot: any;
  onClose: () => void;
  onApprove: () => void;
}

export function LotApprovalModal({ lot, onClose, onApprove }: LotApprovalModalProps) {
  const [biddingStartDate, setBiddingStartDate] = useState('');
  const [biddingEndDate, setBiddingEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const { showError } = useNotification();

  // When the modal opens, pre-fill the start/end date-time with current Dubai time
  useEffect(() => {
    // If lot already has dates, show them converted to Dubai local time
    if (lot?.bidding_start_date) {
      // Existing dates: convert stored UTC to Dubai local for input
      setBiddingStartDate(toDubaiLocalDateTime(lot.bidding_start_date));
    } else {
      // New approval: default to current Dubai local time
      setBiddingStartDate(getDubaiLocalInputNow());
    }

    if (lot?.bidding_end_date) {
      setBiddingEndDate(toDubaiLocalDateTime(lot.bidding_end_date));
    } else {
      // Default end time = current Dubai time + 1 hour
      setBiddingEndDate(getDubaiLocalInputNow(60));
    }
  }, [lot?.bidding_start_date, lot?.bidding_end_date, lot?.id]);

  const handleApprove = async () => {
    if (!biddingStartDate || !biddingEndDate) {
      showError('Missing Dates', 'Please set both bidding start and end dates');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: adminData } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!adminData) {
      setLoading(false);
      return;
    }

    // Convert Dubai timezone to UTC
    // datetime-local input is treated as Dubai time, need to convert properly
    const startUTC = dubaiLocalToUTC(biddingStartDate);
    const endUTC = dubaiLocalToUTC(biddingEndDate);
    
    if (!startUTC || !endUTC) {
      showError('Date Conversion Error', 'Error converting dates. Please check the date format.');
      setLoading(false);
      return;
    }

    // Determine status based on dates
    const now = new Date();
    const startDate = new Date(startUTC);
    const endDate = new Date(endUTC);
    
    let lotStatus = 'Approved';
    if (now >= startDate && now <= endDate) {
      lotStatus = 'Active';
    } else if (now > endDate) {
      lotStatus = 'Closed';
    }

    const { error } = await supabase
      .from('lots')
      .update({
        approved: true,
        approved_by: adminData.id,
        approved_at: new Date().toISOString(),
        bidding_start_date: startUTC,
        bidding_end_date: endUTC,
        status: lotStatus,
      })
      .eq('id', lot.id);

    if (error) {
      showError('Approval Failed', `Failed to approve lot: ${error.message}`);
      setLoading(false);
      return;
    }

    // Calculate car status based on the same logic as lot status
    // This ensures cars match the lot's status
    let carStatus = 'Upcoming';
    if (now >= startDate && now <= endDate) {
      carStatus = 'Active';
    } else if (now > endDate) {
      carStatus = 'Closed';
    }

    // Also update all cars in this lot to have bidding dates, enable bidding, and set status
    // We set the status explicitly to match the lot status, ensuring consistency
    const { error: carsUpdateError } = await supabase
      .from('cars')
      .update({
        bidding_start_date: startUTC,
        bidding_end_date: endUTC,
        bidding_enabled: true, // Enable bidding for all cars in the approved lot
        status: carStatus, // Set status explicitly to match lot status
        updated_at: new Date().toISOString(),
      })
      .eq('lot_id', lot.id);

    if (carsUpdateError) {
      console.error('Error updating car dates:', carsUpdateError);
      showError('Partial Success', `Lot approved, but there was an error updating car dates: ${carsUpdateError.message}`);
      setLoading(false);
      return;
    }

    onApprove();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900">Approve Lot</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          <div>
            <p className="text-sm text-slate-600 mb-2">Lot Number</p>
            <p className="font-semibold text-slate-900">{lot.lot_number}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bidding Start Date & Time (Dubai Time)
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
              Bidding End Date & Time (Dubai Time)
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
              onClick={handleApprove}
              disabled={loading || !biddingStartDate || !biddingEndDate}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-5 h-5" />
              {loading ? 'Approving...' : 'Approve Lot'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


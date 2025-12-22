import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

interface CarEditModalProps {
  car: any;
  onClose: () => void;
  onUpdate: () => void;
}

// Convert UTC date to Dubai local datetime-local format
const toLocalDateTime = (utcDate: string | null) => {
  if (!utcDate) return '';
  const date = new Date(utcDate);
  
  // Format date in Dubai timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

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

export function CarEditModal({ car, onClose, onUpdate }: CarEditModalProps) {
  const { isAdmin } = useAuth();
  const { showError } = useNotification();
  const [formData, setFormData] = useState({
    sr_number: car.sr_number || '',
    fleet_no: car.fleet_no || '',
    reg_no: car.reg_no || '',
    chassis_no: car.chassis_no || '',
    engine_no: car.engine_no || '',
    make_model: car.make_model || '',
    year: car.year || '',
    color: car.color || '',
    body_type: car.body_type || '',
    fuel_type: car.fuel_type || '',
    transmission: car.transmission || '',
    seats: car.seats || '',
    doors: car.doors || '',
    km: car.km || '',
    location: car.location || '',
    current_location: car.current_location || '',
    notes: car.notes || '',
    bidding_start_date: toLocalDateTime(car.bidding_start_date),
    bidding_end_date: toLocalDateTime(car.bidding_end_date),
    bidding_enabled: car.bidding_enabled,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData: any = {
        ...formData,
        year: formData.year ? parseInt(formData.year as string) : null,
        km: formData.km ? parseInt(formData.km as string) : null,
        seats: formData.seats ? parseInt(formData.seats as string) : null,
        doors: formData.doors ? parseInt(formData.doors as string) : null,
        bidding_start_date: toUTC(formData.bidding_start_date),
        bidding_end_date: toUTC(formData.bidding_end_date),
      };
      
      const { error } = await supabase
        .from('cars')
        .update(updateData)
        .eq('id', car.id);

      if (error) throw error;
      onUpdate();
    } catch (error: any) {
      showError('Update Failed', `Failed to update car: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 sticky top-0 bg-white flex-shrink-0">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900">Edit Car Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">SR Number</label>
              <input
                type="text"
                value={formData.sr_number}
                onChange={(e) => setFormData({ ...formData, sr_number: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Fleet No</label>
              <input
                type="text"
                value={formData.fleet_no}
                onChange={(e) => setFormData({ ...formData, fleet_no: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Registration No</label>
              <input
                type="text"
                value={formData.reg_no}
                onChange={(e) => setFormData({ ...formData, reg_no: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Make / Model *</label>
              <input
                type="text"
                value={formData.make_model}
                onChange={(e) => setFormData({ ...formData, make_model: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Year</label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">KM</label>
              <input
                type="number"
                value={formData.km}
                onChange={(e) => setFormData({ ...formData, km: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Chassis No</label>
              <input
                type="text"
                value={formData.chassis_no}
                onChange={(e) => setFormData({ ...formData, chassis_no: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Engine No</label>
              <input
                type="text"
                value={formData.engine_no}
                onChange={(e) => setFormData({ ...formData, engine_no: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Body Type</label>
              <input
                type="text"
                value={formData.body_type}
                onChange={(e) => setFormData({ ...formData, body_type: e.target.value })}
                placeholder="Sedan, SUV, Hatchback, etc."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Fuel Type</label>
              <input
                type="text"
                value={formData.fuel_type}
                onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                placeholder="Petrol, Diesel, Hybrid, Electric"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Transmission</label>
              <input
                type="text"
                value={formData.transmission}
                onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                placeholder="Manual, Automatic"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Seats</label>
              <input
                type="number"
                value={formData.seats}
                onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Doors</label>
              <input
                type="number"
                value={formData.doors}
                onChange={(e) => setFormData({ ...formData, doors: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Current Location</label>
              <input
                type="text"
                value={formData.current_location}
                onChange={(e) => setFormData({ ...formData, current_location: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Bidding Start Date</label>
              <input
                type="datetime-local"
                value={formData.bidding_start_date}
                onChange={(e) => setFormData({ ...formData, bidding_start_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Bidding End Date</label>
              <input
                type="datetime-local"
                value={formData.bidding_end_date}
                onChange={(e) => setFormData({ ...formData, bidding_end_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Admin Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              placeholder="Internal notes (not visible to users)"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="bidding_enabled"
              checked={formData.bidding_enabled}
              onChange={(e) => setFormData({ ...formData, bidding_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-dl-red focus:ring-2 focus:ring-dl-red"
            />
            <label htmlFor="bidding_enabled" className="text-sm font-medium text-slate-700">
              Bidding Enabled
            </label>
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
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface LotDetailsModalProps {
  lot: any;
  onClose: () => void;
  onUpdate: () => void;
}

export function LotDetailsModal({ lot, onClose, onUpdate }: LotDetailsModalProps) {
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCars();
  }, [lot.id]);

  const loadCars = async () => {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .eq('lot_id', lot.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCars(data);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] my-4 sm:my-8 flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl flex-shrink-0">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900">Lot Details</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 truncate">{lot.lot_number}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Lot Number</p>
              <p className="text-base sm:text-lg font-semibold text-slate-900">{lot.lot_number || '-'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Status</p>
              <p className="text-base sm:text-lg font-semibold text-slate-900">{lot.status || '-'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Total Cars</p>
              <p className="text-base sm:text-lg font-semibold text-slate-900">{cars.length}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Bidding Start</p>
              <p className="text-sm font-semibold text-slate-900">
                {lot.bidding_start_date
                  ? new Date(lot.bidding_start_date).toLocaleString('en-US', { 
                      timeZone: 'Asia/Dubai',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })
                  : 'Not set'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Bidding End</p>
              <p className="text-sm font-semibold text-slate-900">
                {lot.bidding_end_date
                  ? new Date(lot.bidding_end_date).toLocaleString('en-US', { 
                      timeZone: 'Asia/Dubai',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })
                  : 'Not set'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Uploaded Date</p>
              <p className="text-sm font-semibold text-slate-900">
                {lot.created_at
                  ? new Date(lot.created_at).toLocaleString('en-US', { 
                      timeZone: 'Asia/Dubai',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : '-'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Cars in Lot ({cars.length})</h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-dl-red"></div>
                <p className="mt-4 text-sm text-slate-600">Loading cars...</p>
              </div>
            ) : cars.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-600">No cars in this lot</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">SR Number</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Reg No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Make/Model</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Year</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">KM</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {cars.map((car) => (
                      <tr key={car.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-900">{car.sr_number || '-'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{car.reg_no || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{car.make_model || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{car.year || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{car.km?.toLocaleString() || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md border ${
                            car.status === 'Active' ? 'bg-green-100 text-green-800 border-green-200' :
                            car.status === 'Closed' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                            car.status === 'Upcoming' ? 'bg-dl-grey-bg text-slate-800 border-dl-grey-medium' :
                            'bg-slate-100 text-slate-800 border-slate-200'
                          }`}>
                            {car.status || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


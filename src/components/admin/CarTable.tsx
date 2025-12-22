import { useState } from 'react';
import { Edit2, TrendingUp } from 'lucide-react';
import { CarEditModal } from './CarEditModal';
import { BiddingDetailsModal } from './BiddingDetailsModal';

interface CarTableProps {
  cars: any[];
  selectedCars: Set<string>;
  onSelectAll: () => void;
  onSelectCar: (carId: string) => void;
  loading: boolean;
  onUpdate: () => void;
}

export function CarTable({ cars, selectedCars, onSelectAll, onSelectCar, loading, onUpdate }: CarTableProps) {
  const [editingCar, setEditingCar] = useState<any | null>(null);
  const [biddingCar, setBiddingCar] = useState<any | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 border-green-200';
      case 'Upcoming': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Closed': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Disabled': return 'bg-red-100 text-red-800 border-red-200';
      case 'Reopened': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleString('en-US', {
      timeZone: 'Asia/Dubai',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-dl-red"></div>
        <p className="mt-4 text-slate-600">Loading cars...</p>
      </div>
    );
  }

  if (cars.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-600">No cars found. Import an Excel file to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="table-wrapper w-full">
        <table className="w-full min-w-[1400px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center align-middle">
                <input
                  type="checkbox"
                  checked={selectedCars.size === cars.length && cars.length > 0}
                  onChange={onSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-dl-red focus:ring-2 focus:ring-dl-red"
                />
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-700 uppercase whitespace-nowrap align-middle w-12">S.No</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-700 uppercase whitespace-nowrap align-middle w-20">Lot No</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap align-middle hidden sm:table-cell w-28">Reg No</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase align-middle min-w-[180px] max-w-[250px]">Make/Model</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-700 uppercase whitespace-nowrap align-middle hidden md:table-cell w-20">Year</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-slate-700 uppercase whitespace-nowrap align-middle hidden lg:table-cell w-24">KM</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-700 uppercase whitespace-nowrap align-middle w-24">Bids</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap align-middle hidden lg:table-cell min-w-[120px]">Location</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-700 uppercase whitespace-nowrap align-middle w-28">Status</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap align-middle hidden md:table-cell min-w-[140px]">Start Date</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-700 uppercase whitespace-nowrap align-middle hidden md:table-cell min-w-[140px]">End Date</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-700 uppercase whitespace-nowrap align-middle w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {cars.map((car, index) => (
              <tr key={car.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-center align-middle">
                  <input
                    type="checkbox"
                    checked={selectedCars.has(car.id)}
                    onChange={() => onSelectCar(car.id)}
                    className="w-4 h-4 rounded border-slate-300 text-dl-red focus:ring-2 focus:ring-dl-red"
                  />
                </td>
                {/* Sequential serial number across all cars in the current list */}
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-900 text-center align-middle">{index + 1}</td>
                {/* Lot number from related lot (if available) */}
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-900 text-center align-middle">{car.lot?.lot_number || '-'}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-slate-900 text-left align-middle hidden sm:table-cell">{car.reg_no || '-'}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-900 text-left align-middle">
                  <div className="break-words max-w-[250px]">{car.make_model}</div>
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 text-center align-middle hidden md:table-cell">{car.year || '-'}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 text-right align-middle hidden lg:table-cell">{car.km?.toLocaleString() || '-'}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-center align-middle">
                  {car.highest_bid ? (
                    <div className="text-green-600 font-bold">
                      {car.highest_bid_count || 0} bids
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      No bids
                    </div>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 text-left align-middle hidden lg:table-cell">{car.location || '-'}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-center align-middle">
                  <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md border ${getStatusColor(car.status)}`}>
                    {car.status}
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 whitespace-nowrap text-left align-middle hidden md:table-cell">
                  {formatDate(car.bidding_start_date)}
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600 whitespace-nowrap text-left align-middle hidden md:table-cell">
                  {formatDate(car.bidding_end_date)}
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-center align-middle">
                  <div className="flex items-center justify-center gap-1 sm:gap-2">
                    <button
                      onClick={() => setEditingCar(car)}
                      className="p-1.5 sm:p-2 text-dl-red hover:bg-dl-grey-bg rounded-lg transition-colors min-h-[44px] touch-target"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setBiddingCar(car)}
                      className="p-1.5 sm:p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors min-h-[44px] touch-target"
                      title="View Bids"
                    >
                      <TrendingUp className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingCar && (
        <CarEditModal
          car={editingCar}
          onClose={() => setEditingCar(null)}
          onUpdate={() => {
            setEditingCar(null);
            onUpdate();
          }}
        />
      )}

      {biddingCar && (
        <BiddingDetailsModal
          car={biddingCar}
          onClose={() => setBiddingCar(null)}
        />
      )}
    </>
  );
}

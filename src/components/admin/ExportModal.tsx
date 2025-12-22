import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../contexts/NotificationContext';
import { formatCarForExport } from '../../utils/carExportFormatter';

interface ExportModalProps {
  onClose: () => void;
}

export function ExportModal({ onClose }: ExportModalProps) {
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] = useState<'cars' | 'bids' | 'bidding_history' | 'lot_wise'>('cars');
  const [lots, setLots] = useState<any[]>([]);
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    loadLots();
  }, []);

  const loadLots = async () => {
    const { data } = await supabase
      .from('lots')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setLots(data);
    }
  };

  const handleSelectLot = (lotId: string) => {
    const newSelected = new Set(selectedLots);
    if (newSelected.has(lotId)) {
      newSelected.delete(lotId);
    } else {
      newSelected.add(lotId);
    }
    setSelectedLots(newSelected);
  };

  const handleSelectAllLots = () => {
    if (selectedLots.size === lots.length) {
      setSelectedLots(new Set());
    } else {
      setSelectedLots(new Set(lots.map(l => l.id)));
    }
  };

  const exportToExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Helper function to create valid Excel sheet names (max 31 chars, no special chars)
  const createSheetName = (car: any): string => {
    let name = `${car.reg_no || car.sr_number || 'Car'}_${car.make_model || ''}`.trim();
    // Remove invalid characters for Excel sheet names
    name = name.replace(/[\\\/\?\*\[\]:]/g, '_');
    // Limit to 31 characters (Excel limit)
    return name.substring(0, 31);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      if (exportType === 'cars') {
        // Export only cars from approved lots (same as what admin sees in the list)
        // Also refresh statuses to ensure accurate data (silently fail if RPC doesn't exist or 403)
        try {
          const { error } = await supabase.rpc('refresh_car_statuses');
          if (error && error.status !== 403 && error.code !== 'PGRST301' && error.code !== '42501' && !error.message.includes('permission denied')) {
            console.error('Error refreshing statuses:', error);
          }
        } catch (error: any) {
          // Silently ignore 403 and permission errors
          if (error?.status !== 403 && error?.code !== 'PGRST301' && error?.code !== '42501' && !error?.message?.includes('permission denied')) {
            console.error('Error refreshing statuses:', error);
          }
        }

        // First get all cars with their lot info
        const { data: cars } = await supabase
          .from('cars')
          .select(`
            *,
            lots (lot_number, approved)
          `)
          .order('created_at', { ascending: false });
        
        // Filter to only include cars from approved lots
        const approvedCars = cars?.filter(car => (car.lots as any)?.approved === true) || [];
        
        if (approvedCars.length > 0) {
          // Export in the EXACT same format as the upload file
          // Columns: Lot#, S# (sequential 1,2,3...), Fleet #, Reg #, Current Location, Type / Model, Make, Chassis #, Color, Year, KM
          // Note: Bid Price is NOT included for admin exports
          // S# will contain sequential numbers (1, 2, 3...) instead of the actual SR number from database
          const exportData = approvedCars.map((car, index) => formatCarForExport(car, index));
          exportToExcel(exportData, 'vehicles_export');
          showSuccess('Export Successful', `Exported ${exportData.length} vehicle(s) from approved lots in the same format as the upload file.`);
        } else {
          showError('No Vehicles', 'No vehicles found from approved lots to export.');
        }
      } else if (exportType === 'bids') {
        const { data } = await supabase
          .from('bids')
          .select(`
            *,
            cars!inner (
              *,
              lots (lot_number, name, approved)
            ),
            users (name, email, phone)
          `)
          .order('created_at', { ascending: false });

        if (data) {
          // Filter to only include cars from approved lots
          const approvedBids = data.filter(bid => (bid.cars as any)?.lots?.approved === true) || [];
          
          // Group bids by car to maintain sequential S# numbering
          const bidsByCar = new Map<string, any[]>();
          approvedBids.forEach(bid => {
            const carId = (bid.cars as any)?.id;
            if (!bidsByCar.has(carId)) {
              bidsByCar.set(carId, []);
            }
            bidsByCar.get(carId)?.push(bid);
          });

          const exportData: any[] = [];
          let carIndex = 0;
          
          bidsByCar.forEach((carBids, carId) => {
            const firstBid = carBids[0];
            const car = firstBid.cars as any;
            
            carBids.forEach((bid, bidIndex) => {
              // Use standard car format, then add bid information
              const baseData = formatCarForExport(car, carIndex, car.lots?.lot_number);
              exportData.push({
                ...baseData,
                'Bidder Name': bid.users?.name || '-',
                'Bidder Email': bid.users?.email || '-',
                'Bidder Phone': bid.users?.phone || '-',
                'Bid Time': new Date(bid.created_at).toLocaleString('en-US', {
                  timeZone: 'Asia/Dubai',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                }),
              });
            });
            carIndex++;
          });
          
          exportToExcel(exportData, 'bidding_export');
          showSuccess('Export Successful', `Exported ${exportData.length} bid record(s) from approved lots.`);
        }
      } else if (exportType === 'bidding_history') {
        // Export bidding history with all cars in standard format
        const { data: cars } = await supabase
          .from('cars')
          .select(`
            *,
            lots (lot_number, approved)
          `)
          .order('created_at', { ascending: false });
        const { data: bids } = await supabase
          .from('bids')
          .select(`
            *,
            users (name, email, phone)
          `);

        if (cars && bids) {
          // Filter to only include cars from approved lots
          const approvedCars = cars.filter(car => (car.lots as any)?.approved === true) || [];
          
          const exportData: any[] = [];
          let carIndex = 0;
          
          approvedCars.forEach(car => {
            const carBids = bids.filter(b => b.car_id === car.id);
            
            // Deduplicate by user_id - keep only the highest bid per user
            const bidsByUser = new Map<string, any>();
            carBids.forEach(bid => {
              const userId = bid.user_id;
              const existingBid = bidsByUser.get(userId);
              if (!existingBid || bid.amount > existingBid.amount) {
                bidsByUser.set(userId, bid);
              }
            });
            
            // Convert back to array and sort by amount descending
            const uniqueBids = Array.from(bidsByUser.values());
            const sortedBids = uniqueBids.sort((a, b) => b.amount - a.amount);
            
            if (sortedBids.length > 0) {
              // Create a row for each bid with ranking - use standard format
              sortedBids.forEach((bid, bidIndex) => {
                const baseData = formatCarForExport(car, carIndex, (car.lots as any)?.lot_number);
                exportData.push({
                  ...baseData,
                  'Rank': bidIndex + 1,
                  'Bidder Name': bid.users?.name || 'Unknown',
                  'Bidder Email': bid.users?.email || '-',
                  'Bidder Phone': bid.users?.phone || '-',
                  'Bid Time': new Date(bid.created_at).toLocaleString('en-US', {
                    timeZone: 'Asia/Dubai',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  }),
                });
              });
            } else {
              // No bids for this car - use standard format
              const baseData = formatCarForExport(car, carIndex, (car.lots as any)?.lot_number);
              exportData.push({
                ...baseData,
                'Rank': 'No bids',
                'Bidder Name': '-',
                'Bidder Email': '-',
                'Bidder Phone': '-',
                'Bid Time': '-',
              });
            }
            carIndex++;
          });
          
          exportToExcel(exportData, 'bidding_history_export');
          showSuccess('Export Successful', `Exported ${exportData.length} record(s) from approved lots.`);
        }
      } else if (exportType === 'lot_wise') {
        // Export lot-wise: each lot as a separate sheet
        // Only export approved lots
        const { data: lots } = await supabase
          .from('lots')
          .select('*')
          .eq('approved', true)
          .order('created_at', { ascending: false });

        if (lots && lots.length > 0) {
          const wb = XLSX.utils.book_new();

          for (const lot of lots) {
            // Only process lots that are in the selected list (if any selected)
            if (selectedLots.size > 0 && !selectedLots.has(lot.id)) {
              continue;
            }

            // Load cars for this lot
            const { data: cars } = await supabase
              .from('cars')
              .select('*')
              .eq('lot_id', lot.id)
              .order('created_at', { ascending: false });

            if (!cars || cars.length === 0) {
              // Create empty sheet for lot with no cars
              const emptyData = [{
                'Lot Number': lot.lot_number || '-',
                'Status': lot.status || '-',
                'Message': 'No cars in this lot',
              }];
              const ws = XLSX.utils.json_to_sheet(emptyData);
              const sheetName = (lot.lot_number || `Lot_${lot.id}`).substring(0, 31).replace(/[\\\/\?\*\[\]:]/g, '_');
              XLSX.utils.book_append_sheet(wb, ws, sheetName);
              continue;
            }

            // Load bids for all cars in this lot
            const carIds = cars.map(c => c.id);
            const { data: bids } = await supabase
              .from('bids')
              .select(`
                *,
                users (name, email, phone)
              `)
              .in('car_id', carIds);

            const exportData: any[] = [];
            let carIndex = 0;

            cars.forEach(car => {
              const carBids = bids?.filter(b => b.car_id === car.id) || [];
              
              // Deduplicate by user_id - keep only the highest bid per user
              const bidsByUser = new Map<string, any>();
              carBids.forEach(bid => {
                const userId = bid.user_id;
                const existingBid = bidsByUser.get(userId);
                if (!existingBid || bid.amount > existingBid.amount) {
                  bidsByUser.set(userId, bid);
                }
              });
              
              // Convert back to array and sort by amount descending
              const uniqueBids = Array.from(bidsByUser.values());
              const sortedBids = uniqueBids.sort((a, b) => b.amount - a.amount);

              if (sortedBids.length > 0) {
                // Create a row for each bid with ranking - use standard format
                sortedBids.forEach((bid, bidIndex) => {
                  const baseData = formatCarForExport(car, carIndex, lot.lot_number);
                  exportData.push({
                    ...baseData,
                    'Rank': bidIndex + 1,
                    'Bidder Name': bid.users?.name || 'Unknown',
                    'Bidder Email': bid.users?.email || '-',
                    'Bidder Phone': bid.users?.phone || '-',
                    'Bid Time': new Date(bid.created_at).toLocaleString('en-US', {
                      timeZone: 'Asia/Dubai',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    }),
                  });
                });
              } else {
                // No bids for this car - use standard format
                const baseData = formatCarForExport(car, carIndex, lot.lot_number);
                exportData.push({
                  ...baseData,
                  'Rank': 'No bids',
                  'Bidder Name': '-',
                  'Bidder Email': '-',
                  'Bidder Phone': '-',
                  'Bid Time': '-',
                });
              }
              carIndex++;
            });

            // Create sheet for this lot
            const ws = XLSX.utils.json_to_sheet(exportData);
            // Create valid sheet name (max 31 chars, no special chars)
            let sheetName = lot.lot_number || `Lot_${lot.id}`;
            sheetName = sheetName.replace(/[\\\/\?\*\[\]:]/g, '_');
            sheetName = sheetName.substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
          }

          // Save the workbook
          XLSX.writeFile(wb, `lot_wise_export_${new Date().toISOString().split('T')[0]}.xlsx`);
          showSuccess('Export Successful', `Exported ${lots.length} approved lot(s) with all cars in standard format.`);
        } else {
          showError('No Lots', 'No approved lots found to export. Please approve lots first.');
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      showError('Export Failed', 'Failed to export data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900">Export Data</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Select Export Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="exportType"
                  value="cars"
                  checked={exportType === 'cars'}
                  onChange={(e) => setExportType(e.target.value as any)}
                  className="w-4 h-4 text-dl-red focus:ring-2 focus:ring-dl-red"
                />
                <div className="ml-3">
                  <p className="font-medium text-slate-900">Car Master Export</p>
                  <p className="text-sm text-slate-600">All car details and specifications</p>
                </div>
              </label>

              <label className="flex items-center p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="exportType"
                  value="bids"
                  checked={exportType === 'bids'}
                  onChange={(e) => setExportType(e.target.value as any)}
                  className="w-4 h-4 text-dl-red focus:ring-2 focus:ring-dl-red"
                />
                <div className="ml-3">
                  <p className="font-medium text-slate-900">Bidding Export</p>
                  <p className="text-sm text-slate-600">All bids with user details</p>
                </div>
              </label>

              <label className="flex items-center p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="exportType"
                  value="bidding_history"
                  checked={exportType === 'bidding_history'}
                  onChange={(e) => setExportType(e.target.value as any)}
                  className="w-4 h-4 text-dl-red focus:ring-2 focus:ring-dl-red"
                />
                <div className="ml-3">
                  <p className="font-medium text-slate-900">Bidding History with Rankings</p>
                  <p className="text-sm text-slate-600">All bids ranked per car (1st, 2nd, 3rd winners)</p>
                </div>
              </label>

              <label className="flex items-center p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="exportType"
                  value="lot_wise"
                  checked={exportType === 'lot_wise'}
                  onChange={(e) => setExportType(e.target.value as any)}
                  className="w-4 h-4 text-dl-red focus:ring-2 focus:ring-dl-red"
                />
                <div className="ml-3">
                  <p className="font-medium text-slate-900">Lot-Wise Export</p>
                  <p className="text-sm text-slate-600">Select lots to export as separate sheets</p>
                </div>
              </label>
            </div>
          </div>

          {/* Lot Selection (only shown for lot_wise export) */}
          {exportType === 'lot_wise' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-700">
                  Select Lots to Export
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllLots}
                  className="text-sm text-dl-red hover:text-dl-red-hover"
                >
                  {selectedLots.size === lots.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 space-y-2">
                {lots.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No lots available</p>
                ) : (
                  lots.map((lot) => (
                    <label
                      key={lot.id}
                      className="flex items-center p-2 hover:bg-slate-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLots.has(lot.id)}
                        onChange={() => handleSelectLot(lot.id)}
                        className="w-4 h-4 text-dl-red rounded border-slate-300 focus:ring-2 focus:ring-dl-red"
                      />
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {lot.lot_number || `Lot ${lot.id.substring(0, 8)}`}
                        </p>
                        <p className="text-xs text-slate-600">
                          {lot.status || 'Pending'}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
              {selectedLots.size > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  {selectedLots.size} lot{selectedLots.size !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleExport}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-dl-red to-red-700 text-white rounded-lg hover:from-dl-red-hover hover:to-red-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg font-semibold"
            >
              <Download className="w-5 h-5" />
              {loading ? 'Exporting...' : 'Export to Excel'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-all duration-200 font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { X, Download, Upload, Edit2, Save, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { formatDubaiDate } from '../../utils/dateUtils';
import { formatCarForExport } from '../../utils/carExportFormatter';
import { useNotification } from '../../contexts/NotificationContext';

interface WinnerAnnouncementModalProps {
  lot: any;
  onClose: () => void;
}

export function WinnerAnnouncementModal({ lot, onClose }: WinnerAnnouncementModalProps) {
  const [cars, setCars] = useState<any[]>([]);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [selectedWinnerBidId, setSelectedWinnerBidId] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadData();
  }, [lot.id]);

  const loadData = async () => {
    setLoading(true);
    // Load cars in lot
    const { data: carsData } = await supabase
      .from('cars')
      .select('*')
      .eq('lot_id', lot.id);

    if (carsData) {
      setCars(carsData);
      
      // Load bids for all cars in lot
      const carIds = carsData.map(c => c.id);
      const { data: bidsData } = await supabase
        .from('bids')
        .select(`
          *,
          users!inner(name, email, phone),
          cars (reg_no, make_model)
        `)
        .in('car_id', carIds)
        .order('amount', { ascending: false });
      
      if (bidsData) {
        setBids(bidsData);
        // Initialize selected winners from existing is_winner flags
        const winners: Record<string, string> = {};
        bidsData.forEach(bid => {
          if (bid.is_winner) {
            winners[bid.car_id] = bid.id;
          }
        });
        setSelectedWinnerBidId(winners);
      }
    }
    setLoading(false);
  };

  const handleEditWinner = (carId: string) => {
    setEditingCarId(carId);
  };

  const handleSelectWinner = (carId: string, bidId: string) => {
    setSelectedWinnerBidId(prev => ({
      ...prev,
      [carId]: bidId
    }));
  };

  const handleSaveWinner = async (carId: string) => {
    setSaving(true);
    try {
      const selectedBidId = selectedWinnerBidId[carId];
      
      if (!selectedBidId) {
        showError('Error', 'Please select a winner');
        setSaving(false);
        return;
      }

      // First, unset all winners for this car
      const carBids = bids.filter(b => b.car_id === carId);
      const unsetPromises = carBids.map(bid => 
        supabase
          .from('bids')
          .update({ is_winner: false })
          .eq('id', bid.id)
      );
      await Promise.all(unsetPromises);

      // Set the selected bid as winner
      const { error } = await supabase
        .from('bids')
        .update({ is_winner: true })
        .eq('id', selectedBidId);

      if (error) {
        throw error;
      }

      showSuccess('Success', 'Winner updated successfully');
      setEditingCarId(null);
      await loadData(); // Reload to reflect changes
    } catch (error: any) {
      console.error('Error saving winner:', error);
      showError('Error', error.message || 'Failed to save winner');
    } finally {
      setSaving(false);
    }
  };

  const handleExportWinners = () => {
    const wb = XLSX.utils.book_new();
    
    // Export Option 1: All Bidders with Bid Details
    const allBiddersData: any[] = [];
    const biddedCars = cars.filter(car => {
      const carBids = bids.filter(b => b.car_id === car.id);
      return carBids.length > 0;
    });

    biddedCars.forEach(car => {
      const carBids = bids.filter(b => b.car_id === car.id);
      // Deduplicate by user_id before ranking
      const bidsByUser = new Map<string, any>();
      carBids.forEach(bid => {
        const userId = bid.user_id;
        const existingBid = bidsByUser.get(userId);
        if (!existingBid || bid.amount > existingBid.amount) {
          bidsByUser.set(userId, bid);
        }
      });
      const uniqueBids = Array.from(bidsByUser.values());
      const sortedBids = uniqueBids.sort((a, b) => b.amount - a.amount);

      sortedBids.forEach((bid, index) => {
        // Use standard format, then add bid information
        const baseData = formatCarForExport(car, 0, lot.lot_number);
        allBiddersData.push({
          ...baseData,
          'Rank': index + 1,
          'Bid ID': bid.id,
          'Bidder Name': bid.users?.name || 'Unknown',
          'Bidder Email': bid.users?.email || '-',
          'Bidder Phone': bid.users?.phone || '-',
          'Bid Amount': `AED ${bid.amount.toLocaleString()}`,
          'Bid Time': formatDubaiDate(bid.created_at),
          'Winners': bid.is_winner ? 'Yes' : 'No',
        });
      });
    });

    // Export Option 2: Rank 1 Bidders Only
    const rank1Data: any[] = [];
    biddedCars.forEach(car => {
      const carBids = bids.filter(b => b.car_id === car.id);
      // Deduplicate by user_id before ranking
      const bidsByUser = new Map<string, any>();
      carBids.forEach(bid => {
        const userId = bid.user_id;
        const existingBid = bidsByUser.get(userId);
        if (!existingBid || bid.amount > existingBid.amount) {
          bidsByUser.set(userId, bid);
        }
      });
      const uniqueBids = Array.from(bidsByUser.values());
      const sortedBids = uniqueBids.sort((a, b) => b.amount - a.amount);
      const rank1Bid = sortedBids[0];

      if (rank1Bid) {
        // Use standard format, then add bid information
        const baseData = formatCarForExport(car, 0, lot.lot_number);
        rank1Data.push({
          ...baseData,
          'Rank': 1,
          'Bid ID': rank1Bid.id,
          'Bidder Name': rank1Bid.users?.name || 'Unknown',
          'Bidder Email': rank1Bid.users?.email || '-',
          'Bidder Phone': rank1Bid.users?.phone || '-',
          'Bid Amount': `AED ${rank1Bid.amount.toLocaleString()}`,
          'Bid Time': formatDubaiDate(rank1Bid.created_at),
          'Winners': rank1Bid.is_winner ? 'Yes' : 'No',
        });
      }
    });

    // Create both sheets
    const wsAll = XLSX.utils.json_to_sheet(allBiddersData);
    const wsRank1 = XLSX.utils.json_to_sheet(rank1Data);
    
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Bidders');
    XLSX.utils.book_append_sheet(wb, wsRank1, 'Rank 1 Bidders');
    
    XLSX.writeFile(wb, `lot_${lot.lot_number}_winners_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    showSuccess('Export Successful', 'Exported with All Bidders and Rank 1 Bidders sheets. Edit the "Winners" column and import to announce winners.');
  };

  const handleImportWinners = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

      setSaving(true);
      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData) {
        try {
          const carId = row['Car ID'] || row['car_id'];
          const bidId = row['Bid ID'] || row['bid_id'];
          const winners = row['Winners'] || row['winners'] || row['Winner'] || row['winner'];

          // Check if Winners column is "Yes"
          if (!winners || (winners.toString().toLowerCase() !== 'yes' && winners.toString().toLowerCase() !== 'y')) {
            continue; // Skip rows where Winners is not "Yes"
          }

          if (!carId || !bidId) {
            errorCount++;
            continue;
          }

          // Verify the bid belongs to the car
          const bid = bids.find(b => b.id === bidId && b.car_id === carId);
          if (!bid) {
            errorCount++;
            continue;
          }

          // Unset all winners for this car
          const carBids = bids.filter(b => b.car_id === carId);
          await Promise.all(carBids.map(b => 
            supabase
              .from('bids')
              .update({ is_winner: false })
              .eq('id', b.id)
          ));

          // Set the selected bid as winner
          await supabase
            .from('bids')
            .update({ is_winner: true })
            .eq('id', bidId);

          successCount++;
        } catch (error) {
          console.error('Error processing row:', error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        showSuccess('Import Successful', `Imported ${successCount} winner(s). ${errorCount > 0 ? `${errorCount} failed.` : ''}`);
        await loadData();
      } else {
        showError('Import Failed', 'No winners were imported. Please check the file format.');
      }
    } catch (error: any) {
      console.error('Error importing winners:', error);
      showError('Import Error', error.message || 'Failed to import winners');
    } finally {
      setSaving(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const biddedCars = cars.filter(car => {
    const carBids = bids.filter(b => b.car_id === car.id);
    return carBids.length > 0;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] my-4 sm:my-8 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl flex-shrink-0 gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 truncate flex items-center gap-2">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
              Winner Announcement: {lot.lot_number}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 truncate">{lot.name}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={handleExportWinners}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-all duration-200 text-xs sm:text-sm font-semibold"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Export Winners</span>
              <span className="sm:hidden">Export</span>
            </button>
            <label className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-all duration-200 text-xs sm:text-sm font-semibold cursor-pointer">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Import Winners</span>
              <span className="sm:hidden">Import</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportWinners}
                className="hidden"
              />
            </label>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
            </div>
          ) : biddedCars.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-lg">No cars with bids to announce winners</p>
            </div>
          ) : (
            <div className="space-y-6">
              {biddedCars.map((car) => {
                const carBids = bids.filter(b => b.car_id === car.id);
                // Deduplicate by user_id before ranking
                const bidsByUser = new Map<string, any>();
                carBids.forEach(bid => {
                  const userId = bid.user_id;
                  const existingBid = bidsByUser.get(userId);
                  if (!existingBid || bid.amount > existingBid.amount) {
                    bidsByUser.set(userId, bid);
                  }
                });
                const uniqueBids = Array.from(bidsByUser.values());
                const sortedBids = uniqueBids.sort((a, b) => b.amount - a.amount);
                const currentWinner = sortedBids.find(b => b.is_winner);
                const selectedBidId = selectedWinnerBidId[car.id] || currentWinner?.id;

                return (
                  <div key={car.id} className="border border-slate-200 rounded-lg p-4 sm:p-6">
                    <div className="mb-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">{car.make_model}</h3>
                          <p className="text-sm text-slate-600">Registration: {car.reg_no || '-'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {currentWinner && !editingCarId && (
                            <div className="bg-green-100 border border-green-300 rounded-lg px-3 py-2">
                              <p className="text-xs font-semibold text-green-800 uppercase mb-1">Current Winner</p>
                              <p className="text-sm font-bold text-green-900">{currentWinner.users?.name || 'Unknown'}</p>
                              <p className="text-xs text-green-700">AED {currentWinner.amount.toLocaleString()}</p>
                            </div>
                          )}
                          {editingCarId === car.id ? (
                            <button
                              onClick={() => handleSaveWinner(car.id)}
                              disabled={saving}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 text-sm font-semibold disabled:opacity-50"
                            >
                              <Save className="w-4 h-4" />
                              Save
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEditWinner(car.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-all duration-200 text-sm font-semibold"
                            >
                              <Edit2 className="w-4 h-4" />
                              {currentWinner ? 'Edit Winner' : 'Choose Winner'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {editingCarId === car.id && (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <p className="text-sm font-semibold text-slate-700 mb-3">Select Winner:</p>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {sortedBids.map((bid, index) => (
                            <label
                              key={bid.id}
                              className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                selectedBidId === bid.id
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`winner-${car.id}`}
                                checked={selectedBidId === bid.id}
                                onChange={() => handleSelectWinner(car.id, bid.id)}
                                className="w-4 h-4 text-green-600"
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-slate-900">{bid.users?.name || 'Unknown'}</p>
                                    <p className="text-sm text-slate-600">{bid.users?.email}</p>
                                    <p className="text-xs text-slate-500">{bid.users?.phone}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-slate-900">AED {bid.amount.toLocaleString()}</p>
                                    <p className="text-xs text-slate-500">Rank #{index + 1}</p>
                                    <p className="text-xs text-slate-500">{formatDubaiDate(bid.created_at)}</p>
                                  </div>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {editingCarId !== car.id && sortedBids.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase">Rank</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase">Bidder</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase">Contact</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-700 uppercase">Bid Amount</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase">Time</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold text-slate-700 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {sortedBids.map((bid, index) => (
                              <tr key={bid.id} className={bid.is_winner ? 'bg-green-50' : 'hover:bg-slate-50'}>
                                <td className="px-4 py-2">
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                    bid.is_winner ? 'bg-green-500 text-white' :
                                    index === 0 ? 'bg-slate-400 text-white' :
                                    index === 1 ? 'bg-orange-400 text-white' :
                                    'bg-slate-200 text-slate-700'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm font-medium text-slate-900">
                                  {bid.users?.name || 'Unknown'}
                                </td>
                                <td className="px-4 py-2 text-sm text-slate-600">
                                  <div>{bid.users?.email}</div>
                                  <div className="text-xs">{bid.users?.phone}</div>
                                </td>
                                <td className="px-4 py-2 text-right text-sm font-bold text-slate-900">
                                  AED {bid.amount.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-sm text-slate-600">
                                  {formatDubaiDate(bid.created_at)}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {bid.is_winner ? (
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-md bg-green-100 text-green-800">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Winner
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


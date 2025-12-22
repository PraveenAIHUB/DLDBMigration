import { useState, useEffect } from 'react';
import { X, TrendingUp, User, DollarSign, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface BiddingDetailsModalProps {
  car: any;
  onClose: () => void;
}

export function BiddingDetailsModal({ car, onClose }: BiddingDetailsModalProps) {
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin, isBusinessUser } = useAuth();

  useEffect(() => {
    loadBids();
  }, [car.id]);

  const loadBids = async () => {
    const { data, error } = await supabase
      .from('bids')
      .select(`
        *,
        users (name, email, phone)
      `)
      .eq('car_id', car.id)
      .order('amount', { ascending: false });

    if (!error && data) {
      // Deduplicate by user_id - keep only the highest bid per user
      const bidsByUser = new Map<string, any>();
      data.forEach(bid => {
        const userId = bid.user_id;
        const existingBid = bidsByUser.get(userId);
        if (!existingBid || bid.amount > existingBid.amount) {
          bidsByUser.set(userId, bid);
        }
      });
      const uniqueBids = Array.from(bidsByUser.values());
      setBids(uniqueBids.sort((a, b) => b.amount - a.amount));
    }
    setLoading(false);
  };

  const highestBid = bids.length > 0 ? bids[0].amount : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 sticky top-0 bg-white flex-shrink-0">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">Bidding Details</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 truncate">{car.make_model} - {car.reg_no}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className={`grid grid-cols-1 sm:grid-cols-${isAdmin ? '2' : '3'} gap-4 mb-6`}>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-500 text-white p-2 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Highest Bid</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isAdmin ? (
                      <span>{bids.length} bids</span>
                    ) : (
                      `AED ${highestBid?.toLocaleString() || '0'}`
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 text-white p-2 rounded-lg">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total Bids</p>
                  <p className="text-2xl font-bold text-slate-900">{bids.length}</p>
                </div>
              </div>
            </div>

            {/* Price hidden from admin users */}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
              <p className="mt-4 text-slate-600">Loading bids...</p>
            </div>
          ) : bids.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
              <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">No bids placed yet</p>
            </div>
          ) : (
            <div>
              <h3 className="font-semibold text-slate-900 mb-4">All Bids</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Bidder</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Contact</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {bids.map((bid, index) => (
                      <tr key={bid.id} className={index === 0 ? 'bg-green-50' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            index === 0 ? 'bg-green-500 text-white' :
                            index === 1 ? 'bg-slate-400 text-white' :
                            index === 2 ? 'bg-orange-400 text-white' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {bid.users?.name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          <div>{bid.users?.email}</div>
                          <div className="text-xs">{bid.users?.phone}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                          {isAdmin ? (
                            <span className="text-slate-400">Hidden</span>
                          ) : isBusinessUser ? (
                            `AED ${bid.amount.toLocaleString()}`
                          ) : (
                            `AED ${bid.amount.toLocaleString()}`
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(bid.created_at).toLocaleString('en-US', {
                              timeZone: 'Asia/Dubai',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

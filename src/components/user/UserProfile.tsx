import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LogOut, User as UserIcon, History, Trophy, ArrowLeft, Edit2, X, Mail, Phone, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { Logo } from '../common/Logo';
import { formatDate } from '../../utils/dateUtils';
import { validatePhoneNumber, normalizePhoneNumber } from '../../utils/phoneFormatter';

export function UserProfile() {
  const [biddingHistory, setBiddingHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingField, setEditingField] = useState<'name' | 'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { userProfile, signOut, user, isAdmin } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();

  useEffect(() => {
    if (user) {
      loadBiddingHistory();
    }
  }, [user]);

  const loadBiddingHistory = async () => {
    if (!user) return;

    try {
      setLoadingHistory(true);
      
      // Refresh car statuses to ensure we have current status
      await supabase.rpc('refresh_car_statuses');
      
      // Get all bids for this user with car and lot information
      const { data: bids, error } = await supabase
        .from('bids')
        .select(`
          *,
          car:cars (
            id,
            make_model,
            reg_no,
            year,
            status,
            bidding_enabled,
            bidding_start_date,
            bidding_end_date,
            lot:lots (
              id,
              lot_number,
              status,
              early_closed
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (bids && bids.length > 0) {
        // Get unique car IDs
        const carIds = [...new Set(bids.map(b => b.car_id))];

        // Get all bids for these cars to determine highest bid
        const { data: allCarBids } = await supabase
          .from('bids')
          .select('car_id, amount, user_id, created_at')
          .in('car_id', carIds)
          .order('amount', { ascending: false });

        // Get highest bid for each car
        const highestByCar: Record<string, number> = {};
        const highestBidderByCar: Record<string, string> = {};
        
        allCarBids?.forEach(bid => {
          // Track highest bid amount
          if (!highestByCar[bid.car_id] || bid.amount > highestByCar[bid.car_id]) {
            highestByCar[bid.car_id] = bid.amount;
            highestBidderByCar[bid.car_id] = bid.user_id;
          }
        });

        // Create one entry per car with user's highest bid
        const processedBids = carIds.map(carId => {
          const carBids = bids.filter(b => b.car_id === carId);
          const latestBid = carBids[0]; // Most recent bid
          const car = latestBid.car as any;
          const userHighestBid = Math.max(...carBids.map(b => b.amount));
          const userHighestBidData = carBids.find(b => b.amount === userHighestBid);
          
          // Determine current status
          const now = new Date();
          const biddingStart = car?.bidding_start_date ? new Date(car.bidding_start_date) : null;
          const biddingEnd = car?.bidding_end_date ? new Date(car.bidding_end_date) : null;
          
          let currentStatus = car?.status || 'Unknown';
          if (car?.bidding_enabled === false) {
            currentStatus = 'Disabled';
          } else if (biddingStart && now < biddingStart) {
            currentStatus = 'Upcoming';
          } else if (biddingEnd && now > biddingEnd) {
            currentStatus = 'Closed';
          } else if (car?.status === 'Active' && biddingStart && biddingEnd && now >= biddingStart && now <= biddingEnd) {
            currentStatus = 'Active';
          } else if (car?.status === 'Closed') {
            currentStatus = 'Closed';
          }
          
          // Determine if user is highest bidder
          const isHighestBidder = highestBidderByCar[carId] === user.id;
          
          // Get highest bid amount for this car
          const highestBidAmount = highestByCar[carId] || 0;

          return {
            id: latestBid.id,
            car_id: carId,
            amount: userHighestBid,
            created_at: userHighestBidData?.created_at || latestBid.created_at,
            car: {
              ...car,
              currentStatus // Add current status
            },
            userHighestBid,
            isHighestBidder,
            highestBidAmount, // Add highest bid amount for this car
            totalBidsOnCar: carBids.length,
            lastBidDate: latestBid.created_at
          };
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setBiddingHistory(processedBids);
      } else {
        setBiddingHistory([]);
      }
    } catch (err) {
      console.error('Error loading bidding history:', err);
      setBiddingHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Redirect to main page after logout
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      // Still redirect even if there's an error
      window.location.href = '/';
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleEdit = (field: 'name' | 'email' | 'phone') => {
    // Check if admin for name editing
    if (field === 'name' && !isAdmin) {
      showError('Permission Denied', 'Only administrators can edit names. Please contact an admin for name corrections.');
      return;
    }

    setEditingField(field);
    setEditValue(field === 'name' ? userProfile?.name || '' : field === 'email' ? userProfile?.email || '' : userProfile?.phone || '');
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode('');
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode('');
    setError('');
  };

  const sendOTP = async () => {
    if (!user || !editingField) return;

    setLoading(true);
    setError('');

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

    try {
      const otpData: any = {
        otp_code: otp,
        otp_method: editingField === 'email' ? 'email' : 'mobile',
        expires_at: expiresAt.toISOString(),
        verified: false,
        ...(editingField === 'email' 
          ? { email: editValue.trim().toLowerCase(), phone: null }
          : { phone: normalizePhoneNumber(editValue), email: null }
        ),
      };

      const { error: otpError } = await supabase
        .from('otp_storage')
        .insert(otpData);

      if (otpError) {
        throw otpError;
      }

      // Show OTP in notification for testing (in production, send actual email/SMS)
      if (editingField === 'email') {
        showInfo(
          'OTP Sent',
          `OTP sent to ${editValue}\n\nOTP Code: ${otp}\n(This is for testing - configure email service in production)`,
          10000
        );
      } else {
        showInfo(
          'OTP Sent',
          `OTP sent to ${editValue}\n\nOTP Code: ${otp}\n(This is for testing - configure SMS service in production)`,
          10000
        );
      }

      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
      showError('OTP Error', err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!user || !editingField) return;

    setLoading(true);
    setError('');

    try {
      const query = supabase
        .from('otp_storage')
        .select('*')
        .eq('otp_code', otpCode)
        .eq('otp_method', editingField === 'email' ? 'email' : 'mobile')
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (editingField === 'email') {
        query.eq('email', editValue.trim().toLowerCase());
      } else {
        query.eq('phone', normalizePhoneNumber(editValue));
      }

      const { data: otpData, error: verifyError } = await query.single();

      if (verifyError || !otpData) {
        setError('Invalid or expired OTP code. Please check and try again.');
        return;
      }

      // Mark OTP as verified
      const { error: updateError } = await supabase
        .from('otp_storage')
        .update({ verified: true })
        .eq('id', otpData.id);

      if (updateError) {
        throw updateError;
      }

      setOtpVerified(true);
      showSuccess('OTP Verified', 'OTP verified successfully. You can now save your changes.');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP code. Please try again.');
      showError('Verification Failed', err.message || 'Invalid or expired OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !editingField) return;

    // For email/phone, require OTP verification
    if ((editingField === 'email' || editingField === 'phone') && !otpVerified) {
      setError('Please verify OTP before saving.');
      showError('Verification Required', 'Please verify OTP before saving your changes.');
      return;
    }

    // Validate inputs
    if (!editValue.trim()) {
      setError(`${editingField === 'name' ? 'Name' : editingField === 'email' ? 'Email' : 'Phone'} is required.`);
      return;
    }

    if (editingField === 'email' && !editValue.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (editingField === 'phone') {
      const phoneValidation = validatePhoneNumber(editValue);
      if (!phoneValidation.valid) {
        setError(phoneValidation.message || 'Invalid phone number format.');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const updateData: any = {};
      
      if (editingField === 'name') {
        updateData.name = editValue.trim();
      } else if (editingField === 'email') {
        updateData.email = editValue.trim().toLowerCase();
        // Also update auth email
        const { error: authError } = await supabase.auth.updateUser({
          email: editValue.trim().toLowerCase()
        });
        if (authError) {
          throw new Error(`Failed to update email in authentication: ${authError.message}`);
        }
      } else if (editingField === 'phone') {
        updateData.phone = normalizePhoneNumber(editValue);
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      showSuccess('Profile Updated', `${editingField === 'name' ? 'Name' : editingField === 'email' ? 'Email' : 'Phone number'} updated successfully.`);
      handleCancelEdit();
      
      // Reload user profile
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data) {
        // Update user profile in context would be handled by AuthContext
        window.location.reload(); // Simple reload to refresh profile
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile. Please try again.');
      showError('Update Failed', err.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <header className="bg-white shadow-lg sticky top-0 z-20 border-b-4 border-dl-red">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 text-dl-grey" />
              </button>
              <Logo className="h-10 sm:h-12" />
              <div className="border-l-2 border-dl-red pl-4">
                <p className="text-sm sm:text-base text-dl-grey font-bold tracking-wide uppercase">Profile & History</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 bg-dl-red text-white hover:bg-dl-red-hover rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-semibold"
                aria-label="Sign Out"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-8 pb-12">
        {/* Profile Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-8 border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-dl-red to-red-700 rounded-xl">
              <UserIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-dl-grey">Your Profile</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Name Field */}
            <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-200 relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-dl-grey-light uppercase tracking-wider">Full Name</p>
                {editingField !== 'name' && isAdmin && (
                  <button
                    onClick={() => handleEdit('name')}
                    className="p-1.5 text-dl-grey hover:text-dl-red hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit Name (Admin Only)"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {editingField === 'name' ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                    placeholder="Enter name"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={loading || !editValue.trim()}
                      className="flex-1 px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-lg font-bold text-dl-grey">{userProfile?.name}</p>
              )}
            </div>

            {/* Email Field */}
            <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-200 relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-dl-grey-light uppercase tracking-wider">Email Address</p>
                {editingField !== 'email' && (
                  <button
                    onClick={() => handleEdit('email')}
                    className="p-1.5 text-dl-grey hover:text-dl-red hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit Email (OTP verification required)"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {editingField === 'email' ? (
                <div className="space-y-3">
                  <input
                    type="email"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                    placeholder="Enter email"
                  />
                  {!otpSent ? (
                    <button
                      onClick={sendOTP}
                      disabled={loading || !editValue.trim() || !editValue.includes('@')}
                      className="w-full px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      {loading ? 'Sending...' : 'Send OTP'}
                    </button>
                  ) : !otpVerified ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent text-center text-lg font-mono"
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={verifyOTP}
                          disabled={loading || otpCode.length !== 6}
                          className="flex-1 px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? 'Verifying...' : 'Verify OTP'}
                        </button>
                        <button
                          onClick={sendOTP}
                          disabled={loading}
                          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm"
                        >
                          Resend
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-green-600 font-medium">✓ OTP Verified</div>
                  )}
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={loading || !otpVerified}
                      className="flex-1 px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-lg font-bold text-dl-grey truncate">{userProfile?.email}</p>
              )}
            </div>

            {/* Phone Field */}
            <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-200 relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-dl-grey-light uppercase tracking-wider">Phone Number</p>
                {editingField !== 'phone' && (
                  <button
                    onClick={() => handleEdit('phone')}
                    className="p-1.5 text-dl-grey hover:text-dl-red hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit Phone (OTP verification required)"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {editingField === 'phone' ? (
                <div className="space-y-3">
                  <input
                    type="tel"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                    placeholder="Enter phone number"
                  />
                  {!otpSent ? (
                    <button
                      onClick={sendOTP}
                      disabled={loading || !editValue.trim()}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Phone className="w-4 h-4" />
                      {loading ? 'Sending...' : 'Send OTP'}
                    </button>
                  ) : !otpVerified ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent text-center text-lg font-mono"
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={verifyOTP}
                          disabled={loading || otpCode.length !== 6}
                          className="flex-1 px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? 'Verifying...' : 'Verify OTP'}
                        </button>
                        <button
                          onClick={sendOTP}
                          disabled={loading}
                          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm"
                        >
                          Resend
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-green-600 font-medium">✓ OTP Verified</div>
                  )}
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={loading || !otpVerified}
                      className="flex-1 px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-lg font-bold text-dl-grey">{userProfile?.phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Bidding History */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-dl-yellow to-yellow-600 rounded-xl">
              <History className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dl-grey">Bidding History</h3>
              <p className="text-sm text-dl-grey-light">Track all your bids and auction results</p>
            </div>
          </div>

          {loadingHistory ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-dl-red"></div>
              <p className="mt-4 text-dl-grey-light font-medium">Loading bidding history...</p>
            </div>
          ) : biddingHistory.length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-white rounded-xl border-2 border-dashed border-slate-300">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-10 h-10 text-slate-400" />
              </div>
              <p className="text-lg font-semibold text-dl-grey mb-2">No Bids Yet</p>
              <p className="text-dl-grey-light">Start browsing vehicles and place your first bid!</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table-dl w-full min-w-[600px]">
                <thead>
                  <tr>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-dl-grey uppercase whitespace-nowrap">S.No</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-dl-grey uppercase whitespace-nowrap">Lot #</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-dl-grey uppercase whitespace-nowrap">Car Details</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-dl-grey uppercase whitespace-nowrap">Your Bid</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-dl-grey uppercase whitespace-nowrap hidden sm:table-cell">Bid Date</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-dl-grey uppercase whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {biddingHistory.map((bid, index) => {
                    const car = bid.car as any;
                    const lot = car?.lot as any;
                    return (
                      <tr key={bid.id} className="hover:bg-dl-grey-bg transition-colors">
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-dl-grey">{index + 1}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-dl-grey">{lot?.lot_number || '-'}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-dl-grey">
                          <div>
                            <p className="font-medium truncate max-w-[120px] sm:max-w-none">{car?.make_model || '-'}</p>
                            <p className="text-dl-grey-light text-xs hidden sm:block">{car?.reg_no || '-'} {car?.year ? `• ${car.year}` : ''}</p>
                            <p className="text-dl-grey-light text-xs sm:hidden">{car?.reg_no || '-'}</p>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-dl-grey whitespace-nowrap">
                          AED {bid.amount.toLocaleString()}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-dl-grey-light hidden sm:table-cell">
                          {formatDate(bid.created_at)}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md border ${
                            car?.currentStatus === 'Active' ? 'bg-green-100 text-green-800 border-green-200' :
                            car?.currentStatus === 'Closed' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                            car?.currentStatus === 'Disabled' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                            car?.currentStatus === 'Upcoming' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                            'bg-slate-100 text-slate-800 border-slate-200'
                          }`}>
                            {car?.currentStatus || car?.status || '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


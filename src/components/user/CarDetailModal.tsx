import { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, Calendar, Gauge, MapPin, Clock, CheckCircle, Trophy, ChevronLeft, ChevronRight, Image as ImageIcon, Sparkles, Zap, Shield, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CarDetailModalProps {
  car: any;
  highestBid?: number | undefined; // Optional, not shown to bidders
  onClose: () => void;
  onBidPlaced: () => void;
}

export function CarDetailModal({ car, highestBid: _highestBid, onClose, onBidPlaced }: CarDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [myBids, setMyBids] = useState<any[]>([]);
  const [allBids, setAllBids] = useState<any[]>([]);
  const { user, userProfile } = useAuth();
  const [canBid, setCanBid] = useState(true);
  const [isBiddingEnded, setIsBiddingEnded] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [tempBidAmount, setTempBidAmount] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    loadMyBids();
    checkBiddingStatus();
    loadAllBids();

    // Subscribe to real-time bid changes for this car
    const bidsChannel = supabase
      .channel(`bids-${car.id}-${user?.id}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'bids',
          filter: `car_id=eq.${car.id}`
        }, 
        (payload) => {
          // Reload bids when any bid changes for this car
          if (payload.eventType === 'DELETE' || payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            loadMyBids();
            loadAllBids();
          }
        }
      )
      .subscribe();

    return () => {
      bidsChannel.unsubscribe();
    };
  }, [car.id, user, car.bidding_end_date]);

  // Get current bid - ensure it's the most recent one
  const userCurrentBid = myBids && myBids.length > 0 ? myBids[0] : null;

  // Initialize tempBidAmount only when modal first opens (not when userCurrentBid changes)
  // Use a ref to track if we've already initialized to prevent resetting when switching tabs
  const bidModalInitializedRef = useRef(false);
  
  useEffect(() => {
    if (showBidModal && !bidModalInitializedRef.current) {
      // Modal just opened - initialize the bid amount
      if (userCurrentBid) {
        setTempBidAmount(userCurrentBid.amount.toString());
      } else {
        setTempBidAmount('');
      }
      bidModalInitializedRef.current = true;
    } else if (!showBidModal) {
      // Modal closed - reset the flag for next time
      bidModalInitializedRef.current = false;
    }
  }, [showBidModal, userCurrentBid]);

  const checkBiddingStatus = () => {
    const now = new Date().getTime();
    const endTime = new Date(car.bidding_end_date).getTime();
    const isApproved = userProfile?.approved === true;
    const ended = now > endTime;
    setIsBiddingEnded(ended);
    setCanBid(!ended && isApproved);
  };

  const loadAllBids = async () => {
    try {
      // Get highest bid
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          users (name, email, phone)
        `)
        .eq('car_id', car.id)
        .order('amount', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error loading bids:', error);
        setAllBids([]);
        return;
      }

      if (data) {
        setAllBids(data);
      } else {
        setAllBids([]);
      }
    } catch (err) {
      console.error('Error in loadAllBids:', err);
      setAllBids([]);
    }
  };

  const loadMyBids = async () => {
    if (!user) {
      setMyBids([]);
      return;
    }
    // Only get the most recent bid for this user on this car
    // Since we update existing bids instead of creating new ones, there should only be one
    const { data, error } = await supabase
      .from('bids')
      .select('*')
      .eq('car_id', car.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error loading bids:', error);
      setMyBids([]);
      return;
    }

    // Always set myBids, even if empty
    setMyBids(data || []);
  };

  const getTimeRemaining = () => {
    const now = new Date().getTime();
    const end = new Date(car.bidding_end_date).getTime();
    const diff = end - now;

    if (diff <= 0) return 'Auction Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days} days ${hours} hours remaining`;
    if (hours > 0) return `${hours} hours ${minutes} minutes remaining`;
    return `${minutes} minutes remaining`;
  };

  const handlePlaceBid = async () => {
    setError('');
    setSuccess(false);

    // Check if terms are accepted (stored in localStorage)
    if (user) {
      const termsAcceptedKey = `terms_accepted_${user.id}`;
      const termsAccepted = localStorage.getItem(termsAcceptedKey);
      if (!termsAccepted) {
        setError('Please accept the Terms and Conditions first. The terms modal should appear when you first visit the bidding page.');
        setShowBidModal(false);
        return;
      }
    }

    // Check if user is approved
    if (!userProfile?.approved) {
      setError('Your account is pending approval. You cannot bid until approved.');
      setShowBidModal(false);
      return;
    }

    // Check if bidding is still open
    const now = new Date().getTime();
    const endTime = new Date(car.bidding_end_date).getTime();
    if (now > endTime) {
      setError('Bidding has closed for this vehicle.');
      setShowBidModal(false);
      return;
    }

    // Check if lot is approved and not early closed
    const { data: lotData } = await supabase
      .from('lots')
      .select('approved, early_closed, status')
      .eq('id', car.lot_id)
      .single();

    if (!lotData?.approved || lotData?.early_closed) {
      setError('Bidding is not available for this vehicle.');
      setShowBidModal(false);
      return;
    }

    const amount = parseFloat(tempBidAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid bid amount.');
      return;
    }

    setLoading(true);

    try {
      if (!user) {
        throw new Error('User not found');
      }

      // Delete ALL existing bids for this user on this car first (ensures only one bid exists)
      const { error: deleteError } = await supabase
        .from('bids')
        .delete()
        .eq('car_id', car.id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Create new bid (only one bid per user per car)
      const { error: bidError } = await supabase.from('bids').insert({
        car_id: car.id,
        user_id: user.id,
        amount,
      });

      if (bidError) throw bidError;
      
      // Reload bids to reflect changes
      await loadMyBids();
      setSuccess(true);
      setShowBidModal(false);
      onBidPlaced();

      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to place bid');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteBid = async (bidId: string) => {
    console.log('Delete bid clicked:', bidId);
    
    if (!window.confirm('Are you sure you want to delete this bid?')) {
      return;
    }

    // Check if bidding is still open
    const now = new Date().getTime();
    const endTime = new Date(car.bidding_end_date).getTime();
    if (now > endTime) {
      setError('Bidding has closed. You cannot delete bids after closure.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!user) {
        throw new Error('User not found');
      }

      // Delete ALL bids for this user on this car (in case there are duplicates)
      console.log('Deleting all bids for user on car:', { car_id: car.id, user_id: user.id });
      const { error: bidError, data } = await supabase
        .from('bids')
        .delete()
        .eq('car_id', car.id)
        .eq('user_id', user.id)
        .select();

      console.log('Delete result:', { error: bidError, data });
      if (bidError) {
        console.error('Delete error:', bidError);
        throw bidError;
      }

      // Immediately clear the bid state to update UI
      setMyBids([]);
      setTempBidAmount('');
      
      // Verify deletion - should be no bids left
      const { data: verifyBids } = await supabase
        .from('bids')
        .select('id')
        .eq('car_id', car.id)
        .eq('user_id', user.id);
      
      // Force clear if any bids still exist (shouldn't happen, but safety check)
      if (!verifyBids || verifyBids.length === 0) {
        setMyBids([]);
      } else {
        // If bids still exist, delete them again (shouldn't happen)
        console.warn('Bids still exist after deletion, attempting to delete again');
        await supabase
          .from('bids')
          .delete()
          .eq('car_id', car.id)
          .eq('user_id', user.id);
        setMyBids([]);
      }
      
      // Reload to confirm
      await loadMyBids();
      
      setSuccess(true);
      
      // Notify parent to refresh
      onBidPlaced();

      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete bid');
    } finally {
      setLoading(false);
    }
  };

  // Get highest bid (if any)
  const highestBid = allBids.length > 0 ? allBids[0] : null;

  // Get car images
  const carImages = car.images && Array.isArray(car.images) && car.images.length > 0 
    ? car.images.filter((img: string) => img && img.trim() !== '')
    : [];

  const nextImage = () => {
    if (carImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % carImages.length);
    }
  };

  const prevImage = () => {
    if (carImages.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + carImages.length) % carImages.length);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-scale-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-7xl w-full max-h-[98vh] my-4 sm:my-8 flex flex-col overflow-hidden border border-white/20 backdrop-blur-xl">
        {/* Premium Header with Gradient */}
        <div className="relative flex items-center justify-between p-4 sm:p-6 border-b border-slate-200/50 bg-gradient-to-r from-slate-50 via-white to-slate-50 flex-shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-dl-red to-red-700 rounded-xl sm:rounded-2xl shadow-lg">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-dl-grey mb-0.5 sm:mb-1 bg-gradient-to-r from-dl-grey to-slate-700 bg-clip-text text-transparent">
                Vehicle Details
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Review specifications and place your bid</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 text-slate-400 hover:text-white hover:bg-gradient-to-br hover:from-dl-red hover:to-red-700 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-110 active:scale-95"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
          {/* Vehicle Title */}
          <div className="mb-4 sm:mb-6">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-dl-grey mb-2 leading-tight">
              {car.make_model}
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 lg:items-stretch">
            {/* Left Column - Vehicle Image Gallery */}
            <div className="relative flex">
              {carImages.length > 0 ? (
                <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl group">
                  <img
                    src={carImages[currentImageIndex]}
                    alt={`${car.make_model} - Image ${currentImageIndex + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onLoad={() => setImageLoading(false)}
                    onError={() => setImageLoading(false)}
                  />
                  {imageLoading && (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 animate-pulse flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-slate-400" />
                    </div>
                  )}
                  
                  {/* Image Navigation */}
                  {carImages.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-xl hover:bg-white transition-all duration-300 opacity-0 group-hover:opacity-100 transform hover:scale-110 z-10"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-dl-grey" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-xl hover:bg-white transition-all duration-300 opacity-0 group-hover:opacity-100 transform hover:scale-110 z-10"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-dl-grey" />
                      </button>
                      
                      {/* Image Indicators */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                        {carImages.map((_img: string, index: number) => (
                          <button
                            key={index}
                            onClick={() => setCurrentImageIndex(index)}
                            className={`h-2 rounded-full transition-all duration-300 ${
                              index === currentImageIndex
                                ? 'w-8 bg-white shadow-lg'
                                : 'w-2 bg-white/50 hover:bg-white/75'
                            }`}
                            aria-label={`Go to image ${index + 1}`}
                          />
                        ))}
                      </div>
                      
                      {/* Image Counter */}
                      <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs font-bold">
                        {currentImageIndex + 1} / {carImages.length}
                      </div>
                    </>
                  )}
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none"></div>
                </div>
              ) : (
                <div className="relative w-full h-full bg-slate-800 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
                  <div className="text-center px-4">
                    {/* Chart Icon in Circular Background */}
                    <div className="mb-6 sm:mb-8 flex justify-center">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 bg-slate-700 rounded-full flex items-center justify-center shadow-lg">
                        <TrendingUp className="w-12 h-12 sm:w-14 sm:h-14 text-white" />
                      </div>
                    </div>
                    
                    {/* Live Auction Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-dl-red rounded-full">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-white font-bold text-xs sm:text-sm uppercase tracking-wider">Live Auction</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Bidding Interface */}
            <div className="space-y-4 sm:space-y-6">
              {success && (
                <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 border-2 border-green-300 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-xl animate-scale-in">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2.5 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex-shrink-0 shadow-lg">
                      <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base sm:text-lg font-extrabold text-green-900 mb-1.5">
                        {userCurrentBid ? 'Bid Updated Successfully!' : 'Bid Placed Successfully!'}
                      </p>
                      <p className="text-xs sm:text-sm text-green-700 leading-relaxed font-medium">
                        {userCurrentBid
                          ? 'Your bid has been updated. You can continue to modify or delete it until the auction closes.'
                          : 'Your bid has been recorded. You can edit or delete it until the auction closes.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-gradient-to-r from-red-50 via-rose-50 to-red-50 border-2 border-red-300 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-xl animate-scale-in">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-500 rounded-lg flex-shrink-0">
                      <X className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm sm:text-base text-red-800 font-bold leading-relaxed">{error}</p>
                  </div>
                </div>
              )}

              {isBiddingEnded && !highestBid && (
                <div className="mb-4 sm:mb-6 p-5 sm:p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-300 rounded-2xl sm:rounded-3xl shadow-xl">
                  <div className="flex items-start gap-4 sm:gap-5">
                    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-400 to-slate-500 text-white flex-shrink-0 shadow-lg">
                      <Clock className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2 sm:mb-3">
                        Auction Ended
                      </h3>
                      <p className="text-slate-700 text-sm sm:text-base md:text-lg">
                        No bids were placed for this vehicle. The auction has been closed.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {canBid ? (
                <div>
                  {userCurrentBid ? (
                    <div className="bg-gradient-to-br from-red-50 via-red-50/80 to-red-50/50 border-2 border-dl-red rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 shadow-xl">
                      <div className="mb-4 sm:mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Award className="w-4 h-4 text-dl-red" />
                          <p className="text-xs font-bold text-dl-red uppercase tracking-wider">Your Current Bid</p>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-xl sm:text-2xl font-bold text-dl-red">AED</span>
                          <span className="text-4xl sm:text-5xl font-extrabold text-dl-red">
                            {userCurrentBid.amount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-dl-red font-medium">
                          Placed on {new Date(userCurrentBid.created_at).toLocaleString('en-US', {
                            timeZone: 'Asia/Dubai',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <button
                          type="button"
                          onClick={() => setShowBidModal(true)}
                          disabled={loading}
                          className="flex-1 px-5 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-dl-red to-red-700 text-white font-bold rounded-xl hover:from-dl-red-hover hover:to-red-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                        >
                          <Zap className="w-4 h-4" />
                          Update Bid
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBid(userCurrentBid.id)}
                          disabled={loading}
                          className="px-5 sm:px-6 py-3 sm:py-4 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                          Delete Bid
                        </button>
                      </div>
                      <div className="p-3 sm:p-4 bg-white/60 rounded-xl border border-dl-red/30">
                        <p className="text-xs text-dl-red font-medium leading-relaxed">
                          💡 You can modify or withdraw your bid amount at any time before the auction closes
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 border-2 border-slate-300 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 shadow-xl">
                      <div className="mb-4 sm:mb-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-5 h-5 text-dl-red" />
                          <h4 className="text-xl sm:text-2xl font-extrabold text-dl-grey">Ready to Bid?</h4>
                        </div>
                        <p className="text-sm sm:text-base text-slate-600">Place your bid now to participate in this auction</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBidModal(true)}
                        disabled={loading}
                        className="w-full px-6 sm:px-8 py-4 sm:py-5 bg-gradient-to-r from-dl-red to-red-700 text-white font-bold text-base sm:text-lg rounded-xl sm:rounded-2xl hover:from-dl-red-hover hover:to-red-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2"
                      >
                        <Trophy className="w-5 h-5" />
                        Place Your Bid
                      </button>
                      <div className="mt-4 p-3 sm:p-4 bg-white rounded-xl border border-slate-200">
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                          💡 Enter your maximum bid amount. You can edit or remove it until the auction ends
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 sm:p-6 bg-gradient-to-r from-red-50 via-rose-50 to-red-50 border-2 border-red-300 rounded-2xl shadow-lg">
                  <div className="flex items-center gap-3 justify-center">
                    <Shield className="w-5 h-5 text-red-600" />
                    <p className="text-sm sm:text-base text-red-800 font-semibold text-center">
                      {!userProfile?.approved
                        ? '⏳ Your account is pending approval. You cannot bid until approved.'
                        : '🔒 Bidding has closed for this vehicle.'}
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* All Fields Below Auction/Bid Section - Responsive Grid */}
          {/* Line 1: Lot#, Fleet #, Reg #, Chassis # */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            {(car.lot?.lot_number || car.lot_number) && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-blue-200 shadow-md hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Lot#</span>
                </div>
                <p className="text-sm sm:text-base font-extrabold text-blue-900 break-words group-hover:scale-105 transition-transform">{car.lot?.lot_number || car.lot_number}</p>
              </div>
            )}

            {car.fleet_no && (
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-teal-200 shadow-md hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-2 text-teal-700 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Fleet #</span>
                </div>
                <p className="text-sm sm:text-base font-extrabold text-teal-900 break-words group-hover:scale-105 transition-transform">{car.fleet_no}</p>
              </div>
            )}

            {car.reg_no && (
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-indigo-200 shadow-md hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-2 text-indigo-700 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Reg #</span>
                </div>
                <p className="text-sm sm:text-base font-extrabold text-indigo-900 break-words group-hover:scale-105 transition-transform">{car.reg_no}</p>
              </div>
            )}

            {car.chassis_no && (
              <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-rose-200 shadow-md hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-2 text-rose-700 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Chassis #</span>
                </div>
                <p className="text-xs sm:text-sm font-extrabold text-rose-900 break-all group-hover:scale-105 transition-transform">{car.chassis_no}</p>
              </div>
            )}
          </div>

          {/* Line 2: Year, KM, Color, Type/Model */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            {car.year && (
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-cyan-200 shadow-md hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-2 text-cyan-700 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Year</span>
                </div>
                <p className="text-base sm:text-lg font-extrabold text-cyan-900 group-hover:scale-105 transition-transform">{car.year}</p>
              </div>
            )}

            {car.km && (
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-green-200 shadow-md hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <Gauge className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">KM</span>
                </div>
                <p className="text-base sm:text-lg font-extrabold text-green-900 group-hover:scale-105 transition-transform">{car.km.toLocaleString()}</p>
              </div>
            )}

            {car.color && (
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-amber-200 shadow-md hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-2 text-amber-700 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Color</span>
                </div>
                <p className="text-sm sm:text-base font-extrabold text-amber-900 break-words group-hover:scale-105 transition-transform">{car.color}</p>
              </div>
            )}

            {car.body_type && (
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-emerald-200 shadow-md hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-2 text-emerald-700 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Type / Model</span>
                </div>
                <p className="text-sm sm:text-base font-extrabold text-emerald-900 break-words group-hover:scale-105 transition-transform">{car.body_type}</p>
              </div>
            )}
          </div>

          {/* Line 3: Make, Current Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
            {car.make_model && (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-slate-200 shadow-md hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-2 text-slate-700 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Make</span>
                </div>
                <p className="text-sm sm:text-base font-extrabold text-slate-900 break-words group-hover:scale-105 transition-transform">{car.make_model}</p>
              </div>
            )}

            {car.current_location && (
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-purple-200 shadow-md hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-2 text-purple-700 mb-2">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Current Location</span>
                </div>
                <p className="text-sm sm:text-base font-extrabold text-purple-900 break-words group-hover:scale-105 transition-transform">{car.current_location}</p>
              </div>
            )}
          </div>

          {/* Time Remaining - Single Line */}
          <div className="bg-gradient-to-r from-orange-50 via-red-50 to-orange-50 border-2 border-orange-300 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-2.5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg sm:rounded-xl shadow-lg">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs text-orange-600 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Time Remaining</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-orange-900">{getTimeRemaining()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bid Modal */}
      {showBidModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-scale-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/20">
            <div className="bg-gradient-to-r from-dl-red via-red-700 to-dl-red p-5 sm:p-6">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-extrabold mb-0.5 sm:mb-1">
                      {userCurrentBid ? 'Update Your Bid' : 'Place Your Bid'}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/90">Enter your maximum bid amount</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowBidModal(false);
                    setError('');
                  }}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95"
                  aria-label="Close bid modal"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {error && (
                <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-xl p-3 sm:p-4 mb-4 animate-scale-in">
                  <div className="flex items-start gap-2">
                    <X className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 font-semibold text-xs sm:text-sm leading-relaxed">{error}</p>
                  </div>
                </div>
              )}

              <div className="mb-5 sm:mb-6">
                <label className="block text-xs sm:text-sm font-bold text-dl-grey uppercase tracking-wider mb-2 sm:mb-3">
                  Bid Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 sm:left-5 top-1/2 transform -translate-y-1/2 text-dl-grey text-lg sm:text-xl font-bold pointer-events-none z-10">AED</span>
                  <input
                    type="number"
                    value={tempBidAmount}
                    onChange={(e) => setTempBidAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                    disabled={loading}
                    autoFocus
                    className="w-full pl-16 sm:pl-20 pr-5 sm:pr-6 py-4 sm:py-5 text-xl sm:text-2xl font-bold border-2 border-slate-300 rounded-xl sm:rounded-2xl bg-slate-50 shadow-inner focus:ring-4 focus:ring-dl-red/20 focus:border-dl-red focus:bg-white transition-all duration-300 disabled:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 placeholder:text-slate-400"
                    placeholder="0.00"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 font-medium">
                  Enter the maximum amount you're willing to pay for this vehicle
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowBidModal(false);
                    setError('');
                    setTempBidAmount('');
                  }}
                  disabled={loading}
                  className="flex-1 px-5 sm:px-6 py-3 sm:py-4 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-all duration-300 disabled:opacity-50 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePlaceBid}
                  disabled={loading || !tempBidAmount || parseFloat(tempBidAmount) <= 0}
                  className="flex-1 px-5 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-dl-red to-red-700 text-white font-bold rounded-xl hover:from-dl-red-hover hover:to-red-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>{userCurrentBid ? 'Updating...' : 'Placing...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>{userCurrentBid ? 'Update Bid' : 'Confirm Bid'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

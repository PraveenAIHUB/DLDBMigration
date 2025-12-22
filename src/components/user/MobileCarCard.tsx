import { Clock, MapPin, Gauge, Calendar, TrendingUp, CheckSquare, Square, Activity, CheckCircle2 } from 'lucide-react';

interface MobileCarCardProps {
  car: any;
  isSelected: boolean;
  userBid?: number;
  onSelect: (carId: string) => void;
  onClick: (car: any) => void;
}

export function MobileCarCard({ car, isSelected, userBid, onSelect, onClick }: MobileCarCardProps) {
  const getTimeRemaining = (endDate: string) => {
    const now = new Date().getTime();
    const end = new Date(endDate).getTime();
    const diff = end - now;

    if (diff <= 0) return { text: 'Ended', color: 'text-red-600' };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return { text: `${days}d ${hours}h left`, color: 'text-green-600' };
    if (hours > 0) return { text: `${hours}h ${minutes}m left`, color: 'text-orange-600' };
    return { text: `${minutes}m left`, color: 'text-red-600' };
  };

  const timeRemaining = getTimeRemaining(car.bidding_end_date);

  return (
    <div
      onClick={() => onClick(car)}
      className={`card-dl hover:shadow-dl-lg transition-all duration-200 cursor-pointer relative overflow-hidden h-full flex flex-col ${
        isSelected ? 'ring-2 ring-dl-red bg-red-50' : ''
      } ${
        userBid && !isSelected ? 'ring-2 ring-dl-red bg-red-50/50 border border-dl-red/30' : ''
      } ${
        userBid && isSelected ? 'ring-2 ring-dl-red bg-red-50 border-l-4 border-dl-red' : ''
      }`}
    >
      {/* Highlight indicator stripe */}
      {userBid && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-dl-red via-dl-red-hover to-dl-red z-0"></div>
      )}
      {/* Selection Checkbox - Top Right */}
      <div className="flex justify-between items-start mb-3 pt-2 relative z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(car.id);
          }}
          className="p-2 -m-2 touch-target z-10 flex-shrink-0"
        >
          {isSelected ? (
            <CheckSquare className="w-6 h-6 text-dl-red" />
          ) : (
            <Square className="w-6 h-6 text-dl-grey-light" />
          )}
        </button>

        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {/* User Bid Badge */}
          {userBid && (
            <div className="px-2.5 py-1 rounded-full text-xs font-semibold text-dl-red bg-dl-grey-bg border border-dl-red shadow-sm flex items-center gap-1 whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
              <span>You Bid</span>
            </div>
          )}
          {/* Time Remaining Badge */}
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${timeRemaining.color} bg-white border whitespace-nowrap ${
            timeRemaining.text === 'Ended' ? 'border-red-200' : 'border-current'
          }`}>
            <Clock className="w-3 h-3 inline mr-1" />
            {timeRemaining.text}
          </div>
        </div>
      </div>

      {/* Car Icon/Image Area */}
      <div className="bg-gradient-to-br from-dl-grey-bg to-dl-grey-bg-alt rounded-dl p-6 mb-4 text-center relative flex-shrink-0">
        {userBid && (
          <div className="absolute top-3 right-3 w-7 h-7 bg-dl-red rounded-full flex items-center justify-center shadow-md z-10">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
        )}
        <div className={`w-16 h-16 ${userBid ? 'bg-dl-red' : 'bg-dl-red'} rounded-full flex items-center justify-center mx-auto mb-2 shadow-md transition-colors`}>
          <TrendingUp className="w-8 h-8 text-white" />
        </div>
        <p className="text-xs text-dl-grey-light font-medium">Tap to view & bid</p>
      </div>

      {/* Car Title */}
      <h3 className="text-lg font-bold text-dl-grey mb-3 line-clamp-2 min-h-[3.5rem]">
        {car.make_model || 'Vehicle'}
      </h3>

      {/* Car Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-dl-grey-light flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-dl-grey-light">Year</p>
            <p className="text-sm font-semibold text-dl-grey truncate">{car.year || 'N/A'}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-dl-grey-light flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-dl-grey-light">Location</p>
            <p className="text-sm font-semibold text-dl-grey truncate">{car.location || 'N/A'}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Activity className="w-4 h-4 text-dl-grey-light flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-dl-grey-light">Mileage</p>
            <p className="text-sm font-semibold text-dl-grey truncate">
              {car.km ? `${car.km.toLocaleString()} km` : 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Gauge className="w-4 h-4 text-dl-grey-light flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-dl-grey-light">Reg No</p>
            <p className="text-sm font-semibold text-dl-grey truncate">{car.reg_no || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Bid Section - Push to bottom */}
      <div className="mt-auto pt-4">
        {userBid && (
          <div className="border-t border-dl-grey-medium pt-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-dl-grey-light mb-1">Your Current Bid</p>
                <p className="text-lg font-bold text-dl-red">
                  AED {userBid.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick(car);
          }}
          className="btn-primary w-full"
        >
          View Details & Bid
        </button>
      </div>
    </div>
  );
}

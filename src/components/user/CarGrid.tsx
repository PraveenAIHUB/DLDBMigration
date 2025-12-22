import { useState, useEffect } from 'react';
import { MapPin, Gauge, Calendar, TrendingUp, Clock } from 'lucide-react';
import { CarDetailModal } from './CarDetailModal';
import { supabase } from '../../lib/supabase';

interface CarGridProps {
  cars: any[];
  onBidPlaced: () => void;
}

export function CarGrid({ cars, onBidPlaced }: CarGridProps) {
  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  const [highestBids, setHighestBids] = useState<Record<string, number>>({});

  useEffect(() => {
    loadHighestBids();
  }, [cars]);

  const loadHighestBids = async () => {
    const carIds = cars.map(c => c.id);
    const { data } = await supabase
      .from('bids')
      .select('car_id, amount')
      .in('car_id', carIds);

    if (data) {
      const highest: Record<string, number> = {};
      data.forEach(bid => {
        if (!highest[bid.car_id] || bid.amount > highest[bid.car_id]) {
          highest[bid.car_id] = bid.amount;
        }
      });
      setHighestBids(highest);
    }
  };

  const getTimeRemaining = (endDate: string) => {
    const now = new Date().getTime();
    const end = new Date(endDate).getTime();
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {cars.map((car) => {
          const highestBid = highestBids[car.id];
          const timeRemaining = getTimeRemaining(car.bidding_end_date);

          return (
            <div
              key={car.id}
              onClick={() => setSelectedCar(car)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group"
            >
              <div className="h-40 sm:h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent"></div>
                <div className="relative z-10 text-center px-2">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Click to view details & bid</p>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="mb-3 sm:mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 group-hover:text-red-600 transition-colors line-clamp-1">
                    {car.make_model}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600">{car.reg_no}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4 text-xs sm:text-sm">
                  <div className="flex items-center gap-1 sm:gap-2 text-slate-600">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{car.year}</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 text-slate-600">
                    <Gauge className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{car.km?.toLocaleString()} km</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 text-slate-600 col-span-2">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{car.location}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 pt-3 sm:pt-4 border-t border-slate-200">
                  <div>
                    <p className="text-xs text-slate-600">Current Bid</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">
                      AED {highestBid?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="flex items-center gap-1 text-orange-600 text-xs sm:text-sm font-medium">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="text-xs">{timeRemaining}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedCar && (
        <CarDetailModal
          car={selectedCar}
          highestBid={highestBids[selectedCar.id]}
          onClose={() => setSelectedCar(null)}
          onBidPlaced={() => {
            onBidPlaced();
            loadHighestBids();
          }}
        />
      )}
    </>
  );
}

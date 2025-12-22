import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Car, TrendingUp, Clock, X, Upload, LogOut, Download, Users, FileText, CheckCircle } from 'lucide-react';
import { CarList } from './CarList';
import { LotManagement } from './LotManagement';
import { BusinessUserManagement } from './BusinessUserManagement';
import { BidderApprovalManagement } from './BidderApprovalManagement';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../common/Logo';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'lots' | 'cars' | 'bidders' | 'business'>('lots');
  const [stats, setStats] = useState({
    totalCars: 0,
    activeBids: 0,
    closedBids: 0,
    carsWithoutBids: 0,
    pendingLots: 0,
    pendingBidders: 0,
  });
  const { signOut } = useAuth();

  useEffect(() => {
    // Refresh car and lot statuses on load to ensure they're up to date
    // Silently fail if RPC doesn't exist or fails - don't show popup
    const refreshStatuses = async () => {
      try {
        const { error } = await supabase.rpc('refresh_car_statuses');
        // Check for 403 or permission errors - these are expected if RPC doesn't exist or user doesn't have permission
        if (error) {
          // Only log if it's not a permission/not found error
          if (error.code !== 'PGRST301' && error.code !== '42501' && !error.message.includes('permission denied') && !error.message.includes('does not exist')) {
            console.debug('Status refresh failed (non-critical):', error);
          }
        }
      } catch (error: any) {
        // Silently fail - don't show any notification or popup
        // This is a background operation and shouldn't interrupt the user
        // Check for 403 or permission errors
        if (error?.status !== 403 && error?.code !== 'PGRST301' && error?.code !== '42501' && !error?.message?.includes('permission denied')) {
          console.debug('Status refresh failed (non-critical):', error);
        }
      }
    };
    
    // Run refresh in background without blocking
    refreshStatuses().catch(() => {
      // Silently ignore any unhandled errors (including 403)
    });
    loadStats();
    
    // Listen for lot approval/deletion events to refresh stats
    const handleLotApproved = () => {
      loadStats();
    };
    
    const handleLotDeleted = () => {
      loadStats();
    };
    
    window.addEventListener('lotApproved', handleLotApproved);
    window.addEventListener('lotDeleted', handleLotDeleted);
    
    return () => {
      window.removeEventListener('lotApproved', handleLotApproved);
      window.removeEventListener('lotDeleted', handleLotDeleted);
    };
  }, []);

  const loadStats = async () => {
    try {
      const { data: cars } = await supabase.from('cars').select('id, status');
      const { data: bids } = await supabase.from('bids').select('car_id');
      
      const { count: pendingLots } = await supabase
        .from('lots')
        .select('*', { count: 'exact', head: true })
        .eq('approved', false);
      
      // Get pending bidders - check if role column exists, otherwise filter manually
      let pendingBidders = 0;
      try {
        const { data: allUsers } = await supabase
          .from('users')
          .select('id, role, approved');
        
        if (allUsers) {
          // Get admin and business user IDs to exclude
          const { data: adminUsers } = await supabase
            .from('admin_users')
            .select('id');
          const { data: businessUsers } = await supabase
            .from('business_users')
            .select('id');
          
          const adminIds = new Set(adminUsers?.map(a => a.id) || []);
          const businessIds = new Set(businessUsers?.map(b => b.id) || []);
          
          pendingBidders = allUsers.filter(u => {
            // Exclude admins and business users
            if (adminIds.has(u.id) || businessIds.has(u.id)) return false;
            // Include bidders (role = 'bidder' or null) who are not approved
            return (u.role === 'bidder' || !u.role) && !u.approved;
          }).length;
        }
      } catch (err) {
        console.error('Error loading pending bidders:', err);
      }
      
      const totalCars = cars?.length || 0;
      const activeBids = cars?.filter(c => c.status === 'Active').length || 0;
      const closedBids = cars?.filter(c => c.status === 'Closed').length || 0;

      const carsWithBids = new Set(bids?.map(b => b.car_id) || []);
      const carsWithoutBids = cars?.filter(c => !carsWithBids.has(c.id)).length || 0;

      setStats({
        totalCars,
        activeBids,
        closedBids,
        carsWithoutBids,
        pendingLots: pendingLots || 0,
        pendingBidders,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      // Don't show alert to user, just log the error
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-dl-grey-bg">
      <header className="bg-white border-b border-dl-grey-medium sticky top-0 z-10 shadow-dl">
        <div className="accent-bar"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Logo className="h-9 sm:h-10" />
              <div className="border-l-2 border-dl-grey-medium pl-3 ml-1">
                <h1 className="text-base sm:text-lg font-bold text-dl-grey">Admin Dashboard</h1>
                <p className="text-xs text-dl-grey-light hidden md:block">Management Portal</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-dl-red text-white hover:bg-dl-red-hover rounded-dl-sm transition-colors touch-target"
              aria-label="Sign Out"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className="hidden sm:inline font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-10">
          <StatCard
            icon={<Car className="w-7 h-7" />}
            title="Total Cars"
            value={stats.totalCars}
            color="bg-dl-red"
          />
          <StatCard
            icon={<TrendingUp className="w-7 h-7" />}
            title="Active Cars"
            value={stats.activeBids}
            color="bg-green-600"
          />
          <StatCard
            icon={<FileText className="w-7 h-7" />}
            title="Pending Lots"
            value={stats.pendingLots}
            color="bg-dl-yellow"
            badge={stats.pendingLots > 0}
          />
          <StatCard
            icon={<Users className="w-7 h-7" />}
            title="Pending Bidders"
            value={stats.pendingBidders}
            color="bg-blue-600"
            badge={stats.pendingBidders > 0}
          />
        </div>

        <div className="card-dl mb-6 sm:mb-8">
          <div className="border-b border-dl-grey-medium">
            <nav className="flex -mb-px overflow-x-auto scrollbar-hide -mx-6 sm:mx-0 px-6 sm:px-0">
              <style>{`
                .scrollbar-hide {
                  -ms-overflow-style: none;
                  scrollbar-width: none;
                }
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <button
                onClick={() => setActiveTab('lots')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold border-b-3 transition-colors relative whitespace-nowrap flex-shrink-0 touch-target ${
                  activeTab === 'lots'
                    ? 'border-dl-red text-dl-red'
                    : 'border-transparent text-dl-grey-light hover:text-dl-grey hover:border-dl-grey-medium'
                }`}
              >
                <FileText className="w-5 h-5 inline mr-2" />
                <span>Lots</span>
                {stats.pendingLots > 0 && (
                  <span className="ml-2 bg-dl-red text-white text-xs rounded-full px-2 py-0.5 font-bold">
                    {stats.pendingLots}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('cars')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold border-b-3 transition-colors whitespace-nowrap flex-shrink-0 touch-target ${
                  activeTab === 'cars'
                    ? 'border-dl-red text-dl-red'
                    : 'border-transparent text-dl-grey-light hover:text-dl-grey hover:border-dl-grey-medium'
                }`}
              >
                <Car className="w-5 h-5 inline mr-2" />
                <span>Cars</span>
              </button>
              <button
                onClick={() => setActiveTab('bidders')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold border-b-3 transition-colors relative whitespace-nowrap flex-shrink-0 touch-target ${
                  activeTab === 'bidders'
                    ? 'border-dl-red text-dl-red'
                    : 'border-transparent text-dl-grey-light hover:text-dl-grey hover:border-dl-grey-medium'
                }`}
              >
                <CheckCircle className="w-5 h-5 inline mr-2" />
                <span className="hidden sm:inline">Bidder Approval</span>
                <span className="sm:hidden">Bidders</span>
                {stats.pendingBidders > 0 && (
                  <span className="ml-2 bg-dl-red text-white text-xs rounded-full px-2 py-0.5 font-bold">
                    {stats.pendingBidders}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('business')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold border-b-3 transition-colors whitespace-nowrap flex-shrink-0 touch-target ${
                  activeTab === 'business'
                    ? 'border-dl-red text-dl-red'
                    : 'border-transparent text-dl-grey-light hover:text-dl-grey hover:border-dl-grey-medium'
                }`}
              >
                <Users className="w-4 h-4 inline mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Business Users</span>
                <span className="sm:hidden">Business</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'lots' && <LotManagement onDataChange={loadStats} />}
          {activeTab === 'cars' && <CarList onDataChange={loadStats} />}
          {activeTab === 'bidders' && <BidderApprovalManagement onUpdate={loadStats} />}
          {activeTab === 'business' && <BusinessUserManagement />}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, title, value, color, badge }: { icon: React.ReactNode; title: string; value: number; color: string; badge?: boolean }) {
  return (
    <div className="card-dl hover:shadow-dl-lg transition-shadow duration-200">
      <div className="flex items-center gap-4">
        <div className={`${color} text-white p-3 rounded-dl flex-shrink-0 shadow-md`}>
          <div className="w-7 h-7">{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-dl-grey-light text-sm font-medium truncate mb-1">{title}</p>
          <p className="text-3xl sm:text-4xl font-bold text-dl-grey">{value}</p>
        </div>
        {badge && value > 0 && (
          <div className="bg-dl-red text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 shadow-md">
            !
          </div>
        )}
      </div>
    </div>
  );
}

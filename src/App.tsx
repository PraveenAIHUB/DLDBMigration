import { useEffect, useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UserAuth } from './components/user/UserAuth';
import { UserProfile } from './components/user/UserProfile';
import { BusinessUserDashboard } from './components/business/BusinessUserDashboard';
import { BusinessUserLogin } from './components/business/BusinessUserLogin';
import { ResetPassword } from './components/auth/ResetPassword';
import { SessionWarning } from './components/common/SessionWarning';

// Lazy load UserDashboard to prevent it from loading on admin routes
const UserDashboard = lazy(() => import('./components/user/UserDashboard').then(module => ({ default: module.UserDashboard })));

function AppContent() {
  // CRITICAL: Check route FIRST - synchronously, before any hooks
  // Get path synchronously - this happens on every render
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isAdminRoute = currentPath.includes('/admin');
  const isBusinessRoute = currentPath.includes('/business');
  
  // Must call hooks unconditionally (React rules)
  const { user, isAdmin, isBusinessUser, userRole, loading } = useAuth();
  const [isResetPasswordRoute, setIsResetPasswordRoute] = useState(false);
  
  // CRITICAL: Check route IMMEDIATELY after hooks and return before any other logic
  // This prevents UserDashboard from ever being considered when on admin/business routes
  if (isAdminRoute) {
    // Show loading while checking authentication or admin status
    if (loading) {
      return (
        <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-dl-grey-medium border-t-dl-red"></div>
            <p className="mt-4 text-dl-grey font-medium">Loading...</p>
          </div>
        </div>
      );
    }
    
    // If user is logged in, check if they're admin
    if (user) {
      // Show loading while admin status is being determined
      // This prevents terms modal from flashing during admin login
      if (!isAdmin && !isBusinessUser && !userRole) {
        // Still determining role - show loading to prevent UserDashboard from rendering
        return (
          <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-dl-grey-medium border-t-dl-red"></div>
              <p className="mt-4 text-dl-grey font-medium">Loading...</p>
            </div>
          </div>
        );
      }
      
      // If confirmed as admin, show dashboard
      if (isAdmin) {
        return (
          <>
            <SessionWarning />
            <AdminDashboard />
          </>
        );
      }
      
      // If user is logged in but not admin, redirect to login
      return <AdminLogin />;
    }
    
    // No user - show login page
    return <AdminLogin />;
  }
  
  if (isBusinessRoute) {
    // Show loading while checking authentication or business user status
    if (loading) {
      return (
        <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-dl-grey-medium border-t-dl-red"></div>
            <p className="mt-4 text-dl-grey font-medium">Loading...</p>
          </div>
        </div>
      );
    }
    
    // If user is logged in, check if they're a business user
    if (user) {
      // Show loading while business user status is being determined
      if (!isBusinessUser && !isAdmin && !userRole) {
        // Still determining role - show loading to prevent unauthorized access
        return (
          <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-dl-grey-medium border-t-dl-red"></div>
              <p className="mt-4 text-dl-grey font-medium">Loading...</p>
            </div>
          </div>
        );
      }
      
      // If confirmed as business user, show dashboard
      if (isBusinessUser || userRole === 'business_user') {
        return (
          <>
            <SessionWarning />
            <BusinessUserDashboard />
          </>
        );
      }
      
      // If user is logged in but not a business user, redirect to login
      return <BusinessUserLogin />;
    }
    
    // No user - show login page
    return <BusinessUserLogin />;
  }

  // Check for reset password route on mount and when URL changes
  useEffect(() => {
    const checkResetPasswordRoute = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);
      const hasRecoveryToken = hashParams.get('type') === 'recovery' || 
                               hashParams.has('access_token') ||
                               queryParams.get('type') === 'recovery' ||
                               window.location.hash.includes('type=recovery') ||
                               window.location.search.includes('type=recovery');
      const isResetRoute = window.location.pathname === '/reset-password' || 
                           window.location.pathname.includes('/reset-password') ||
                           hasRecoveryToken;
      
      setIsResetPasswordRoute(isResetRoute);

      // Normalize URL if needed
      if (isResetRoute && window.location.pathname !== '/reset-password') {
        const hash = window.location.hash || '';
        window.history.replaceState({}, '', '/reset-password' + hash);
      }
    };

    // Check immediately
    checkResetPasswordRoute();
    
    // Listen for hash changes (Supabase adds hash after redirect)
    const handleHashChange = () => {
      checkResetPasswordRoute();
    };
    
    window.addEventListener('hashchange', handleHashChange);
    
    // Check periodically for a short time in case hash is added asynchronously
    // (Supabase might add hash after initial page load)
    let checkCount = 0;
    const maxChecks = 20; // Check for 2 seconds (20 * 100ms)
    const interval = setInterval(() => {
      checkResetPasswordRoute();
      checkCount++;
      if (checkCount >= maxChecks) {
        clearInterval(interval);
      }
    }, 100);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      clearInterval(interval);
    };
  }, []);

  // Always show reset password page if we detect recovery token or reset password route
  // This must happen BEFORE checking user authentication to prevent redirect to dashboard
  // Even if user is logged in, if they have a recovery token, show the reset form
  if (isResetPasswordRoute) {
    return <ResetPassword />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-dl-grey-medium border-t-dl-red"></div>
          <p className="mt-4 text-dl-grey font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // CRITICAL: User route protection - ensure only authenticated regular users can access
  // Admin and business routes are already handled above
  
  if (!user) {
    // No user logged in - show appropriate login page based on route
    if (currentPath === '/admin') {
      return <AdminLogin />;
    }
    if (currentPath === '/business') {
      return <BusinessUserLogin />;
    }
    // Default: show user login/registration page
    return <UserAuth />;
  }

  // Even if user is logged in, if we're on reset password route, show the reset form
  // (this handles the case where Supabase creates a session from the token)
  if (isResetPasswordRoute) {
    return <ResetPassword />;
  }

  // Check if user is on profile page
  const isProfileRoute = currentPath === '/profile' || currentPath === '/profile/';

  // CRITICAL: Show loading while determining user role to prevent unauthorized access
  if (user && !loading && !isAdmin && !isBusinessUser && !userRole) {
    // Still determining role - show loading
    return (
      <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-dl-grey-medium border-t-dl-red"></div>
          <p className="mt-4 text-dl-grey font-medium">Loading...</p>
        </div>
      </div>
    );
  }
  
  // CRITICAL: Redirect admin users to admin dashboard (they should not access user routes)
  if (isAdmin) {
    return (
      <>
        <SessionWarning />
        <AdminDashboard />
      </>
    );
  }

  // CRITICAL: Redirect business users to business dashboard (they should not access user routes)
  if (isBusinessUser || userRole === 'business_user') {
    return (
      <>
        <SessionWarning />
        <BusinessUserDashboard />
      </>
    );
  }

  // CRITICAL: Only regular users (not admin, not business) can access user routes
  // At this point, user is authenticated and confirmed as a regular user (bidder role)
  
  if (isProfileRoute) {
    // Regular customers can access profile page
    return (
      <>
        <SessionWarning />
        <UserProfile />
      </>
    );
  }

  // Default: show UserDashboard (bidding page) for authenticated regular users only
  // Use Suspense to handle lazy loading - this ensures UserDashboard code is only loaded when needed
  return (
    <>
      <SessionWarning />
      <Suspense fallback={
        <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-dl-grey-medium border-t-dl-red"></div>
            <p className="mt-4 text-dl-grey font-medium">Loading...</p>
          </div>
        </div>
      }>
        <UserDashboard />
      </Suspense>
    </>
  );
}

function App() {
  return (
    <NotificationProvider>
      <ConfirmProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ConfirmProvider>
    </NotificationProvider>
  );
}

export default App;

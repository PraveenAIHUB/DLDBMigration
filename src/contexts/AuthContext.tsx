import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../lib/api-client';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  isAdmin: boolean;
  isBusinessUser: boolean;
  isBidder: boolean;
  userRole: 'admin' | 'bidder' | 'business_user' | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  adminSignIn: (email: string, password: string) => Promise<void>;
  businessUserSignIn: (email: string, password: string) => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  resetBusinessUserPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateBusinessUserPassword: (email: string, newPassword: string, resetToken?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBusinessUser, setIsBusinessUser] = useState(false);
  const [isBidder, setIsBidder] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'bidder' | 'business_user' | null>(null);
  const [loading, setLoading] = useState(true);

  const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
  const BUSINESS_USER_SESSION_DURATION = 4 * 60 * 60 * 1000;
  const SESSION_WARNING_TIME = 5 * 60 * 1000;

  useEffect(() => {
    const token = apiClient.getToken();

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Date.now() / 1000;

      if (payload.exp && payload.exp < now) {
        apiClient.setToken(null);
        setLoading(false);
        return;
      }

      const role = payload.role;
      setUserRole(role);
      setIsAdmin(role === 'admin');
      setIsBusinessUser(role === 'business');
      setIsBidder(role === 'bidder');

      setUser({
        id: payload.userId,
        email: payload.email || '',
      });

      if (role === 'admin') {
        apiClient.admin.getMe().then(({ data }) => {
          setUser(prev => ({ ...prev!, name: data.name }));
        }).catch(console.error);
      } else if (role === 'business') {
        apiClient.business.getMe().then(({ data }) => {
          setUser(prev => ({ ...prev!, name: data.name }));
        }).catch(console.error);
      } else if (role === 'bidder') {
        apiClient.users.getMe().then(({ data }) => {
          setUserProfile(data);
          setUser(prev => ({ ...prev!, name: data.name }));
        }).catch(console.error);
      }
    } catch (error) {
      console.error('Error parsing token:', error);
      apiClient.setToken(null);
    }

    setLoading(false);
  }, []);

  const signUp = async (email: string, password: string, name: string, phone: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedEmail || !normalizedPassword || !normalizedName || !normalizedPhone) {
      throw new Error('Please fill in all required fields');
    }

    if (!normalizedEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    const { validatePassword } = await import('../utils/passwordValidation');
    const passwordValidation = validatePassword(normalizedPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.errors.join('. '));
    }

    await apiClient.auth.userSignUp({
      email: normalizedEmail,
      password: normalizedPassword,
      name: normalizedName,
      phone: normalizedPhone,
      termsAccepted: true,
    });
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      throw new Error('Please enter both email and password');
    }

    if (!normalizedEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    const result = await apiClient.auth.userLogin(normalizedEmail, normalizedPassword);

    if (!result.user.approved) {
      setUser(result.user);
      setIsBidder(true);
      setUserRole('bidder');
      return;
    }

    setUser(result.user);
    setUserProfile(result.user);
    setIsBidder(true);
    setUserRole('bidder');
  };

  const adminSignIn = async (email: string, password: string) => {
    const result = await apiClient.auth.adminLogin(email, password);

    setUser(result.user);
    setIsAdmin(true);
    setUserRole('admin');
  };

  const businessUserSignIn = async (email: string, password: string) => {
    const result = await apiClient.auth.businessLogin(email, password);

    setUser(result.user);
    setIsBusinessUser(true);
    setUserRole('business_user');
  };

  const signOut = async () => {
    sessionStorage.removeItem('business_user');
    sessionStorage.removeItem('userDashboard_lastLoad');
    sessionStorage.removeItem('userDashboard_userId');

    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setIsBusinessUser(false);
    setIsBidder(false);
    setUserRole(null);

    await apiClient.auth.signOut();

    const currentPath = window.location.pathname;
    if (currentPath !== '/' && !currentPath.includes('/admin') && !currentPath.includes('/business')) {
      window.location.href = '/';
    } else if (currentPath.includes('/admin')) {
      window.location.href = '/admin';
    } else if (currentPath.includes('/business')) {
      window.location.href = '/business';
    }
  };

  const resetPasswordForEmail = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    await apiClient.auth.resetPassword(normalizedEmail, '');
  };

  const resetBusinessUserPassword = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    throw new Error('Business user password reset not implemented yet. Please contact administrator.');
  };

  const updatePassword = async (newPassword: string) => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    if (!user?.email) {
      throw new Error('No user logged in');
    }

    await apiClient.auth.resetPassword(user.email, newPassword);
  };

  const updateBusinessUserPassword = async (email: string, newPassword: string, resetToken?: string) => {
    throw new Error('Business user password update not implemented yet. Please contact administrator.');
  };

  useEffect(() => {
    if (!user) return;

    let inactivityTimeout: NodeJS.Timeout;
    let sessionCheckInterval: NodeJS.Timeout;
    let warningTimeout: NodeJS.Timeout | null = null;

    const resetInactivityTimer = () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      if (warningTimeout) clearTimeout(warningTimeout);

      inactivityTimeout = setTimeout(() => {
        console.log('Session timeout due to inactivity');
        handleSessionTimeout();
      }, INACTIVITY_TIMEOUT);

      warningTimeout = setTimeout(() => {
        showSessionWarning();
      }, INACTIVITY_TIMEOUT - SESSION_WARNING_TIME);
    };

    const handleSessionTimeout = async () => {
      console.log('Auto-logging out due to inactivity');
      await signOut();

      if (typeof window !== 'undefined') {
        const event = new CustomEvent('session-timeout', {
          detail: { message: 'Your session has expired due to inactivity. Please log in again.' }
        });
        window.dispatchEvent(event);
      }
    };

    const showSessionWarning = () => {
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('session-warning', {
          detail: {
            message: 'Your session will expire in 5 minutes due to inactivity.',
            timeRemaining: 5
          }
        });
        window.dispatchEvent(event);
      }
    };

    const checkSessionValidity = async () => {
      const token = apiClient.getToken();
      if (!token) {
        await signOut();
        return;
      }

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Date.now() / 1000;

        if (payload.exp && payload.exp < now) {
          console.log('Token expired');
          await signOut();
        }
      } catch (error) {
        console.error('Error checking token:', error);
        await signOut();
      }
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'keypress'];
    const handleActivity = () => {
      resetInactivityTimer();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    resetInactivityTimer();

    sessionCheckInterval = setInterval(() => {
      checkSessionValidity();
    }, 5 * 60 * 1000);

    return () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      if (warningTimeout) clearTimeout(warningTimeout);
      if (sessionCheckInterval) clearInterval(sessionCheckInterval);
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [user, isBusinessUser]);

  const value = {
    user,
    userProfile,
    isAdmin,
    isBusinessUser,
    isBidder,
    userRole,
    loading,
    signUp,
    signIn,
    signOut,
    adminSignIn,
    businessUserSignIn,
    resetPasswordForEmail,
    resetBusinessUserPassword,
    updatePassword,
    updateBusinessUserPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

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

  // Session management constants
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity
  const BUSINESS_USER_SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 hours for business users
  const SESSION_WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before timeout

  useEffect(() => {
    // Security: Clear any authentication tokens from URL hash to prevent session sharing
    // This ensures sessions are isolated per browser context (incognito vs regular)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const type = hashParams.get('type');
        // Only clear if it's not a password reset flow
        if (type !== 'recovery') {
          // Clear hash from URL after Supabase processes it (with a delay)
          // This prevents tokens from being shared via URL copying
          setTimeout(() => {
            window.history.replaceState({}, '', window.location.pathname + window.location.search);
          }, 500);
        }
      }
    }

    // Check for business user in sessionStorage first
    const businessUserStr = sessionStorage.getItem('business_user');
    if (businessUserStr) {
      try {
        const businessUser = JSON.parse(businessUserStr);
        
        // Check if business user session has expired
        if (businessUser.expiresAt) {
          const expiresAt = new Date(businessUser.expiresAt);
          if (expiresAt < new Date()) {
            console.log('Business user session expired');
            sessionStorage.removeItem('business_user');
            setLoading(false);
            return;
          }
        } else {
          // Legacy session without expiration - add expiration timestamp
          const expiresAt = new Date(Date.now() + BUSINESS_USER_SESSION_DURATION);
          businessUser.expiresAt = expiresAt.toISOString();
          sessionStorage.setItem('business_user', JSON.stringify(businessUser));
        }
        
        setUser({
          id: businessUser.id,
          email: businessUser.email,
        } as any);
        setIsBusinessUser(true);
        setUserRole('business_user');
        setLoading(false);
        return;
      } catch (e) {
        // Invalid session, clear it
        console.error('Error parsing business user session:', e);
        sessionStorage.removeItem('business_user');
      }
    }

    // Get session - use the session directly without extra validation to avoid blocking
    // The session from getSession() is already validated by Supabase
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      // If there's an error or no session, ensure user is logged out
      if (error || !session) {
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
        setIsBusinessUser(false);
        setUserRole(null);
        setLoading(false);
        return;
      }

      // Session exists - use it directly
      // Supabase already validates the session, so we don't need to call getUser() again
      setUser(session.user);
      if (session.user) {
        // Load user profile and admin status asynchronously
        loadUserProfile(session.user.id).catch(err => {
          console.error('Error loading user profile:', err);
        });
        checkAdminStatus(session.user.email || '').catch(err => {
          console.error('Error checking admin status:', err);
        });
      }
      setLoading(false);
    }).catch((err) => {
      // Handle any errors in the promise chain
      console.error('Error getting session:', err);
      setUser(null);
      setUserProfile(null);
      setIsAdmin(false);
      setIsBusinessUser(false);
      setUserRole(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Handle auth state changes - use session directly without extra validation
      // Supabase already validates the session, so we don't need to call getUser() again
      if (session?.user) {
        setUser(session.user);
        // Load user profile and admin status asynchronously
        loadUserProfile(session.user.id).catch(err => {
          console.error('Error loading user profile:', err);
        });
        checkAdminStatus(session.user.email || '').catch(err => {
          console.error('Error checking admin status:', err);
        });
      } else {
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
        setIsBusinessUser(false);
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    // First check if user is an admin or business user - they shouldn't be in users table
    const { data: currentUser } = await supabase.auth.getUser();
    if (currentUser?.user?.email) {
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', currentUser.user.email)
        .maybeSingle();
      
      if (adminData) {
        // User is an admin, don't load from users table
        setUserProfile(null);
        setIsBidder(false);
        return;
      }

      const { data: businessData } = await supabase
        .from('business_users')
        .select('id')
        .eq('email', currentUser.user.email)
        .maybeSingle();
      
      if (businessData) {
        // User is a business user, don't load from users table
        setUserProfile(null);
        setIsBidder(false);
        return;
      }
    }

    // Only load from users table if not admin or business user
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    setUserProfile(data);
    if (data) {
      setIsBidder(data.role === 'bidder');
      setUserRole(data.role || 'bidder');
    }
  };

  const checkAdminStatus = async (email: string) => {
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    
    if (adminData) {
      setIsAdmin(true);
      setUserRole('admin');
      return;
    }

    // Check business users
    const { data: businessData } = await supabase
      .from('business_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    
    if (businessData) {
      setIsBusinessUser(true);
      setUserRole('business_user');
    }
  };

  const signUp = async (email: string, password: string, name: string, phone: string) => {
    // Validate input
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
    
    // Validate password with complex requirements
    const { validatePassword } = await import('../utils/passwordValidation');
    const passwordValidation = validatePassword(normalizedPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.errors.join('. '));
    }
    
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (error) {
      console.error('Sign up error:', error);
      // Provide user-friendly error messages
      if (error.message.includes('already registered') || error.message.includes('already_exists')) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      } else if (error.message.includes('Password')) {
        throw new Error('Password is too weak. Please use a stronger password.');
      }
      throw error;
    }
    
    if (!data.user) {
      throw new Error('Sign up failed. Please try again.');
    }

    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email: normalizedEmail,
        name: normalizedName,
        phone: normalizedPhone,
        role: 'bidder', // Required by RLS policy
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Check if it's a duplicate key error (user already exists)
      if (profileError.code === '23505' || profileError.message.includes('duplicate')) {
        // Profile might already exist - this is okay, user can sign in
        console.log('Profile already exists, user can sign in');
        return;
      }
      throw new Error('Account created but profile setup failed. Please contact support.');
    }
  };

  const signIn = async (email: string, password: string) => {
    // Validate input
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    
    if (!normalizedEmail || !normalizedPassword) {
      throw new Error('Please enter both email and password');
    }
    
    if (!normalizedEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }
    
    // Validate password with complex requirements (same as registration)
    const { validatePassword } = await import('../utils/passwordValidation');
    const passwordValidation = validatePassword(normalizedPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.errors.join('. '));
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (error) {
      console.error('Sign in error:', error);
      // Provide user-friendly error messages
      if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
        throw new Error('Invalid email or password. Please check your credentials and try again.');
      } else if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
        throw new Error('Please verify your email address before signing in. Check your inbox for a confirmation email.');
      } else if (error.message.includes('User not found')) {
        throw new Error('No account found with this email address. Please sign up first.');
      } else if (error.status === 400) {
        throw new Error('Invalid email or password format. Please check your input.');
      }
      throw error;
    }
    
    if (!data.user) {
      throw new Error('Sign in failed. Please try again.');
    }

    // IMPORTANT: Check if user is an admin or business user FIRST
    // Admin and business users should NOT be in the users table
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (adminData) {
      // User is an admin - skip users table check and email confirmation check
      return;
    }

    const { data: businessData } = await supabase
      .from('business_users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (businessData) {
      // User is a business user - skip users table check and email confirmation check
      return;
    }

    // Only check users table for regular bidders
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, approved, role, email_verified')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError && !profileError.message.includes('No rows')) {
      console.error('Error checking user profile:', profileError);
      await supabase.auth.signOut();
      throw new Error('Unable to verify your account status. Please contact support.');
    }

    if (!userProfile) {
      await supabase.auth.signOut();
      throw new Error('Your account profile is incomplete. Please complete your registration or contact support.');
    }

    // For bidders, check approval status but don't sign them out
    // Allow unapproved users to log in and see the approval pending message
    // They just won't be able to see cars or place bids until approved
    if (userProfile.role === 'bidder' && !userProfile.approved) {
      // Don't sign out - let them log in to see the approval pending message
      // The UserDashboard will handle showing the message and preventing car loading
      console.log('User is not approved yet - will show approval pending message');
    }

    // For approved users, skip email confirmation check
    // Admin approval is sufficient - email confirmation is not required if admin has approved
    // Only check email confirmation if user is not approved yet
    if (!userProfile.approved && !data.user.email_confirmed_at) {
      // Don't sign out - let them log in to see the email confirmation message
      // The UserDashboard will handle showing the appropriate message
      console.log('User email not confirmed and not approved - will show appropriate message');
    }
  };

  const adminSignIn = async (email: string, password: string) => {
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (!adminData) {
      throw new Error('Invalid admin credentials');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    setIsAdmin(true);
  };

  const businessUserSignIn = async (email: string, password: string) => {
    // Normalize email (trim and lowercase)
    const normalizedEmail = email.trim().toLowerCase();
    
    console.log('Attempting business user login for:', normalizedEmail);
    
    // Get business user from database - try exact match first
    let { data: businessData, error: fetchError } = await supabase
      .from('business_users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    // If not found with exact match, try case-insensitive search
    if (!businessData && !fetchError) {
      console.log('Exact match not found, trying case-insensitive search...');
      const { data: allBusinessUsers, error: allUsersError } = await supabase
        .from('business_users')
        .select('*');
      
      if (allUsersError) {
        console.error('Error fetching all business users:', allUsersError);
        // If RLS is blocking, this will show the error
        if (allUsersError.message.includes('policy') || allUsersError.message.includes('RLS')) {
          throw new Error('Database access denied. Please contact administrator to fix RLS policies for business_users table.');
        }
      }
      
      if (allBusinessUsers) {
        businessData = allBusinessUsers.find(
          user => user.email?.trim().toLowerCase() === normalizedEmail
        );
        if (businessData) {
          console.log('Found business user with case-insensitive match:', businessData.email);
        } else {
          console.log('No matching business user found. Available emails:', allBusinessUsers.map(u => u.email));
        }
      }
    }

    if (fetchError) {
      console.error('Business user fetch error:', fetchError);
      throw new Error('Error checking business user: ' + fetchError.message);
    }

    if (!businessData) {
      console.error('Business user not found for email:', normalizedEmail);
      // Get all business user emails for debugging (in development only)
      const { data: allUsers } = await supabase
        .from('business_users')
        .select('email, name');
      console.log('Available business user emails:', allUsers?.map(u => ({ email: u.email, name: u.name })));
      throw new Error(`No business user found with email: ${normalizedEmail}. Please verify the email address or contact your administrator to create your account.`);
    }

    // Check if password_hash exists
    if (!businessData.password_hash) {
      console.error('Business user has no password_hash:', businessData);
      throw new Error('Business user account is not properly configured. Please contact administrator.');
    }

    // Verify password (currently stored as plain text - NOT SECURE)
    // In production, this should use proper password hashing (bcrypt, etc.)
    // Trim both values to handle whitespace issues
    const storedPassword = String(businessData.password_hash).trim();
    const providedPassword = String(password).trim();
    
    if (storedPassword !== providedPassword) {
      console.error('Password mismatch for business user:', normalizedEmail);
      throw new Error('Invalid business user credentials');
    }

    // Create a session for the business user
    // Since business users don't have Supabase Auth accounts, we'll use a workaround
    // by creating a temporary session or using the business user's ID
    // For now, we'll just set the business user state without Supabase Auth
    
    // Store business user info in sessionStorage with expiration
    const expiresAt = new Date(Date.now() + BUSINESS_USER_SESSION_DURATION);
    sessionStorage.setItem('business_user', JSON.stringify({
      id: businessData.id,
      email: businessData.email,
      name: businessData.name,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    }));

    setIsBusinessUser(true);
    setUserRole('business_user');
    
    // Set a mock user object for compatibility
    setUser({
      id: businessData.id,
      email: businessData.email,
    } as any);
  };

  const signOut = async () => {
    // Clear business user session if exists
    sessionStorage.removeItem('business_user');
    // Clear user dashboard load time to ensure fresh load on next login
    sessionStorage.removeItem('userDashboard_lastLoad');
    sessionStorage.removeItem('userDashboard_userId');
    
    // Clear local state first
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setIsBusinessUser(false);
    setUserRole(null);
    
    // Try to sign out from Supabase, but don't throw if session is already missing
    try {
      const { error } = await supabase.auth.signOut();
      if (error && !error.message.includes('session missing') && !error.message.includes('AuthSessionMissingError')) {
        console.warn('Sign out error (non-critical):', error);
      }
    } catch (error: any) {
      if (!error?.message?.includes('session missing') && !error?.message?.includes('AuthSessionMissingError')) {
        console.warn('Sign out error (non-critical):', error);
      }
    }
    
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

    // Check if user exists in Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Try to find user by email (this might not work without admin access, but we'll try)
    // If the user doesn't exist in auth, the reset will fail anyway
    
    // Use the current origin to ensure it works in any environment (local, staging, production)
    const redirectUrl = `${window.location.origin}/reset-password`;
    
    console.log('Password reset redirect URL:', redirectUrl);
    
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error('Password reset error:', error);
      
      // Handle rate limiting (429 error)
      if (error.status === 429 || error.message.includes('rate limit') || error.message.includes('too many') || error.message.includes('For security purposes')) {
        // Extract wait time from error message if available
        const waitTimeMatch = error.message.match(/(\d+)\s+seconds?/i);
        const waitTime = waitTimeMatch ? waitTimeMatch[1] : '60';
        throw new Error(`Too many password reset requests. Please wait ${waitTime} seconds before trying again. This is a security measure to prevent abuse.`);
      }
      
      // Handle user not found
      if (error.message.includes('not found') || error.message.includes('does not exist') || error.message.includes('User not found')) {
        throw new Error('No account found with this email address. Please check your email and try again.');
      }
      
      // Handle invalid email
      if (error.message.includes('email') && (error.message.includes('invalid') || error.message.includes('Invalid'))) {
        throw new Error('Invalid email address. Please check and try again.');
      }
      
      // Generic error
      throw new Error('Failed to send password reset email. Please check your email address and try again.');
    }
  };

  const resetBusinessUserPassword = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    // Check if business user exists
    const { data: businessUser, error: fetchError } = await supabase
      .from('business_users')
      .select('id, email, name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (fetchError) {
      console.error('Business user fetch error:', fetchError);
      throw new Error('Error checking business user account. Please try again.');
    }

    if (!businessUser) {
      throw new Error('No business user account found with this email address.');
    }

    // For business users, we'll generate a simple reset token
    // In a production system, this would be sent via email
    // For now, we'll store it in sessionStorage and show it to the user
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token temporarily (in production, this would be in the database and sent via email)
    sessionStorage.setItem(`business_reset_${normalizedEmail}`, JSON.stringify({
      token: resetToken,
      expiresAt: expiresAt.toISOString(),
      email: normalizedEmail,
    }));

    // In a real implementation, you would send an email here with the reset link
    // For now, we'll return success and the user can use the reset token
    return;
  };

  const updatePassword = async (newPassword: string) => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('Password update error:', error);
      throw new Error('Failed to update password. Please try again.');
    }
  };

  const updateBusinessUserPassword = async (email: string, newPassword: string, resetToken?: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // If reset token is provided, verify it
    if (resetToken) {
      const storedReset = sessionStorage.getItem(`business_reset_${normalizedEmail}`);
      if (!storedReset) {
        throw new Error('Invalid or expired reset token. Please request a new password reset.');
      }

      const resetData = JSON.parse(storedReset);
      if (resetData.token !== resetToken) {
        throw new Error('Invalid reset token.');
      }

      const expiresAt = new Date(resetData.expiresAt);
      if (expiresAt < new Date()) {
        sessionStorage.removeItem(`business_reset_${normalizedEmail}`);
        throw new Error('Reset token has expired. Please request a new password reset.');
      }
    }

    // Get business user
    const { data: businessUser, error: fetchError } = await supabase
      .from('business_users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (fetchError) {
      console.error('Business user fetch error:', fetchError);
      throw new Error('Error finding business user account. Please try again.');
    }

    if (!businessUser) {
      throw new Error('No business user account found with this email address.');
    }

    // Update password (currently stored as plain text - in production, this should be hashed)
    const { error: updateError } = await supabase
      .from('business_users')
      .update({ 
        password_hash: newPassword.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessUser.id);

    if (updateError) {
      console.error('Password update error:', updateError);
      throw new Error('Failed to update password. Please try again.');
    }

    // Clear reset token
    if (resetToken) {
      sessionStorage.removeItem(`business_reset_${normalizedEmail}`);
    }
  };

  // Session timeout and inactivity monitoring
  useEffect(() => {
    if (!user) return;

    let inactivityTimeout: NodeJS.Timeout;
    let sessionCheckInterval: NodeJS.Timeout;
    let warningTimeout: NodeJS.Timeout | null = null;

    // Function to reset inactivity timer
    const resetInactivityTimer = () => {
      // Clear existing timeout
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      if (warningTimeout) clearTimeout(warningTimeout);

      // Set new inactivity timeout
      inactivityTimeout = setTimeout(() => {
        console.log('Session timeout due to inactivity');
        handleSessionTimeout();
      }, INACTIVITY_TIMEOUT);

      // Show warning 5 minutes before timeout
      warningTimeout = setTimeout(() => {
        showSessionWarning();
      }, INACTIVITY_TIMEOUT - SESSION_WARNING_TIME);
    };

    // Function to handle session timeout
    const handleSessionTimeout = async () => {
      console.log('Auto-logging out due to inactivity');
      await signOut();
      
      // Show notification if available
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('session-timeout', {
          detail: { message: 'Your session has expired due to inactivity. Please log in again.' }
        });
        window.dispatchEvent(event);
      }
    };

    // Function to show session warning
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

    // Function to check session validity
    const checkSessionValidity = async () => {
      if (isBusinessUser) {
        // Check business user session expiration
        const businessUserStr = sessionStorage.getItem('business_user');
        if (businessUserStr) {
          try {
            const businessUser = JSON.parse(businessUserStr);
            if (businessUser.expiresAt) {
              const expiresAt = new Date(businessUser.expiresAt);
              if (expiresAt < new Date()) {
                console.log('Business user session expired during check');
                await signOut();
                return;
              }
            }
          } catch (e) {
            console.error('Error checking business user session:', e);
            await signOut();
            return;
          }
        } else {
          // Business user session missing
          await signOut();
          return;
        }
      } else {
        // Check Supabase session validity
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          console.log('Supabase session invalid or expired');
          await signOut();
          return;
        }
      }
    };

    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'keypress'];
    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Add event listeners for user activity
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer setup
    resetInactivityTimer();

    // Periodic session validity check (every 5 minutes)
    sessionCheckInterval = setInterval(() => {
      checkSessionValidity();
    }, 5 * 60 * 1000);

    // Cleanup
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

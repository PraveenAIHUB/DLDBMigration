import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { Logo } from '../common/Logo';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const { updatePassword } = useAuth();

  // Prevent navigation away from this page if we have a recovery token
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasRecoveryToken = hashParams.get('type') === 'recovery' || hashParams.has('access_token');
    
    if (hasRecoveryToken && window.location.pathname !== '/reset-password') {
      // Force redirect to reset-password route if we have a recovery token
      const hash = window.location.hash || '';
      window.history.replaceState({}, '', '/reset-password' + hash);
    }
  }, []);

  useEffect(() => {
    // Check if there's a password reset token in the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    const errorParam = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');

    // If there's an error in the URL, show it
    if (errorParam) {
      setError(errorDescription || 'Invalid or expired reset link. Please request a new password reset.');
      setValidatingToken(false);
      setTokenValid(false);
      return;
    }

    // If no token, show error
    if (!accessToken || type !== 'recovery') {
      setError('Invalid or missing reset token. Please request a new password reset link.');
      setValidatingToken(false);
      setTokenValid(false);
      return;
    }

    // Verify the session is valid
    const verifySession = async () => {
      try {
        // Wait a bit for Supabase to process the hash
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get the current session - Supabase should have processed the hash automatically
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Invalid or expired reset link. Please request a new password reset.');
          setValidatingToken(false);
          setTokenValid(false);
          return;
        }

        if (!session) {
          // If no session yet, wait a bit more and try again
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
          
          if (retryError || !retrySession) {
            setError('Invalid or expired reset link. Please request a new password reset.');
            setValidatingToken(false);
            setTokenValid(false);
            return;
          }
          
          // Session is valid now
          setTokenValid(true);
          setValidatingToken(false);
          return;
        }

        // Session is valid, user can proceed
        setTokenValid(true);
        setValidatingToken(false);
      } catch (err: any) {
        console.error('Error verifying reset token:', err);
        setError('Failed to verify reset link. Please request a new password reset.');
        setValidatingToken(false);
        setTokenValid(false);
      }
    };

    verifySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Ensure we have a valid session before updating password
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Session expired. Please request a new password reset link.');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
          <div className="card-dl text-center">
            <div className="accent-bar mb-6"></div>
            <div className="flex justify-center mb-6">
              <Logo className="h-14" />
            </div>
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h1 className="text-h2 text-dl-grey mb-2">Password Reset Successful!</h1>
            <p className="text-dl-grey-light mb-6">
              Your password has been updated successfully. You will be redirected to the login page shortly.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="btn-primary w-full touch-target"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while validating token
  if (validatingToken) {
    return (
      <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
          <div className="card-dl text-center">
            <div className="accent-bar mb-6"></div>
            <div className="flex justify-center mb-6">
              <Logo className="h-14" />
            </div>
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-dl-grey-medium border-t-dl-red"></div>
            </div>
            <h1 className="text-h2 text-dl-grey mb-2">Verifying Reset Link</h1>
            <p className="text-dl-grey-light">Please wait while we verify your password reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error if token is invalid
  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
          <div className="card-dl text-center">
            <div className="accent-bar mb-6"></div>
            <div className="flex justify-center mb-6">
              <Logo className="h-14" />
            </div>
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-12 h-12 text-dl-red" />
            </div>
            <h1 className="text-h2 text-dl-grey mb-2">Invalid Reset Link</h1>
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-dl-red rounded-dl-sm text-red-700 text-sm">
              {error || 'This password reset link is invalid or has expired. Please request a new one.'}
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="btn-primary w-full touch-target"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="card-dl">
          <div className="accent-bar mb-6"></div>
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Logo className="h-14" />
            </div>
            <div className="flex justify-center mb-4">
              <Lock className="w-12 h-12 text-dl-red" />
            </div>
            <h1 className="text-h2 text-dl-grey mb-2">Reset Your Password</h1>
            <p className="text-dl-grey-light">Enter your new password below</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-dl-red rounded-dl-sm text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dl-grey mb-2">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="input-dl w-full"
                placeholder="Enter new password (min. 6 characters)"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-dl-grey mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="input-dl w-full"
                placeholder="Confirm new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-target"
            >
              {loading ? (
                'Updating Password...'
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Update Password
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => window.location.href = '/'}
              className="text-sm text-dl-grey-light hover:text-dl-grey font-medium min-h-[44px] touch-target"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


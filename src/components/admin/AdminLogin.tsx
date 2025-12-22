import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { LogIn, Mail, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../common/Logo';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { adminSignIn, resetPasswordForEmail } = useAuth();
  const { showError, showWarning } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await adminSignIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetLoading(true);
    setResetSuccess(false);

    try {
      await resetPasswordForEmail(resetEmail);
      setResetSuccess(true);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send password reset email';
      setError(errorMessage);
      
      // Show as notification for better visibility
      // Check if it's a rate limit error (429 status or wait time message)
      if (err.status === 429 || errorMessage.includes('wait') || errorMessage.includes('seconds') || errorMessage.includes('rate limit') || errorMessage.includes('For security purposes')) {
        showWarning('Rate Limit Exceeded', errorMessage);
      } else {
        showError('Password Reset Failed', errorMessage);
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center px-4 section-padding">
      <div className="max-w-md w-full">
        <div className="card-dl">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Logo className="h-14" />
            </div>
            <h1 className="text-h2 text-dl-grey mb-2">Admin Portal</h1>
            <p className="text-body text-dl-grey-light">Sign in to manage the platform</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-dl text-dl-red text-small">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-small font-medium text-dl-grey mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-dl w-full"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-small font-medium text-dl-grey mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-dl w-full pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dl-grey-light hover:text-dl-grey focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed touch-target"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {!showForgotPassword ? (
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setShowForgotPassword(true);
                  setError('');
                  setResetSuccess(false);
                }}
                className="text-small text-dl-red hover:text-dl-red-hover font-medium min-h-[44px] touch-target"
              >
                Forgot password?
              </button>
            </div>
          ) : (
            <div className="mt-6 pt-6 border-t border-dl-grey-medium">
              <h3 className="text-h3 text-dl-grey mb-4">Reset Password</h3>
              {resetSuccess ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-dl text-green-700 text-small">
                  <p className="font-medium mb-2">Password reset email sent!</p>
                  <p>Please check your email for instructions to reset your password.</p>
                  <button
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail('');
                      setResetSuccess(false);
                    }}
                    className="mt-3 text-green-700 hover:text-green-800 font-medium text-small underline"
                  >
                    Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="block text-small font-medium text-dl-grey mb-2">
                      Email Address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      className="input-dl w-full"
                      placeholder="admin@example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="btn-primary w-full min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-target"
                  >
                    {resetLoading ? (
                      'Sending...'
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        Send Reset Link
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail('');
                      setResetSuccess(false);
                      setError('');
                    }}
                    className="w-full min-h-[44px] text-dl-grey-light hover:text-dl-grey font-medium text-small touch-target"
                  >
                    Back to login
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

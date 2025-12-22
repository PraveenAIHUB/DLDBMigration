import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Building, LogIn, Mail, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../common/Logo';

export function BusinessUserLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { businessUserSignIn, resetBusinessUserPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        setError('Please enter both email and password');
        setLoading(false);
        return;
      }
      await businessUserSignIn(email, password);
    } catch (err: any) {
      console.error('Business user login error:', err);
      // Provide more helpful error messages
      let errorMessage = err.message || 'Login failed';
      if (errorMessage.includes('Invalid business user credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (errorMessage.includes('not properly configured')) {
        errorMessage = 'Your account is not properly configured. Please contact your administrator.';
      }
      setError(errorMessage);
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
      await resetBusinessUserPassword(resetEmail);
      setResetSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to process password reset request');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dl-grey-bg flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="card-dl">
          <div className="accent-bar mb-6"></div>
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Logo className="h-12 sm:h-14" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Building className="w-6 h-6 text-dl-yellow" />
              <h1 className="text-xl sm:text-2xl font-bold text-dl-grey">Business User Login</h1>
            </div>
            <p className="text-dl-grey-light text-sm sm:text-base">Used Car Team Portal</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-dl-red rounded-dl-sm text-red-700 text-sm">
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dl-grey mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-dl w-full"
                placeholder="business@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dl-grey mb-2">
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
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-target"
            >
              {loading ? (
                'Logging in...'
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
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
                className="text-sm text-dl-red hover:text-dl-red-hover font-medium touch-target"
              >
                Forgot password?
              </button>
            </div>
          ) : (
            <div className="mt-6 pt-6 border-t border-dl-grey-medium">
              <h3 className="text-lg font-semibold text-dl-grey mb-4">Reset Password</h3>
              {resetSuccess ? (
                <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-dl-sm text-green-700 text-sm">
                  <p className="font-medium mb-2">Password reset request received!</p>
                  <p className="mb-2">Please contact your administrator to complete the password reset process.</p>
                  <p className="text-xs text-green-600 mt-2">
                    Note: In a production system, you would receive an email with reset instructions.
                  </p>
                  <button
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail('');
                      setResetSuccess(false);
                    }}
                    className="mt-3 text-green-700 hover:text-green-800 font-medium text-sm underline"
                  >
                    Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-medium text-dl-grey mb-2">
                      Email Address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      className="input-dl w-full"
                      placeholder="business@example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-target"
                  >
                    {resetLoading ? (
                      'Processing...'
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        Request Password Reset
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
                    className="w-full text-dl-grey-light hover:text-dl-grey font-medium text-sm touch-target"
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


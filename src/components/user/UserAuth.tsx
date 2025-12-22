import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { supabase } from '../../lib/supabase';
import { LogIn, UserPlus, Mail, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../common/Logo';
import { EnhancedRegistration } from './EnhancedRegistration';
import { formatPhoneNumber, validatePhoneNumber, normalizePhoneNumber } from '../../utils/phoneFormatter';

export function UserAuth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, businessUserSignIn, resetPasswordForEmail } = useAuth();
  const { showSuccess, showError, showWarning } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate inputs
      if (!email.trim() || !password.trim()) {
        setError('Please enter both email and password');
        setLoading(false);
        return;
      }
      
      if (isSignUp) {
        if (!name.trim() || !phone.trim()) {
          setError('Please fill in all required fields');
          setLoading(false);
          return;
        }
        
        // Validate phone number
        const phoneValidation = validatePhoneNumber(phone);
        if (!phoneValidation.valid) {
          setError(phoneValidation.message || 'Invalid phone number format');
          setLoading(false);
          return;
        }
        
        // Normalize phone number before sending
        const normalizedPhone = normalizePhoneNumber(phone);
        await signUp(email, password, name, normalizedPhone);
      } else {
        // Check if this is a business user email - if so, use business user login
        const normalizedEmail = email.trim().toLowerCase();
        const { data: businessUser } = await supabase
          .from('business_users')
          .select('id, email')
          .eq('email', normalizedEmail)
          .maybeSingle();
        
        if (businessUser) {
          // Use business user sign in instead
          await businessUserSignIn(email, password);
          return;
        }
        
        // Regular user sign in
        await signIn(email, password);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      // Show user-friendly error message
      let errorMessage = err.message || 'Authentication failed';
      
      // Provide more helpful messages for common errors
      if (errorMessage.includes('Invalid email or password')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (errorMessage.includes('verify your email')) {
        errorMessage = 'Please verify your email address. Check your inbox for a confirmation email.';
      } else if (errorMessage.includes('No account found')) {
        errorMessage = 'No account found with this email. Please sign up first or check your email address.';
      } else if (errorMessage.includes('business user')) {
        // Keep the business user message as is
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4 py-8 sm:py-12">
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-dl-red/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-dl-red/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/50 overflow-hidden backdrop-blur-sm">
          {/* Top Accent Bar */}
          <div className="h-1.5 bg-gradient-to-r from-dl-red via-red-600 to-dl-red"></div>
          
          <div className="p-8 sm:p-10">
            {/* Logo and Header */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-gradient-to-br from-dl-red/10 via-red-500/10 to-dl-red/10 rounded-2xl shadow-lg">
                  <Logo className="h-14 sm:h-16" />
                </div>
              </div>
              <div className="mb-4">
                 <div className="relative inline-block mb-3">
                   <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold mb-2 tracking-tight leading-tight">
                     <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent uppercase">
                       USED VEHICLES
                     </span>
                     <br />
                     <span className="bg-gradient-to-r from-dl-red via-red-600 to-dl-red bg-clip-text text-transparent uppercase">
                       BIDDING PLATFORM
                     </span>
                   </h1>
                   {/* Decorative underline */}
                   <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-dl-red to-transparent rounded-full"></div>
                 </div>
               </div>
              <p className="text-sm sm:text-base text-slate-600 font-medium max-w-sm mx-auto leading-relaxed mt-4">
                {isSignUp 
                  ? 'Join our platform to bid on quality used vehicles at competitive prices' 
                  : 'Access your account to view active auctions and place your bids'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-dl-red rounded-lg text-red-800 text-sm shadow-sm animate-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">{error}</p>
                    {error.includes('business user') && (
                      <a
                        href="/business"
                        className="text-dl-red hover:text-dl-red-hover underline font-medium inline-flex items-center gap-1 text-sm mt-2 transition-colors"
                      >
                        Go to Business User Login →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="name" className="block text-sm font-semibold text-slate-700">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <UserPlus className="w-5 h-5 text-slate-400" />
                      </div>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-dl-red/20 focus:border-dl-red transition-all duration-200 font-medium"
                        placeholder="Enter your full name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="phone" className="block text-sm font-semibold text-slate-700">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          const formatted = formatPhoneNumber(e.target.value);
                          setPhone(formatted);
                        }}
                        required
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-dl-red/20 focus:border-dl-red transition-all duration-200 font-medium"
                        placeholder="+971 XX XXX XXXX"
                      />
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Include country code (e.g., +971 for UAE)</p>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-dl-red/20 focus:border-dl-red transition-all duration-200 font-medium"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-dl-red/20 focus:border-dl-red transition-all duration-200 font-medium"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1.5 rounded-lg hover:bg-slate-100"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 py-4 bg-gradient-to-r from-dl-red to-red-600 hover:from-dl-red-hover hover:to-red-700 text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 min-h-[52px]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing...</span>
                  </>
                ) : isSignUp ? (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Create Account</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer Actions */}
            <div className="mt-8 space-y-4">
              {!isSignUp && !showForgotPassword && (
                <div className="text-center">
                  <button
                    onClick={() => {
                      setShowForgotPassword(true);
                      setError('');
                      setResetSuccess(false);
                    }}
                    className="text-sm text-dl-red hover:text-dl-red-hover font-semibold transition-colors min-h-[44px] touch-target"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              
              {showForgotPassword ? (
                <div className="pt-6 border-t border-slate-200">
                  <h3 className="text-xl font-bold text-slate-900 mb-6">Reset Password</h3>
                  {resetSuccess ? (
                    <div className="p-5 bg-green-50 border-2 border-green-200 rounded-xl text-green-800 shadow-sm">
                      <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-bold mb-2">Password reset email sent!</p>
                          <p className="text-sm">Please check your email for instructions to reset your password.</p>
                          <button
                            onClick={() => {
                              setShowForgotPassword(false);
                              setResetEmail('');
                              setResetSuccess(false);
                            }}
                            className="mt-4 text-green-700 hover:text-green-800 font-semibold text-sm underline transition-colors min-h-[44px] touch-target"
                          >
                            Back to login
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-5">
                      <div className="space-y-2">
                        <label htmlFor="reset-email" className="block text-sm font-semibold text-slate-700">
                          Email Address
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Mail className="w-5 h-5 text-slate-400" />
                          </div>
                          <input
                            id="reset-email"
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            required
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-dl-red/20 focus:border-dl-red transition-all duration-200 font-medium"
                            placeholder="you@example.com"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="w-full py-4 bg-gradient-to-r from-dl-red to-red-600 hover:from-dl-red-hover hover:to-red-700 text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 min-h-[52px]"
                      >
                        {resetLoading ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-5 h-5" />
                            <span>Send Reset Link</span>
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
                        className="w-full py-3 text-slate-600 hover:text-slate-900 font-semibold text-sm transition-colors min-h-[44px] touch-target"
                      >
                        Back to login
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="text-center pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      if (!isSignUp) {
                        setShowRegistration(true);
                      } else {
                        setIsSignUp(false);
                      }
                      setError('');
                    }}
                    className="text-dl-red hover:text-dl-red-hover font-semibold text-sm transition-colors min-h-[44px] touch-target"
                  >
                    {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showRegistration && (
        <EnhancedRegistration
          onClose={() => setShowRegistration(false)}
          onSuccess={() => {
            setShowRegistration(false);
            setIsSignUp(false);
            showSuccess('Registration Successful', 'Your registration was successful! Please wait for admin approval.');
          }}
        />
      )}
    </div>
  );
}

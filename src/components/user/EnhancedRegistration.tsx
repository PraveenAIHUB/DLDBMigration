import { useState, useEffect } from 'react';
import { X, Mail, Phone, User, Building, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../contexts/NotificationContext';
import { formatPhoneNumber, validatePhoneNumber, normalizePhoneNumber } from '../../utils/phoneFormatter';
import { validatePassword } from '../../utils/passwordValidation';

const DEFAULT_TERMS = `1. Eligibility
- You confirm that you are at least 18 years old and legally allowed to enter into binding contracts.
- If you register on behalf of a company or organization, you confirm that you are authorized to act for that entity.

2. Account Registration & Security
- You agree to provide accurate and complete information during registration and keep it updated at all times.
- You are responsible for keeping your login credentials confidential and for all activities carried out through your account.
- We may suspend or terminate accounts that provide false information or misuse the platform.

3. Approval & Verification
- Your account will remain pending approval until it is reviewed and approved by the Administrator.
- We may request additional documents or verification at any time before or after approval.
- We reserve the right to approve or reject any registration at our sole discretion.

4. Bidding Rules
- You may place bids only during the active bidding period shown for each lot or vehicle.
- All bids are binding. By placing a bid, you agree to purchase the vehicle if your bid is accepted as the winning bid.
- Bids cannot be withdrawn or reduced after submission.
- The system time (Dubai time) is the only reference for the start and end of bidding.

5. Winning Bids & Payment
- The highest valid bid at the time of lot closing will generally be considered the winning bid, subject to final approval by the Seller / Business User.
- If the winning bidder cannot be contacted or fails to complete payment within the specified time, the Seller may offer the vehicle to the next highest bidder or cancel the sale.
- Payment terms, taxes, fees and required documents will be communicated separately and must be followed strictly.

6. Vehicle Condition & Inspection
- Vehicles are sold on an \"as-is, where-is\" basis unless otherwise stated.
- It is your responsibility to review all available information and, where possible, inspect the vehicle before bidding.
- We do not guarantee the accuracy or completeness of vehicle descriptions, mileage or condition reports.

7. Limits of Liability
- We are not liable for any indirect, incidental or consequential losses arising from the use of the platform, your bidding decisions or the condition of any vehicle.
- We are not responsible for network issues, device problems or other technical failures that may affect your ability to place bids.

8. Use of the Platform
- You agree not to misuse the platform, attempt to manipulate bidding, interfere with other users or use automated tools without our consent.
- Creating multiple accounts to gain unfair advantage is strictly prohibited and may result in suspension or termination.

9. Privacy & Data Protection
- Your personal data will be used to manage your registration, bidding activity and related communications.
- We may share your contact details with the Seller / Business User for transaction and delivery purposes.
- Your data will be handled in accordance with our privacy practices and applicable data protection laws.

10. Changes to Terms
- We may update these Terms and Conditions from time to time.
- Continued use of the platform after changes are published will constitute your acceptance of the updated terms.

11. Governing Law
- These Terms and Conditions are governed by the laws of the United Arab Emirates (UAE).
- Any disputes arising out of or in connection with the use of this platform shall be subject to the exclusive jurisdiction of the courts of Dubai, UAE.`;

interface EnhancedRegistrationProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function EnhancedRegistration({ onClose, onSuccess }: EnhancedRegistrationProps) {
  const { showSuccess, showInfo } = useNotification();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    userType: 'individual', // 'individual' or 'organization'
    name: '',
    email: '',
    phone: '',
    secondaryContact: '',
    password: '',
    confirmPassword: '',
  });
  const [otpMethod, setOtpMethod] = useState<'email' | 'mobile'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Load terms and conditions
  useEffect(() => {
    loadTerms();
  }, []);

  const loadTerms = async () => {
    try {
      // Use .maybeSingle() instead of .single() to handle cases where no rows exist
      const { data, error } = await supabase
        .from('terms_and_conditions')
        .select('content')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        // Log error for debugging but don't show to user
        console.warn('Could not load terms from database, using default terms:', error.message);
        setTermsContent(DEFAULT_TERMS);
        return;
      }

      if (!data || !data.content) {
        // Table exists but no content, use default
        setTermsContent(DEFAULT_TERMS);
        return;
      }

      setTermsContent(data.content);
    } catch (error) {
      // On any error (e.g. table missing, RLS policy issue), use default terms
      console.warn('Error loading terms, using default terms:', error);
      setTermsContent(DEFAULT_TERMS);
    }
  };

  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const sendOTP = async () => {
    setLoading(true);
    setError('');

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

    try {
      // Store OTP in otp_storage table (works before user exists)
      const otpData = {
        otp_code: otp,
        otp_method: otpMethod,
        expires_at: expiresAt.toISOString(),
        verified: false,
        ...(otpMethod === 'email' 
          ? { email: formData.email, phone: null }
          : { phone: normalizePhoneNumber(formData.phone), email: null }
        ),
      };

      const { error: otpError } = await supabase
        .from('otp_storage')
        .insert(otpData);

      if (otpError) {
        throw otpError;
      }

      // TODO: In production, send actual email/SMS here
      // For now, show OTP in notification for testing
      if (otpMethod === 'email') {
        showInfo(
          'OTP Sent',
          `OTP sent to ${formData.email}\n\nOTP Code: ${otp}\n(This is for testing - configure email service in production)`,
          10000
        );
      } else {
        showInfo(
          'OTP Sent',
          `OTP sent to ${formData.phone}\n\nOTP Code: ${otp}\n(This is for testing - configure SMS service in production)`,
          10000
        );
      }

      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    setLoading(true);
    setError('');

    try {
      // Find the OTP in otp_storage table
      const query = supabase
        .from('otp_storage')
        .select('*')
        .eq('otp_code', otpCode)
        .eq('otp_method', otpMethod)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (otpMethod === 'email') {
        query.eq('email', formData.email);
      } else {
        query.eq('phone', normalizePhoneNumber(formData.phone));
      }

      const { data: otpData, error: verifyError } = await query.single();

      if (verifyError || !otpData) {
        setError('Invalid or expired OTP code. Please check and try again.');
        return;
      }

      // Mark OTP as verified
      const { error: updateError } = await supabase
        .from('otp_storage')
        .update({ verified: true })
        .eq('id', otpData.id);

      if (updateError) {
        throw updateError;
      }

      setVerified(true);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!termsAccepted) {
      setError('You must accept the Terms and Conditions');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Normalize phone number before saving
      const normalizedPhone = normalizePhoneNumber(formData.phone);
      
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            phone: normalizedPhone,
          },
        },
      });

      if (authError) throw authError;

      // Create user profile
      const { error: profileError } = await supabase.from('users').insert({
        id: authData.user?.id,
        name: formData.name,
        email: formData.email,
        phone: normalizedPhone,
        role: 'bidder',
        user_type: formData.userType,
        secondary_contact: formData.secondaryContact || null,
        email_verified: otpMethod === 'email' && verified,
        mobile_verified: otpMethod === 'mobile' && verified,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        approved: false, // Requires admin approval
      });

      if (profileError) throw profileError;

      // Store terms acceptance in localStorage for bidding page check
      if (authData.user?.id) {
        const termsAcceptedKey = `terms_accepted_${authData.user.id}`;
        localStorage.setItem(termsAcceptedKey, 'true');
      }

      showSuccess('Registration Successful', 'Your account is pending admin approval.');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col my-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Register as Bidder</h2>
            <p className="text-sm text-gray-600 mt-1">Create your account to start bidding</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-4">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormData({ ...formData, userType: 'individual' })}
                    className={`p-4 border-2 rounded-xl transition-all ${
                      formData.userType === 'individual'
                        ? 'border-red-600 bg-red-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <User className={`w-8 h-8 mx-auto mb-2 ${formData.userType === 'individual' ? 'text-red-600' : 'text-gray-600'}`} />
                    <p className={`text-sm font-medium ${formData.userType === 'individual' ? 'text-red-900' : 'text-gray-700'}`}>Individual</p>
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, userType: 'organization' })}
                    className={`p-4 border-2 rounded-xl transition-all ${
                      formData.userType === 'organization'
                        ? 'border-red-600 bg-red-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <Building className={`w-8 h-8 mx-auto mb-2 ${formData.userType === 'organization' ? 'text-red-600' : 'text-gray-600'}`} />
                    <p className={`text-sm font-medium ${formData.userType === 'organization' ? 'text-red-900' : 'text-gray-700'}`}>Organization</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.userType === 'individual' ? 'Full Name *' : 'Organization Name *'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mobile *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    setFormData({ ...formData, phone: formatted });
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  required
                  placeholder="+971 XX XXX XXXX or +1 (XXX) XXX-XXXX"
                />
                <p className="mt-1 text-xs text-gray-500">Enter with country code (e.g., +971 for UAE, +1 for US)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Contact (Optional)</label>
                <input
                  type="text"
                  value={formData.secondaryContact}
                  onChange={(e) => setFormData({ ...formData, secondaryContact: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  placeholder="Email or phone"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    placeholder="Min 8 chars: Upper, Lower, Number, Symbol"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Must include: uppercase, lowercase, number, and symbol
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  const name = formData.name.trim();
                  const email = formData.email.trim().toLowerCase();
                  const phone = formData.phone.trim();
                  const pwd = formData.password.trim();
                  const confirmPwd = formData.confirmPassword.trim();

                  if (!name) {
                    setError('Name is required');
                    return;
                  }
                  if (!email || !email.includes('@')) {
                    setError('Valid email is required');
                    return;
                  }
                  if (!phone) {
                    setError('Mobile number is required');
                    return;
                  }
                  
                  // Validate phone number format
                  const phoneValidation = validatePhoneNumber(phone);
                  if (!phoneValidation.valid) {
                    setError(phoneValidation.message || 'Invalid phone number format');
                    return;
                  }
                  // Validate password with complex requirements
                  const passwordValidation = validatePassword(pwd);
                  if (!passwordValidation.valid) {
                    setError(passwordValidation.errors.join('. '));
                    return;
                  }
                  if (pwd !== confirmPwd) {
                    setError('Passwords do not match');
                    return;
                  }

                  setError('');
                  setStep(2);
                }}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Verification
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verification Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setOtpMethod('email')}
                    className={`p-4 border-2 rounded-xl transition-all ${
                      otpMethod === 'email'
                        ? 'border-red-600 bg-red-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <Mail className={`w-8 h-8 mx-auto mb-2 ${otpMethod === 'email' ? 'text-red-600' : 'text-gray-600'}`} />
                    <p className={`text-sm font-medium ${otpMethod === 'email' ? 'text-red-900' : 'text-gray-700'}`}>Email</p>
                  </button>
                  <button
                    onClick={() => setOtpMethod('mobile')}
                    className={`p-4 border-2 rounded-xl transition-all ${
                      otpMethod === 'mobile'
                        ? 'border-red-600 bg-red-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <Phone className={`w-8 h-8 mx-auto mb-2 ${otpMethod === 'mobile' ? 'text-red-600' : 'text-gray-600'}`} />
                    <p className={`text-sm font-medium ${otpMethod === 'mobile' ? 'text-red-900' : 'text-gray-700'}`}>Mobile</p>
                  </button>
                </div>
              </div>

              {!otpSent ? (
                <button
                  onClick={sendOTP}
                  disabled={loading}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Enter OTP</label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent text-center text-2xl tracking-widest font-mono"
                      maxLength={6}
                      placeholder="000000"
                    />
                  </div>
                  <button
                    onClick={verifyOTP}
                    disabled={loading || otpCode.length !== 6}
                    className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                  <button
                    onClick={sendOTP}
                    className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Resend OTP
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-48 overflow-y-auto">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">Terms and Conditions</h3>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{termsContent || 'Loading terms...'}</p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-red-600 focus:ring-2 focus:ring-red-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">
                  I agree to the Terms and Conditions
                </span>
              </label>

              <button
                onClick={handleRegister}
                disabled={loading || !termsAccepted}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                {loading ? 'Registering...' : 'Complete Registration'}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


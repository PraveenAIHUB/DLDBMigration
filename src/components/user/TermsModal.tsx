import { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
- Vehicles are sold on an "as-is, where-is" basis unless otherwise stated.
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

interface TermsModalProps {
  userId: string;
  onAccept: () => void;
}

export function TermsModal({ userId, onAccept }: TermsModalProps) {
  const [termsContent, setTermsContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (!accepted) return;
    
    // Store acceptance in localStorage
    const termsAcceptedKey = `terms_accepted_${userId}`;
    localStorage.setItem(termsAcceptedKey, 'true');
    
    // Call the onAccept callback
    onAccept();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-dl-red to-red-700 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Terms and Conditions</h2>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-dl-grey-medium border-t-dl-red"></div>
              <p className="mt-4 text-dl-grey font-medium">Loading terms...</p>
            </div>
          ) : (
            <div className="prose max-w-none">
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {termsContent}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="accept-terms"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="w-5 h-5 text-dl-red border-slate-300 rounded focus:ring-2 focus:ring-dl-red focus:ring-offset-2 cursor-pointer"
            />
            <label
              htmlFor="accept-terms"
              className="text-sm font-semibold text-slate-700 cursor-pointer flex-1"
            >
              I have read and agree to the Terms and Conditions
            </label>
          </div>
          <button
            onClick={handleAccept}
            disabled={!accepted || loading}
            className="w-full px-6 py-3 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base shadow-md hover:shadow-lg"
          >
            Accept and Continue
          </button>
        </div>
      </div>
    </div>
  );
}


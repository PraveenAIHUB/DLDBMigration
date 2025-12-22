import { useState } from 'react';
import { X, Save, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPhoneNumber, validatePhoneNumber, normalizePhoneNumber } from '../../utils/phoneFormatter';

interface BusinessUserModalProps {
  user: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function BusinessUserModal({ user, onClose, onSuccess }: BusinessUserModalProps) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const phone = formData.phone.trim();
    const pwd = formData.password.trim();

    if (!name) {
      setError('Name is required');
      return;
    }
    if (!email || !email.includes('@')) {
      setError('Valid email is required');
      return;
    }
    
    // Validate phone number if provided
    if (phone) {
      const phoneValidation = validatePhoneNumber(phone);
      if (!phoneValidation.valid) {
        setError(phoneValidation.message || 'Invalid phone number format');
        return;
      }
    }
    
    if (!user && pwd.length < 6) {
      setError('Password must be at least 6 characters for new users');
      return;
    }

    setLoading(true);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError('You must be logged in as an admin');
        setLoading(false);
        return;
      }

      const { data: adminData } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', authUser.email)
        .single();

      if (!adminData) {
        setError('Admin user not found');
        setLoading(false);
        return;
      }

      if (user) {
        // Update existing user
        const updateData: any = {
          name,
          email,
          phone: phone ? normalizePhoneNumber(phone) : null,
        };

        if (pwd) {
          // Note: In production, hash password server-side
          // For now, store plain text (NOT SECURE - must be fixed)
          updateData.password_hash = pwd;
        }
        
        // Normalize email if changed
        if (email !== user.email) {
          updateData.email = email;
        }

        const { error: updateError } = await supabase
          .from('business_users')
          .update(updateData)
          .eq('id', user.id);

        if (updateError) throw updateError;
      } else {
        // Create new user
        // Create business user in database (password stored as plain text for now - must be hashed in production)
        // Normalize email to lowercase
        const normalizedEmail = email;
        const normalizedPassword = pwd;
        
        const { error: insertError } = await supabase
          .from('business_users')
          .insert({
            name: formData.name.trim(),
            email: normalizedEmail,
            phone: phone ? normalizePhoneNumber(phone) : null,
            password_hash: normalizedPassword, // Store password (in production, hash this)
            created_by: adminData.id,
          });

        if (insertError) {
          // Check if it's a duplicate email error
          if (insertError.code === '23505') {
            throw new Error('A business user with this email already exists');
          }
          throw insertError;
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save business user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900">
            {user ? 'Edit Business User' : 'Create Business User'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value);
                setFormData({ ...formData, phone: formatted });
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
              placeholder="+971 XX XXX XXXX or +1 (XXX) XXX-XXXX"
            />
            <p className="mt-1 text-xs text-gray-500">Enter with country code (e.g., +971 for UAE, +1 for US)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Password{user ? ' (leave blank to keep current)' : ' *'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
                required={!user}
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Saving...' : user ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


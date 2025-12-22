import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with secure session storage
// This ensures sessions are isolated per browser context and not shared
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use localStorage (default) but ensure it's isolated per origin
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // Auto-refresh tokens
    autoRefreshToken: true,
    // Persist sessions
    persistSession: true,
    // Detect session from URL (for password reset, etc.) but clear hash after processing
    detectSessionInUrl: true,
    // Flow type for OAuth
    flowType: 'pkce',
  },
});

// Security: Clear any authentication tokens from URL hash after processing
// This prevents tokens from being shared via URL copying
if (typeof window !== 'undefined') {
  // Check if there's an access_token in the hash (but not for password reset)
  const hash = window.location.hash;
  if (hash && hash.includes('access_token') && !hash.includes('type=recovery')) {
    // Supabase will process this, but we should clear it from URL after a short delay
    // to prevent URL sharing
    setTimeout(() => {
      // Only clear if it's not a password reset flow
      const hashParams = new URLSearchParams(hash.substring(1));
      const type = hashParams.get('type');
      if (type !== 'recovery') {
        // Clear the hash from URL to prevent token sharing
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      }
    }, 1000);
  }
}

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          name: string;
          created_at: string;
        };
      };
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone: string;
          created_at?: string;
        };
      };
      cars: {
        Row: {
          id: string;
          sr_number: string | null;
          fleet_no: string | null;
          reg_no: string | null;
          make_model: string;
          year: number | null;
          km: number | null;
          price: number | null;
          location: string | null;
          bidding_start_date: string | null;
          bidding_end_date: string | null;
          bidding_enabled: boolean;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sr_number?: string | null;
          fleet_no?: string | null;
          reg_no?: string | null;
          make_model: string;
          year?: number | null;
          km?: number | null;
          price?: number | null;
          location?: string | null;
          bidding_start_date?: string | null;
          bidding_end_date?: string | null;
          bidding_enabled?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      bids: {
        Row: {
          id: string;
          car_id: string;
          user_id: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          car_id: string;
          user_id: string;
          amount: number;
          created_at?: string;
        };
      };
    };
  };
};

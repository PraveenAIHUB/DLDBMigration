import { apiClient } from './api-client';

export { apiClient as supabase };

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

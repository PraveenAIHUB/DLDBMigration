-- Complete Database Schema for Car Bidding Platform
-- Migrated from Supabase to PostgreSQL with Prisma

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create business_users table
CREATE TABLE IF NOT EXISTS business_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create users table (bidders)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  role TEXT DEFAULT 'bidder',
  user_type TEXT DEFAULT 'individual',
  secondary_contact TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  mobile_verified BOOLEAN DEFAULT FALSE,
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES admin_users(id),
  approved_at TIMESTAMPTZ,
  terms_accepted BOOLEAN DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  password_hash TEXT
);

-- Create lots table
CREATE TABLE IF NOT EXISTS lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_number TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  uploaded_by UUID REFERENCES admin_users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES admin_users(id),
  approved_at TIMESTAMPTZ,
  bidding_start_date TIMESTAMPTZ,
  bidding_end_date TIMESTAMPTZ,
  early_closed BOOLEAN DEFAULT FALSE,
  early_closed_by UUID REFERENCES admin_users(id),
  early_closed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cars table
CREATE TABLE IF NOT EXISTS cars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sr_number TEXT,
  fleet_no TEXT,
  reg_no TEXT,
  make_model TEXT NOT NULL,
  year INTEGER,
  km INTEGER,
  price DECIMAL(12,2),
  location TEXT,
  chassis_no TEXT,
  engine_no TEXT,
  color TEXT,
  fuel_type TEXT,
  transmission TEXT,
  body_type TEXT,
  seats INTEGER,
  doors INTEGER,
  current_location TEXT,
  specs JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  documents TEXT[] DEFAULT ARRAY[]::TEXT[],
  lot_id UUID REFERENCES lots(id) ON DELETE SET NULL,
  bidding_start_date TIMESTAMPTZ,
  bidding_end_date TIMESTAMPTZ,
  bidding_enabled BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Disabled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bids table
CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  is_winner BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(car_id, user_id)
);

-- Create terms_and_conditions table
CREATE TABLE IF NOT EXISTS terms_and_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version TEXT NOT NULL,
  content TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_id UUID REFERENCES lots(id) ON DELETE CASCADE,
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  asked_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answered BOOLEAN DEFAULT FALSE,
  answer_text TEXT,
  answered_by UUID REFERENCES admin_users(id),
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create otp_storage table
CREATE TABLE IF NOT EXISTS otp_storage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT,
  phone TEXT,
  otp_code TEXT NOT NULL,
  otp_method TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bids_car_id ON bids(car_id);
CREATE INDEX IF NOT EXISTS idx_bids_user_id ON bids(user_id);
CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_is_winner ON bids(is_winner) WHERE is_winner = TRUE;

CREATE INDEX IF NOT EXISTS idx_cars_lot_id ON cars(lot_id);
CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_bidding_dates ON cars(bidding_start_date, bidding_end_date);
CREATE INDEX IF NOT EXISTS idx_cars_chassis_no ON cars(chassis_no);
CREATE INDEX IF NOT EXISTS idx_cars_reg_no ON cars(reg_no);

CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);

CREATE INDEX IF NOT EXISTS idx_questions_lot_id ON questions(lot_id);
CREATE INDEX IF NOT EXISTS idx_questions_car_id ON questions(car_id);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_approved ON users(approved);

CREATE INDEX IF NOT EXISTS idx_otp_storage_email ON otp_storage(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otp_storage_phone ON otp_storage(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otp_storage_code ON otp_storage(otp_code);
CREATE INDEX IF NOT EXISTS idx_otp_storage_expires ON otp_storage(expires_at);

-- Insert default admin user (password: admin123)
INSERT INTO admin_users (email, password_hash, name)
VALUES (
  'admin@carbidding.com',
  '$2a$10$rQ5xZJKm3oQ5xZJKm3oQ5u9Y3YH5YH5YH5YH5YH5YH5YH5YH5YH5Y',
  'System Admin'
)
ON CONFLICT (email) DO NOTHING;

-- Insert default terms and conditions
INSERT INTO terms_and_conditions (version, content, active, created_by)
SELECT
  '1.0',
  'By participating in this bidding platform, you agree to abide by all terms and conditions. All bids are final and binding. The platform reserves the right to reject any bid or close bidding early.',
  TRUE,
  (SELECT id FROM admin_users WHERE email = 'admin@carbidding.com')
WHERE NOT EXISTS (SELECT 1 FROM terms_and_conditions WHERE active = TRUE);

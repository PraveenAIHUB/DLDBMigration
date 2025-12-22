/*
  # Three Role System - Comprehensive Update
  
  This migration implements:
  1. Three roles: Administrator, Bidder (Customer), Business User (Used Car Team)
  2. Lot system with auto-generated Lot Numbers
  3. Lot approval workflow
  4. Enhanced bidder registration with OTP, approval, T&C
  5. Questions system
  6. Role-based bid visibility
  7. Early close functionality
*/

-- ============================================
-- 1. UPDATE USERS TABLE FOR THREE ROLES
-- ============================================

-- Add role and approval fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'bidder' CHECK (role IN ('bidder', 'business_user')),
ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'individual' CHECK (user_type IN ('individual', 'organization')),
ADD COLUMN IF NOT EXISTS secondary_contact text,
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mobile_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS otp_code text,
ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES admin_users(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- Create business_users table (manually created by Admin)
CREATE TABLE IF NOT EXISTS business_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  phone text,
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. LOT SYSTEM
-- ============================================

-- Create lots table
CREATE TABLE IF NOT EXISTS lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number text UNIQUE NOT NULL,
  name text,
  description text,
  uploaded_by uuid REFERENCES admin_users(id),
  uploaded_at timestamptz DEFAULT now(),
  approved boolean DEFAULT false,
  approved_by uuid REFERENCES admin_users(id),
  approved_at timestamptz,
  bidding_start_date timestamptz,
  bidding_end_date timestamptz,
  early_closed boolean DEFAULT false,
  early_closed_by uuid REFERENCES admin_users(id),
  early_closed_at timestamptz,
  status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Active', 'Closed', 'Early Closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add lot_id to cars table
ALTER TABLE cars 
ADD COLUMN IF NOT EXISTS lot_id uuid REFERENCES lots(id) ON DELETE SET NULL;

-- Function to auto-generate lot numbers (trigger function)
CREATE OR REPLACE FUNCTION generate_lot_number()
RETURNS trigger AS $$
DECLARE
  lot_count integer;
BEGIN
  -- Get count of lots created today
  SELECT COUNT(*) INTO lot_count
  FROM lots
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Format: LOT-YYYYMMDD-XXX (e.g., LOT-20250101-001)
  IF NEW.lot_number IS NULL OR NEW.lot_number = '' THEN
    NEW.lot_number := 'LOT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((lot_count + 1)::text, 3, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate lot numbers
DROP TRIGGER IF EXISTS trigger_generate_lot_number ON lots;
CREATE TRIGGER trigger_generate_lot_number
  BEFORE INSERT ON lots
  FOR EACH ROW
  WHEN (NEW.lot_number IS NULL OR NEW.lot_number = '')
  EXECUTE FUNCTION generate_lot_number();

-- ============================================
-- 3. TERMS & CONDITIONS
-- ============================================

CREATE TABLE IF NOT EXISTS terms_and_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  content text NOT NULL,
  active boolean DEFAULT true,
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 4. QUESTIONS SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid REFERENCES lots(id) ON DELETE CASCADE,
  car_id uuid REFERENCES cars(id) ON DELETE CASCADE,
  asked_by uuid REFERENCES users(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  answered boolean DEFAULT false,
  answer_text text,
  answered_by uuid REFERENCES admin_users(id),
  answered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 5. UPDATE BIDS TABLE FOR ROLE-BASED VISIBILITY
-- ============================================

-- Add index for lot-based queries
CREATE INDEX IF NOT EXISTS idx_cars_lot_id ON cars(lot_id);
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);
CREATE INDEX IF NOT EXISTS idx_questions_lot_id ON questions(lot_id);
CREATE INDEX IF NOT EXISTS idx_questions_car_id ON questions(car_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_approved ON users(approved);

-- ============================================
-- 6. FUNCTIONS
-- ============================================

-- Function to update lot status
CREATE OR REPLACE FUNCTION update_lot_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.early_closed = true THEN
    NEW.status := 'Early Closed';
  ELSIF NEW.approved = false THEN
    NEW.status := 'Pending';
  ELSIF NEW.bidding_start_date IS NULL OR NEW.bidding_end_date IS NULL THEN
    NEW.status := 'Pending';
  ELSIF now() < NEW.bidding_start_date THEN
    NEW.status := 'Approved';
  ELSIF now() >= NEW.bidding_start_date AND now() <= NEW.bidding_end_date THEN
    NEW.status := 'Active';
  ELSIF now() > NEW.bidding_end_date THEN
    NEW.status := 'Closed';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for lot status
DROP TRIGGER IF EXISTS trigger_update_lot_status ON lots;
CREATE TRIGGER trigger_update_lot_status
  BEFORE INSERT OR UPDATE ON lots
  FOR EACH ROW
  EXECUTE FUNCTION update_lot_status();

-- ============================================
-- 7. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_and_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Business Users policies
CREATE POLICY "Business users can read own data"
  ON business_users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Lots policies
CREATE POLICY "Admins can manage all lots"
  ON lots FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Business users can view approved/active lots"
  ON lots FOR SELECT
  TO authenticated
  USING (
    approved = true AND status IN ('Approved', 'Active', 'Closed', 'Early Closed')
  );

CREATE POLICY "Bidders can view approved/active lots"
  ON lots FOR SELECT
  TO authenticated
  USING (
    approved = true AND status IN ('Approved', 'Active', 'Closed', 'Early Closed')
  );

-- Terms & Conditions policies
CREATE POLICY "Anyone can view active terms"
  ON terms_and_conditions FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage terms"
  ON terms_and_conditions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Questions policies
CREATE POLICY "Bidders can create questions"
  ON questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'bidder' 
      AND approved = true
    )
  );

CREATE POLICY "Bidders can view own questions"
  ON questions FOR SELECT
  TO authenticated
  USING (asked_by = auth.uid());

CREATE POLICY "Admins can view and answer all questions"
  ON questions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Business users can view all questions"
  ON questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_users 
      WHERE id = auth.uid()
    )
  );

-- Update bids policies for role-based visibility
DROP POLICY IF EXISTS "Users can view own bids" ON bids;
DROP POLICY IF EXISTS "Admins can view all bids" ON bids;

-- Bidders can only view their own bids
CREATE POLICY "Bidders can view own bids"
  ON bids FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'bidder'
    )
  );

-- Business users can view all bids (with amounts)
CREATE POLICY "Business users can view all bids"
  ON bids FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_users 
      WHERE id = auth.uid()
    )
  );

-- Admins can view bids but only count (implemented in application layer)
CREATE POLICY "Admins can view bid counts"
  ON bids FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- ============================================
-- 8. UPDATE USER POLICIES
-- ============================================

-- Update users policies for approval workflow
DROP POLICY IF EXISTS "Anyone can create user profile" ON users;

CREATE POLICY "Anyone can create bidder profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (role = 'bidder');

CREATE POLICY "Admins can create business users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    ) AND role = 'business_user'
  );

CREATE POLICY "Admins can view and manage all users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- ============================================
-- 9. DEFAULT DATA
-- ============================================

-- Insert default terms and conditions
INSERT INTO terms_and_conditions (version, content, active, created_by)
SELECT 
  '1.0',
  'By participating in this bidding platform, you agree to abide by all terms and conditions. All bids are final and binding. The platform reserves the right to reject any bid or close bidding early.',
  true,
  (SELECT id FROM admin_users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM terms_and_conditions WHERE active = true)
ON CONFLICT DO NOTHING;


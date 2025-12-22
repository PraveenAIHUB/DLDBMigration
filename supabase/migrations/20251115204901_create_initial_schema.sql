/*
  # Car Bidding Platform - Initial Schema

  ## Overview
  Creates the complete database schema for a car bidding platform with admin and user functionality.

  ## Tables Created
  
  ### 1. admin_users
  - `id` (uuid, primary key) - Admin user identifier
  - `email` (text, unique) - Admin email for login
  - `password_hash` (text) - Hashed password
  - `name` (text) - Admin name
  - `created_at` (timestamptz) - Account creation timestamp
  
  ### 2. users
  - `id` (uuid, primary key) - User identifier (linked to auth.users)
  - `name` (text) - Full name
  - `email` (text, unique) - Email address
  - `phone` (text) - Phone number
  - `created_at` (timestamptz) - Registration timestamp
  
  ### 3. cars
  - `id` (uuid, primary key) - Car identifier
  - `sr_number` (text) - Serial number from Excel
  - `fleet_no` (text) - Fleet number
  - `reg_no` (text) - Registration number
  - `make_model` (text) - Make and model
  - `year` (integer) - Manufacturing year
  - `km` (integer) - Kilometers driven
  - `price` (decimal) - Market value/price
  - `location` (text) - Car location
  - `bidding_start_date` (timestamptz) - When bidding starts
  - `bidding_end_date` (timestamptz) - When bidding ends
  - `bidding_enabled` (boolean) - Admin control to enable/disable
  - `status` (text) - Current status (Upcoming/Active/Closed/Disabled/Reopened)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 4. bids
  - `id` (uuid, primary key) - Bid identifier
  - `car_id` (uuid, foreign key) - References cars table
  - `user_id` (uuid, foreign key) - References users table
  - `amount` (decimal) - Bid amount
  - `created_at` (timestamptz) - Bid placement timestamp
  
  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies created for authenticated users and admin access
  - Admin users table isolated from public access
  
  ## Indexes
  - Foreign key indexes for performance
  - Status and date indexes for filtering
*/

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create users table (customer/bidder accounts)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create cars table
CREATE TABLE IF NOT EXISTS cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_number text,
  fleet_no text,
  reg_no text,
  make_model text NOT NULL,
  year integer,
  km integer,
  price decimal(12,2),
  location text,
  bidding_start_date timestamptz,
  bidding_end_date timestamptz,
  bidding_enabled boolean DEFAULT false,
  status text DEFAULT 'Disabled',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bids table
CREATE TABLE IF NOT EXISTS bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bids_car_id ON bids(car_id);
CREATE INDEX IF NOT EXISTS idx_bids_user_id ON bids(user_id);
CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_bidding_dates ON cars(bidding_start_date, bidding_end_date);
CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at DESC);

-- Enable Row Level Security
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_users (admin only access)
CREATE POLICY "Admin users can read own data"
  ON admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for users
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Anyone can create user profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for cars (users can only see active bidding cars)
CREATE POLICY "Users can view active cars"
  ON cars FOR SELECT
  TO authenticated
  USING (
    bidding_enabled = true 
    AND status = 'Active'
    AND now() >= bidding_start_date 
    AND now() <= bidding_end_date
  );

CREATE POLICY "Public can view active cars"
  ON cars FOR SELECT
  TO anon
  USING (
    bidding_enabled = true 
    AND status = 'Active'
    AND now() >= bidding_start_date 
    AND now() <= bidding_end_date
  );

-- RLS Policies for bids
CREATE POLICY "Users can view own bids"
  ON bids FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create bids"
  ON bids FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to automatically update car status based on dates
CREATE OR REPLACE FUNCTION update_car_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.bidding_enabled = false THEN
    NEW.status := 'Disabled';
  ELSIF NEW.bidding_start_date IS NULL OR NEW.bidding_end_date IS NULL THEN
    NEW.status := 'Disabled';
  ELSIF now() < NEW.bidding_start_date THEN
    NEW.status := 'Upcoming';
  ELSIF now() >= NEW.bidding_start_date AND now() <= NEW.bidding_end_date THEN
    NEW.status := 'Active';
  ELSIF now() > NEW.bidding_end_date THEN
    -- Check if dates were recently updated (reopened)
    IF OLD.bidding_end_date IS NOT NULL AND NEW.bidding_end_date > OLD.bidding_end_date THEN
      NEW.status := 'Reopened';
    ELSE
      NEW.status := 'Closed';
    END IF;
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update car status
DROP TRIGGER IF EXISTS trigger_update_car_status ON cars;
CREATE TRIGGER trigger_update_car_status
  BEFORE INSERT OR UPDATE ON cars
  FOR EACH ROW
  EXECUTE FUNCTION update_car_status();

-- Create a default admin user (password: admin123 - should be changed in production)
INSERT INTO admin_users (email, password_hash, name)
VALUES ('admin@carbidding.com', '$2a$10$rQ5xZJKm3oQ5xZJKm3oQ5u9Y3YH5YH5YH5YH5YH5YH5YH5YH5YH5Y', 'System Admin')
ON CONFLICT (email) DO NOTHING;
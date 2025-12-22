/*
  # Add Extended Car Fields for Complete Excel Data
  
  1. Purpose
    - Store all fields from Excel import
    - Admin can see all fields
    - Users see only essential bidding information
  
  2. New Fields Added
    - `chassis_no` - Chassis number
    - `engine_no` - Engine number  
    - `color` - Vehicle color
    - `fuel_type` - Fuel type (Petrol/Diesel/Hybrid/Electric)
    - `transmission` - Transmission type (Manual/Automatic)
    - `body_type` - Body type (Sedan/SUV/Hatchback etc)
    - `seats` - Number of seats
    - `doors` - Number of doors
    - `specs` - Additional specifications (JSONB)
    - `notes` - Admin notes (text)
    - `images` - Array of image URLs
    - `documents` - Array of document URLs
    - All existing fields remain unchanged
  
  3. Fields Visible to Users (for bidding)
    - make_model
    - year
    - km
    - price (starting price)
    - location
    - bidding dates
    - status
  
  4. All Fields Visible to Admin
    - Everything above PLUS all the new extended fields
*/

-- Add new columns to cars table if they don't exist
DO $$ 
BEGIN
  -- Chassis number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'chassis_no'
  ) THEN
    ALTER TABLE cars ADD COLUMN chassis_no text;
  END IF;

  -- Engine number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'engine_no'
  ) THEN
    ALTER TABLE cars ADD COLUMN engine_no text;
  END IF;

  -- Color
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'color'
  ) THEN
    ALTER TABLE cars ADD COLUMN color text;
  END IF;

  -- Fuel type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'fuel_type'
  ) THEN
    ALTER TABLE cars ADD COLUMN fuel_type text;
  END IF;

  -- Transmission
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'transmission'
  ) THEN
    ALTER TABLE cars ADD COLUMN transmission text;
  END IF;

  -- Body type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'body_type'
  ) THEN
    ALTER TABLE cars ADD COLUMN body_type text;
  END IF;

  -- Seats
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'seats'
  ) THEN
    ALTER TABLE cars ADD COLUMN seats integer;
  END IF;

  -- Doors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'doors'
  ) THEN
    ALTER TABLE cars ADD COLUMN doors integer;
  END IF;

  -- Current location (detailed)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'current_location'
  ) THEN
    ALTER TABLE cars ADD COLUMN current_location text;
  END IF;

  -- Additional specs as JSONB
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'specs'
  ) THEN
    ALTER TABLE cars ADD COLUMN specs jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Admin notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'notes'
  ) THEN
    ALTER TABLE cars ADD COLUMN notes text;
  END IF;

  -- Images array
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'images'
  ) THEN
    ALTER TABLE cars ADD COLUMN images text[] DEFAULT ARRAY[]::text[];
  END IF;

  -- Documents array
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cars' AND column_name = 'documents'
  ) THEN
    ALTER TABLE cars ADD COLUMN documents text[] DEFAULT ARRAY[]::text[];
  END IF;

END $$;

-- Create index on chassis_no for quick lookups
CREATE INDEX IF NOT EXISTS idx_cars_chassis_no ON cars(chassis_no);

-- Create index on reg_no for quick lookups
CREATE INDEX IF NOT EXISTS idx_cars_reg_no ON cars(reg_no);

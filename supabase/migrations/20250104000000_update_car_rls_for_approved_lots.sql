-- Update RLS policy for cars to show cars from approved lots
-- Instead of requiring bidding_enabled = true, check if the lot is approved

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view active cars" ON cars;
DROP POLICY IF EXISTS "Public can view active cars" ON cars;

-- Create updated policy for authenticated users
-- Show cars from approved lots that are active and within bidding dates
-- Note: RLS policies use OR logic, so if any policy matches, the row is visible
CREATE POLICY "Users can view active cars"
  ON cars FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lots
      WHERE lots.id = cars.lot_id
      AND lots.approved = true
      AND lots.status IN ('Approved', 'Active')
    )
    AND status = 'Active'
    AND bidding_start_date IS NOT NULL
    AND bidding_end_date IS NOT NULL
    AND now() >= bidding_start_date 
    AND now() <= bidding_end_date
  );

-- Create updated policy for anonymous users (same logic)
CREATE POLICY "Public can view active cars"
  ON cars FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM lots
      WHERE lots.id = cars.lot_id
      AND lots.approved = true
      AND lots.status IN ('Approved', 'Active')
    )
    AND status = 'Active'
    AND bidding_start_date IS NOT NULL
    AND bidding_end_date IS NOT NULL
    AND now() >= bidding_start_date 
    AND now() <= bidding_end_date
  );

-- Verify the policies were created
-- You can check this in Supabase Dashboard > Authentication > Policies
-- Or run: SELECT * FROM pg_policies WHERE tablename = 'cars';


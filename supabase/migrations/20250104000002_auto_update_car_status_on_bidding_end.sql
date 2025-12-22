-- Function to automatically update car statuses when bidding ends
-- This function checks all cars and updates their status based on current time
CREATE OR REPLACE FUNCTION update_all_car_statuses()
RETURNS void AS $$
BEGIN
  -- Update all cars where bidding has ended (status should be 'Closed')
  -- Remove the WHERE clause to update ALL cars, not just those that need changing
  UPDATE cars
  SET 
    status = CASE
      WHEN bidding_enabled = false THEN 'Disabled'
      WHEN bidding_start_date IS NULL OR bidding_end_date IS NULL THEN 'Disabled'
      WHEN now() < bidding_start_date THEN 'Upcoming'
      WHEN now() >= bidding_start_date AND now() <= bidding_end_date THEN 'Active'
      WHEN now() > bidding_end_date THEN 'Closed'
      ELSE 'Disabled'
    END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to update lot statuses based on car statuses and lot dates
-- A lot should be 'Closed' if all its cars have ended bidding OR if lot's own end date has passed
CREATE OR REPLACE FUNCTION update_all_lot_statuses()
RETURNS void AS $$
BEGIN
  -- Update lots based on their own dates AND car statuses
  UPDATE lots
  SET 
    status = CASE
      WHEN approved = false THEN 'Pending'
      WHEN early_closed = true THEN 'Early Closed'
      WHEN approved = true AND bidding_start_date IS NULL OR bidding_end_date IS NULL THEN 'Pending'
      WHEN approved = true AND now() < bidding_start_date THEN 'Approved'
      -- Check if lot has any active cars (cars with bidding still ongoing)
      WHEN approved = true AND now() >= bidding_start_date AND now() <= bidding_end_date AND EXISTS (
        SELECT 1 FROM cars 
        WHERE cars.lot_id = lots.id 
        AND cars.bidding_end_date IS NOT NULL
        AND now() <= cars.bidding_end_date
        AND cars.status IN ('Active', 'Upcoming')
      ) THEN 'Active'
      -- Lot's own end date has passed OR all cars have ended
      WHEN approved = true AND (
        now() > bidding_end_date OR
        (NOT EXISTS (
          SELECT 1 FROM cars 
          WHERE cars.lot_id = lots.id 
          AND cars.bidding_end_date IS NOT NULL
          AND now() <= cars.bidding_end_date
          AND cars.status IN ('Active', 'Upcoming')
        ) AND EXISTS (SELECT 1 FROM cars WHERE cars.lot_id = lots.id))
      ) THEN 'Closed'
      ELSE status
    END,
    updated_at = now()
  WHERE approved = true;
END;
$$ LANGUAGE plpgsql;

-- Create a function that can be called from the frontend
CREATE OR REPLACE FUNCTION refresh_car_statuses()
RETURNS json AS $$
DECLARE
  car_updated_count integer;
  lot_updated_count integer;
BEGIN
  -- Update all car statuses
  PERFORM update_all_car_statuses();
  GET DIAGNOSTICS car_updated_count = ROW_COUNT;
  
  -- Update all lot statuses based on car statuses
  PERFORM update_all_lot_statuses();
  GET DIAGNOSTICS lot_updated_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'cars_updated', car_updated_count,
    'lots_updated', lot_updated_count,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_car_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_car_statuses() TO anon;

-- If pg_cron extension is available, schedule it to run every minute
-- Uncomment the following if you have pg_cron installed:
/*
SELECT cron.schedule(
  'update-car-statuses',
  '* * * * *', -- Every minute
  $$SELECT update_all_car_statuses();$$
);
*/

-- Also update the existing trigger function to ensure it handles all cases correctly
CREATE OR REPLACE FUNCTION update_car_status()
RETURNS trigger AS $$
BEGIN
  -- Always check current time, not just on update
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
  ELSE
    NEW.status := 'Disabled';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


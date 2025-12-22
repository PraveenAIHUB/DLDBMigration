-- Ensure car and lot statuses are automatically updated when bidding periods end
-- This migration improves the refresh function and ensures it's called properly

-- First, ensure the force_update_all_statuses function is robust
CREATE OR REPLACE FUNCTION force_update_all_statuses()
RETURNS json AS $$
DECLARE
  cars_updated integer := 0;
  lots_updated integer := 0;
BEGIN
  -- Force update ALL cars based on current time and dates
  WITH updated_cars AS (
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
      updated_at = now()
    WHERE 
      -- Only update if status needs to change
      status != CASE
        WHEN bidding_enabled = false THEN 'Disabled'
        WHEN bidding_start_date IS NULL OR bidding_end_date IS NULL THEN 'Disabled'
        WHEN now() < bidding_start_date THEN 'Upcoming'
        WHEN now() >= bidding_start_date AND now() <= bidding_end_date THEN 'Active'
        WHEN now() > bidding_end_date THEN 'Closed'
        ELSE 'Disabled'
      END
    RETURNING id
  )
  SELECT COUNT(*) INTO cars_updated FROM updated_cars;

  -- Force update ALL lots based on their dates and car dates
  WITH updated_lots AS (
    UPDATE lots
    SET 
      status = CASE
        WHEN approved = false THEN 'Pending'
        WHEN early_closed = true THEN 'Early Closed'
        WHEN approved = true AND (bidding_start_date IS NULL OR bidding_end_date IS NULL) THEN 'Pending'
        WHEN approved = true AND now() < bidding_start_date THEN 'Approved'
        -- Check if lot has any cars with bidding still ongoing (check dates directly, not status)
        WHEN approved = true AND now() >= bidding_start_date AND now() <= bidding_end_date AND EXISTS (
          SELECT 1 FROM cars 
          WHERE cars.lot_id = lots.id 
          AND cars.bidding_end_date IS NOT NULL
          AND cars.bidding_start_date IS NOT NULL
          AND now() >= cars.bidding_start_date
          AND now() <= cars.bidding_end_date
        ) THEN 'Active'
        -- Lot's end date passed OR all cars have ended (check dates directly)
        WHEN approved = true AND (
          now() > bidding_end_date OR
          (NOT EXISTS (
            SELECT 1 FROM cars 
            WHERE cars.lot_id = lots.id 
            AND cars.bidding_end_date IS NOT NULL
            AND cars.bidding_start_date IS NOT NULL
            AND now() >= cars.bidding_start_date
            AND now() <= cars.bidding_end_date
          ) AND EXISTS (SELECT 1 FROM cars WHERE cars.lot_id = lots.id))
        ) THEN 'Closed'
        ELSE status
      END,
      updated_at = now()
    WHERE approved = true
      -- Only update if status needs to change
      AND status != CASE
        WHEN approved = false THEN 'Pending'
        WHEN early_closed = true THEN 'Early Closed'
        WHEN approved = true AND (bidding_start_date IS NULL OR bidding_end_date IS NULL) THEN 'Pending'
        WHEN approved = true AND now() < bidding_start_date THEN 'Approved'
        WHEN approved = true AND now() >= bidding_start_date AND now() <= bidding_end_date AND EXISTS (
          SELECT 1 FROM cars 
          WHERE cars.lot_id = lots.id 
          AND cars.bidding_end_date IS NOT NULL
          AND cars.bidding_start_date IS NOT NULL
          AND now() >= cars.bidding_start_date
          AND now() <= cars.bidding_end_date
        ) THEN 'Active'
        WHEN approved = true AND (
          now() > bidding_end_date OR
          (NOT EXISTS (
            SELECT 1 FROM cars 
            WHERE cars.lot_id = lots.id 
            AND cars.bidding_end_date IS NOT NULL
            AND cars.bidding_start_date IS NOT NULL
            AND now() >= cars.bidding_start_date
            AND now() <= cars.bidding_end_date
          ) AND EXISTS (SELECT 1 FROM cars WHERE cars.lot_id = lots.id))
        ) THEN 'Closed'
        ELSE status
      END
    RETURNING id
  )
  SELECT COUNT(*) INTO lots_updated FROM updated_lots;

  RETURN json_build_object(
    'success', true,
    'cars_updated', cars_updated,
    'lots_updated', lots_updated,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the refresh_car_statuses function to use the force update
CREATE OR REPLACE FUNCTION refresh_car_statuses()
RETURNS json AS $$
BEGIN
  -- Use the force update function
  RETURN force_update_all_statuses();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION force_update_all_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION force_update_all_statuses() TO anon;
GRANT EXECUTE ON FUNCTION refresh_car_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_car_statuses() TO anon;

-- Run the refresh immediately to fix any existing issues
SELECT refresh_car_statuses();

-- If pg_cron extension is available, schedule it to run every minute
-- Note: This requires pg_cron extension to be enabled in Supabase
-- Uncomment the following lines if pg_cron is available:
/*
DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing schedule if it exists
    PERFORM cron.unschedule('update-car-lot-statuses');
    
    -- Schedule to run every minute
    PERFORM cron.schedule(
      'update-car-lot-statuses',
      '* * * * *', -- Every minute
      $$SELECT refresh_car_statuses();$$
    );
  END IF;
END $$;
*/


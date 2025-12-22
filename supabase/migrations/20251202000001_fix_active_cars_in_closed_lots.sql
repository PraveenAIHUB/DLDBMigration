-- Fix any cars that are still Active in closed lots
-- This ensures all cars in closed lots are set to Closed status

-- Update all cars in closed lots to Closed status
UPDATE cars
SET 
  status = 'Closed',
  updated_at = now()
WHERE lot_id IN (
  SELECT id FROM lots 
  WHERE status IN ('Closed', 'Early Closed') OR early_closed = true
)
AND status = 'Active';

-- Also update cars that might be in other active states but should be closed
UPDATE cars
SET 
  status = 'Closed',
  updated_at = now()
WHERE lot_id IN (
  SELECT id FROM lots 
  WHERE status IN ('Closed', 'Early Closed') OR early_closed = true
)
AND status NOT IN ('Closed', 'Disabled');

-- Create a function to check and fix cars in closed lots
CREATE OR REPLACE FUNCTION fix_cars_in_closed_lots()
RETURNS json AS $$
DECLARE
  cars_updated integer := 0;
BEGIN
  -- Update all cars in closed lots to Closed status
  WITH updated_cars AS (
    UPDATE cars
    SET 
      status = 'Closed',
      updated_at = now()
    WHERE lot_id IN (
      SELECT id FROM lots 
      WHERE status IN ('Closed', 'Early Closed') OR early_closed = true
    )
    AND status != 'Closed'
    RETURNING id
  )
  SELECT COUNT(*) INTO cars_updated FROM updated_cars;

  RETURN json_build_object(
    'success', true,
    'cars_updated', cars_updated,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION fix_cars_in_closed_lots() TO authenticated;
GRANT EXECUTE ON FUNCTION fix_cars_in_closed_lots() TO anon;

-- Run the fix function immediately
SELECT fix_cars_in_closed_lots();

-- Update the refresh_car_statuses function to also fix cars in closed lots
-- We'll create a wrapper that calls both functions if they exist
CREATE OR REPLACE FUNCTION refresh_car_statuses()
RETURNS json AS $refresh_func$
DECLARE
  force_result json;
  fix_result json;
BEGIN
  -- Try to call force_update_all_statuses if it exists
  BEGIN
    SELECT force_update_all_statuses() INTO force_result;
  EXCEPTION WHEN OTHERS THEN
    force_result := NULL;
  END;
  
  -- Always call fix_cars_in_closed_lots
  fix_result := fix_cars_in_closed_lots();
  
  -- Return combined result
  IF force_result IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'force_update', force_result,
      'fix_closed_lots', fix_result,
      'timestamp', now()
    );
  ELSE
    RETURN json_build_object(
      'success', true,
      'fix_closed_lots', fix_result,
      'timestamp', now()
    );
  END IF;
END;
$refresh_func$ LANGUAGE plpgsql SECURITY DEFINER;


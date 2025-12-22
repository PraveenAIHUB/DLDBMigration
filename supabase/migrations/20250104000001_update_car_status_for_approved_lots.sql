-- Function to update car statuses based on dates
-- This ensures cars in approved lots have correct status
CREATE OR REPLACE FUNCTION update_car_statuses_for_approved_lots()
RETURNS void AS $$
BEGIN
  -- Update car statuses based on dates for cars in approved lots
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
  WHERE EXISTS (
    SELECT 1 FROM lots
    WHERE lots.id = cars.lot_id
    AND lots.approved = true
    AND lots.status IN ('Approved', 'Active')
  );
END;
$$ LANGUAGE plpgsql;

-- Run the function to update all car statuses
SELECT update_car_statuses_for_approved_lots();

-- Also create a trigger to automatically update car status when lot is approved
CREATE OR REPLACE FUNCTION update_cars_when_lot_approved()
RETURNS trigger AS $$
BEGIN
  -- When a lot is approved, ensure cars have correct status
  IF NEW.approved = true AND (OLD.approved = false OR OLD.approved IS NULL) THEN
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
    WHERE lot_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on lots table
DROP TRIGGER IF EXISTS trigger_update_cars_on_lot_approval ON lots;
CREATE TRIGGER trigger_update_cars_on_lot_approval
  AFTER UPDATE OF approved ON lots
  FOR EACH ROW
  WHEN (NEW.approved = true AND (OLD.approved = false OR OLD.approved IS NULL))
  EXECUTE FUNCTION update_cars_when_lot_approved();


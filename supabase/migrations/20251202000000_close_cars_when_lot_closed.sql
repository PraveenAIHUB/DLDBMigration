-- Function to close all cars when lot is closed
-- This ensures that when a lot status changes to "Closed" or "Early Closed",
-- all related cars are also set to "Closed" status

CREATE OR REPLACE FUNCTION close_cars_when_lot_closed()
RETURNS trigger AS $$
BEGIN
  -- When a lot status changes to "Closed" or "Early Closed", close all related cars
  IF (NEW.status = 'Closed' OR NEW.status = 'Early Closed') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('Closed', 'Early Closed')) THEN
    UPDATE cars
    SET 
      status = 'Closed',
      updated_at = now()
    WHERE lot_id = NEW.id
    AND status != 'Closed'; -- Only update cars that are not already closed
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on lots table to automatically close cars when lot is closed
DROP TRIGGER IF EXISTS trigger_close_cars_on_lot_close ON lots;
CREATE TRIGGER trigger_close_cars_on_lot_close
  AFTER UPDATE OF status ON lots
  FOR EACH ROW
  WHEN (
    (NEW.status = 'Closed' OR NEW.status = 'Early Closed')
    AND (OLD.status IS NULL OR OLD.status NOT IN ('Closed', 'Early Closed'))
  )
  EXECUTE FUNCTION close_cars_when_lot_closed();

-- Also handle the case when early_closed flag is set
CREATE OR REPLACE FUNCTION close_cars_when_lot_early_closed()
RETURNS trigger AS $$
BEGIN
  -- When a lot is early closed, close all related cars
  IF NEW.early_closed = true 
     AND (OLD.early_closed IS NULL OR OLD.early_closed = false) THEN
    UPDATE cars
    SET 
      status = 'Closed',
      updated_at = now()
    WHERE lot_id = NEW.id
    AND status != 'Closed'; -- Only update cars that are not already closed
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for early_closed flag
DROP TRIGGER IF EXISTS trigger_close_cars_on_lot_early_close ON lots;
CREATE TRIGGER trigger_close_cars_on_lot_early_close
  AFTER UPDATE OF early_closed ON lots
  FOR EACH ROW
  WHEN (NEW.early_closed = true AND (OLD.early_closed IS NULL OR OLD.early_closed = false))
  EXECUTE FUNCTION close_cars_when_lot_early_closed();

-- Update existing cars in closed lots to ensure they are closed
UPDATE cars
SET 
  status = 'Closed',
  updated_at = now()
WHERE lot_id IN (
  SELECT id FROM lots 
  WHERE status IN ('Closed', 'Early Closed') OR early_closed = true
)
AND status != 'Closed';


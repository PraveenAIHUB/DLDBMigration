/*
  # Ensure One Bid Per User Per Car
  
  1. Purpose
    - Ensures that each user can only have one active bid per car
    - When updating a bid, it updates the existing bid instead of creating a new one
    - When deleting a bid, it properly removes it without showing previous bids
  
  2. Changes
    - Adds a unique constraint on (car_id, user_id) to prevent duplicate bids
    - This ensures database-level enforcement of one bid per user per car
*/

-- Add unique constraint to ensure one bid per user per car
-- First, remove any duplicate bids (keep the most recent one)
DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  -- Find all duplicate bids (same user, same car)
  FOR duplicate_record IN
    SELECT car_id, user_id, COUNT(*) as count
    FROM bids
    GROUP BY car_id, user_id
    HAVING COUNT(*) > 1
  LOOP
    -- Delete all but the most recent bid for each duplicate
    DELETE FROM bids
    WHERE car_id = duplicate_record.car_id
      AND user_id = duplicate_record.user_id
      AND id NOT IN (
        SELECT id
        FROM bids
        WHERE car_id = duplicate_record.car_id
          AND user_id = duplicate_record.user_id
        ORDER BY created_at DESC
        LIMIT 1
      );
  END LOOP;
END $$;

-- Create unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_bids_unique_user_car 
ON bids(car_id, user_id);

-- Add comment
COMMENT ON INDEX idx_bids_unique_user_car IS 'Ensures one bid per user per car';


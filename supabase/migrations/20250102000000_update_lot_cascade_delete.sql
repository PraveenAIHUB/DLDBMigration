/*
  # Update Lot Cascade Delete
  
  Changes the lot_id foreign key constraint in cars table
  from ON DELETE SET NULL to ON DELETE CASCADE
  so that deleting a lot will automatically delete all associated vehicles.
*/

-- Drop the existing foreign key constraint (if it exists)
-- PostgreSQL auto-generates constraint names, so we'll find and drop it
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the constraint name for lot_id foreign key in cars table
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'cars'::regclass
    AND confrelid = 'lots'::regclass
    AND contype = 'f'
  LIMIT 1;
  
  -- Drop the constraint if it exists
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE cars DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Re-add the constraint with CASCADE delete
ALTER TABLE cars 
ADD CONSTRAINT cars_lot_id_fkey 
FOREIGN KEY (lot_id) 
REFERENCES lots(id) 
ON DELETE CASCADE;


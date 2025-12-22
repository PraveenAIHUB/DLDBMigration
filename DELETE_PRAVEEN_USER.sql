-- Delete user praveenshakthiv@gmail.com from both auth.users and public.users
-- Run this in Supabase SQL Editor

-- Step 1: Find the user ID
DO $$
DECLARE
  user_id_to_delete uuid;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO user_id_to_delete
  FROM auth.users
  WHERE email = 'praveenshakthiv@gmail.com';
  
  IF user_id_to_delete IS NULL THEN
    RAISE NOTICE 'User not found in auth.users';
  ELSE
    RAISE NOTICE 'Found user ID: %', user_id_to_delete;
    
    -- Delete from public.users first (due to foreign key constraints)
    DELETE FROM public.users WHERE id = user_id_to_delete;
    RAISE NOTICE 'Deleted from public.users';
    
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    RAISE NOTICE 'Deleted from auth.users';
    
    RAISE NOTICE '✅ User deleted successfully';
  END IF;
END $$;

-- Step 2: Verify deletion
SELECT 
  'Verification:' as check_type,
  COUNT(*) as remaining_records
FROM auth.users
WHERE email = 'praveenshakthiv@gmail.com';

-- Should return 0 if deletion was successful


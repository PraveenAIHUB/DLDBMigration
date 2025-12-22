-- ============================================
-- Delete User from auth.users
-- ============================================
-- 
-- WARNING: This requires superuser/admin access to the database
-- In Supabase, you typically need to use the Admin API instead
--
-- Option 1: Direct SQL (if you have superuser access)
-- ============================================

-- First, find the user ID
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'praveenshakthiv@gmail.com';

-- Delete the user (replace USER_ID_HERE with the actual ID from above)
-- DELETE FROM auth.users WHERE id = 'USER_ID_HERE';

-- ============================================
-- Option 2: Using Supabase Admin API (Recommended)
-- ============================================
-- Use the script: npm run delete-auth-user
-- Or use the Supabase Dashboard → Authentication → Users → Delete

-- ============================================
-- Option 3: SQL Function (if you have SECURITY DEFINER privileges)
-- ============================================

-- Create a function to delete user (one-time setup)
CREATE OR REPLACE FUNCTION delete_auth_user_by_email(user_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id uuid;
  deleted_count integer;
BEGIN
  -- Find the user ID
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = user_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count > 0 THEN
    RETURN json_build_object(
      'success', true,
      'message', 'User deleted successfully',
      'user_id', user_id
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to delete user'
    );
  END IF;
END;
$$;

-- Execute the function to delete the user
SELECT delete_auth_user_by_email('praveenshakthiv@gmail.com');

-- ============================================
-- Option 4: Direct DELETE (if you have access)
-- ============================================
-- This will only work if you have direct database access with superuser privileges

-- Step 1: Get the user ID
DO $$
DECLARE
  user_id_to_delete uuid;
BEGIN
  -- Find the user
  SELECT id INTO user_id_to_delete
  FROM auth.users
  WHERE email = 'praveenshakthiv@gmail.com';
  
  IF user_id_to_delete IS NOT NULL THEN
    -- Delete the user
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    RAISE NOTICE 'User deleted: %', user_id_to_delete;
  ELSE
    RAISE NOTICE 'User not found';
  END IF;
END $$;

-- ============================================
-- RECOMMENDED: Use Supabase Dashboard
-- ============================================
-- 1. Go to Supabase Dashboard
-- 2. Navigate to Authentication → Users
-- 3. Search for: praveenshakthiv@gmail.com
-- 4. Click the three dots (⋮) → Delete
-- 5. Confirm deletion

-- ============================================
-- Or use the script:
-- npm run delete-auth-user
-- ============================================


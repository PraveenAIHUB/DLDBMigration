-- Remove admin users from public.users table
-- Admin users should ONLY be in admin_users table, NOT in users table
-- Run this in Supabase SQL Editor

-- Step 1: Find admin users that are incorrectly in the users table
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  CASE 
    WHEN EXISTS (SELECT 1 FROM admin_users au WHERE au.email = u.email) THEN 'Admin user in wrong table'
    WHEN EXISTS (SELECT 1 FROM business_users bu WHERE bu.email = u.email) THEN 'Business user in wrong table'
    ELSE 'Regular user (OK)'
  END as issue_type
FROM users u
WHERE EXISTS (
  SELECT 1 FROM admin_users au WHERE au.email = u.email
)
OR EXISTS (
  SELECT 1 FROM business_users bu WHERE bu.email = u.email
);

-- Step 2: Remove admin users from users table
-- This will delete any admin or business users that were incorrectly added to the users table
DELETE FROM users
WHERE EXISTS (
  SELECT 1 FROM admin_users au WHERE au.email = users.email
)
OR EXISTS (
  SELECT 1 FROM business_users bu WHERE bu.email = users.email
);

-- Step 3: Verify the cleanup
SELECT 
  'Remaining admin users in users table:' as check_type,
  COUNT(*) as count
FROM users
WHERE EXISTS (
  SELECT 1 FROM admin_users au WHERE au.email = users.email
)
OR EXISTS (
  SELECT 1 FROM business_users bu WHERE bu.email = users.email
);

-- Expected result: count should be 0


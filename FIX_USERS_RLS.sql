-- ============================================
-- Fix Users Table RLS Policy for INSERT
-- ============================================
-- Run this in Supabase SQL Editor to fix the RLS policy issue

-- Step 1: Check current policies
SELECT 
  policyname,
  cmd as command,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname;

-- Step 2: Fix the admin policy (add WITH CHECK clause)
DROP POLICY IF EXISTS "Admins can view and manage all users" ON users;

CREATE POLICY "Admins can view and manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Step 3: Drop and recreate INSERT policies
DROP POLICY IF EXISTS "Anyone can create user profile" ON users;
DROP POLICY IF EXISTS "Anyone can create bidder profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can create bidder profile" ON users;
DROP POLICY IF EXISTS "Admins can create business users" ON users;

-- Step 4: Create INSERT policy for regular users (bidders)
-- This is the main policy that allows users to register
CREATE POLICY "Authenticated users can create bidder profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    -- Role must be 'bidder'
    AND role = 'bidder'
    -- The id in the insert must match the authenticated user's ID
    -- This ensures users can only create their own profile
    AND id = auth.uid()
  );

-- Step 5: Create INSERT policy for admins to create business users
CREATE POLICY "Admins can create business users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be an admin
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
    -- Role must be 'business_user'
    AND role = 'business_user'
  );

-- Step 6: Verify policies are created
SELECT 
  policyname,
  cmd as command,
  with_check as with_check_clause
FROM pg_policies 
WHERE tablename = 'users' 
  AND schemaname = 'public'
  AND cmd IN ('INSERT', 'ALL')
ORDER BY policyname;

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. The INSERT policy requires:
--    - auth.uid() IS NOT NULL (user is authenticated)
--    - role = 'bidder' (must be explicitly set)
--    - id = auth.uid() (must match authenticated user ID)
--
-- 2. When inserting, make sure:
--    - The 'id' field matches the authenticated user's ID from auth.users
--    - The 'role' field is explicitly set to 'bidder'
--
-- 3. PostgreSQL RLS uses OR logic:
--    - If user is admin, admin policy applies
--    - If user is not admin, regular user policy applies
--    - Both can coexist without conflict


-- ============================================
-- Fix Users Table RLS Policy for INSERT
-- ============================================
-- Run this in Supabase SQL Editor
-- This fixes the "new row violates row-level security policy" error

-- Step 1: Fix the admin policy (add WITH CHECK clause)
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

-- Step 2: Drop existing INSERT policies
DROP POLICY IF EXISTS "Anyone can create user profile" ON users;
DROP POLICY IF EXISTS "Anyone can create bidder profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can create bidder profile" ON users;
DROP POLICY IF EXISTS "Admins can create business users" ON users;

-- Step 3: Create INSERT policy for regular users (bidders)
CREATE POLICY "Authenticated users can create bidder profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND role = 'bidder'
    AND id = auth.uid()
  );

-- Step 4: Create INSERT policy for admins to create business users
CREATE POLICY "Admins can create business users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
    AND role = 'business_user'
  );

-- Step 5: Verify policies
SELECT 
  policyname,
  cmd as command
FROM pg_policies 
WHERE tablename = 'users' 
  AND schemaname = 'public'
  AND cmd IN ('INSERT', 'ALL')
ORDER BY policyname;


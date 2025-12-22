-- ============================================
-- Complete Fix for Users Table RLS Policy
-- ============================================
-- Run this ENTIRE script in Supabase SQL Editor
-- This will fix the RLS policy issue completely

-- ============================================
-- STEP 1: Drop ALL existing policies on users table
-- ============================================
DROP POLICY IF EXISTS "Anyone can create user profile" ON users;
DROP POLICY IF EXISTS "Anyone can create bidder profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can create bidder profile" ON users;
DROP POLICY IF EXISTS "Admins can create business users" ON users;
DROP POLICY IF EXISTS "Admins can view and manage all users" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;

-- ============================================
-- STEP 2: Recreate SELECT policies
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = auth.jwt()->>'email'
    )
  );

-- ============================================
-- STEP 3: Recreate UPDATE policies
-- ============================================

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- STEP 4: Recreate INSERT policies (THIS IS THE KEY FIX)
-- ============================================

-- Policy for regular authenticated users to create bidder profiles
-- This is the main policy that allows registration
CREATE POLICY "Authenticated users can create bidder profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    -- Role must be 'bidder'
    AND role = 'bidder'
    -- The id must match the authenticated user's ID
    AND id = auth.uid()
  );

-- Policy for admins to create business users
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

-- Admin SELECT policy (separate from INSERT to avoid conflicts)
CREATE POLICY "Admins can select all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Admin UPDATE policy
CREATE POLICY "Admins can update all users"
  ON users
  FOR UPDATE
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

-- Admin DELETE policy
CREATE POLICY "Admins can delete all users"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- ============================================
-- STEP 5: Verify all policies are created
-- ============================================
SELECT 
  policyname,
  cmd as command,
  CASE 
    WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ MISSING WITH CHECK'
    WHEN cmd = 'INSERT' THEN '✅ Has WITH CHECK'
    WHEN cmd = 'ALL' AND with_check IS NULL THEN '⚠️ ALL without WITH CHECK'
    ELSE '✅ OK'
  END as status
FROM pg_policies 
WHERE tablename = 'users' 
  AND schemaname = 'public'
ORDER BY cmd, policyname;


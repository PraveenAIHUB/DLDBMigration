/*
  # Fix Users Table INSERT RLS Policy Conflict
  
  1. Problem
    - The "Admins can view and manage all users" policy uses FOR ALL without WITH CHECK
    - This can cause issues with INSERT operations
    - Need to ensure INSERT policies work correctly for regular users
  
  2. Solution
    - Fix the admin policy to have proper WITH CHECK clause
    - Ensure regular user INSERT policy is correct
    - Make sure policies don't conflict
  
  3. Security
    - Regular users can only insert with role='bidder' and id matching auth.uid()
    - Admins can insert with any role via the admin policy
*/

-- First, fix the admin policy to have proper WITH CHECK clause for INSERT operations
-- The issue is that FOR ALL policies need both USING and WITH CHECK clauses
-- Drop and recreate the admin policy with proper WITH CHECK
DROP POLICY IF EXISTS "Admins can view and manage all users" ON users;

-- Recreate admin policy with proper WITH CHECK for INSERT/UPDATE operations
-- Note: This policy only applies when user IS an admin
-- Regular users will be checked against other policies (OR logic)
CREATE POLICY "Admins can view and manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    -- For SELECT/DELETE: user must be admin
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    -- For INSERT/UPDATE: user must be admin
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Drop existing INSERT policies to recreate them properly
DROP POLICY IF EXISTS "Anyone can create user profile" ON users;
DROP POLICY IF EXISTS "Anyone can create bidder profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can create bidder profile" ON users;
DROP POLICY IF EXISTS "Admins can create business users" ON users;

-- Policy for regular authenticated users to insert bidder profiles
-- This policy allows ANY authenticated user to insert their own profile with role='bidder'
CREATE POLICY "Authenticated users can create bidder profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    -- Must set role to 'bidder' (required by RLS)
    AND role = 'bidder'
    -- The id must match the authenticated user's ID (prevents creating profiles for other users)
    AND id = auth.uid()
  );

-- Policy for admins to create business users
CREATE POLICY "Admins can create business users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Check if user is admin
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
    -- Must set role to 'business_user'
    AND role = 'business_user'
  );

-- Note: PostgreSQL RLS uses OR logic for policies
-- If a user is an admin, the admin policy will allow the operation
-- If a user is not an admin, the regular user policy will be checked
-- Both policies can coexist without conflict


-- Complete fix for terms_and_conditions RLS policy
-- This ensures anonymous users can view active terms
-- Run this in Supabase SQL Editor

-- Step 1: Ensure RLS is enabled on the table
ALTER TABLE terms_and_conditions ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view active terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Public can view active terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can manage terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can insert terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can update terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can delete terms" ON terms_and_conditions;

-- Step 3: Create a permissive SELECT policy for anonymous users
-- This MUST be permissive and allow both anon and authenticated roles
CREATE POLICY "Public can view active terms"
  ON terms_and_conditions FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Step 4: Create separate admin policies for INSERT, UPDATE, DELETE
-- These are separate to avoid conflicts with the SELECT policy

CREATE POLICY "Admins can insert terms"
  ON terms_and_conditions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update terms"
  ON terms_and_conditions FOR UPDATE
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

CREATE POLICY "Admins can delete terms"
  ON terms_and_conditions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Step 5: Verify the policies were created
SELECT 
  policyname,
  cmd as command,
  roles,
  qual as using_clause
FROM pg_policies 
WHERE tablename = 'terms_and_conditions'
ORDER BY policyname;


-- Simple fix for terms_and_conditions RLS - allows anonymous access
-- Run this in Supabase SQL Editor

-- Drop ALL existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view active terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Public can view active terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can manage terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can insert terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can update terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can delete terms" ON terms_and_conditions;

-- Ensure RLS is enabled
ALTER TABLE terms_and_conditions ENABLE ROW LEVEL SECURITY;

-- Create policy that allows anonymous users to view active terms
CREATE POLICY "Public can view active terms"
  ON terms_and_conditions FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Create separate admin policies
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


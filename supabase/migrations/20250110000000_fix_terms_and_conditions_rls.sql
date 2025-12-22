-- Fix RLS policy for terms_and_conditions table
-- Allow both anonymous and authenticated users to view active terms
-- This is needed because terms are displayed during registration before authentication

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view active terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can manage terms" ON terms_and_conditions;

-- Create policy that allows anonymous users to view active terms
-- This is necessary for registration flow where users aren't authenticated yet
CREATE POLICY "Public can view active terms"
  ON terms_and_conditions FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Recreate admin policy for managing terms (INSERT, UPDATE, DELETE)
-- Use separate policies to avoid conflicts with SELECT policy
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


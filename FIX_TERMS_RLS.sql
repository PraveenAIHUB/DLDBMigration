-- Quick fix for terms_and_conditions RLS policy
-- This allows anonymous users to view active terms (needed during registration)
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view active terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can manage terms" ON terms_and_conditions;

-- Create policy that allows anonymous users to view active terms
CREATE POLICY "Public can view active terms"
  ON terms_and_conditions FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Recreate admin policies separately to avoid conflicts
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


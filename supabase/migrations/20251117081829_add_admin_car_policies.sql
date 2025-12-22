/*
  # Add Admin Policies for Cars Table

  1. Changes
    - Add INSERT policy for admins to create cars
    - Add UPDATE policy for admins to edit cars
    - Add DELETE policy for admins to remove cars
    - Add SELECT policy for admins to view all cars (not just active ones)
  
  2. Security
    - All policies check that the user's email exists in admin_users table
    - Admins can perform all operations on cars regardless of status
*/

-- Allow admins to view all cars (not just active bidding ones)
CREATE POLICY "Admins can view all cars"
  ON cars
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = auth.jwt()->>'email'
    )
  );

-- Allow admins to insert new cars
CREATE POLICY "Admins can insert cars"
  ON cars
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = auth.jwt()->>'email'
    )
  );

-- Allow admins to update cars
CREATE POLICY "Admins can update cars"
  ON cars
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = auth.jwt()->>'email'
    )
  );

-- Allow admins to delete cars
CREATE POLICY "Admins can delete cars"
  ON cars
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = auth.jwt()->>'email'
    )
  );

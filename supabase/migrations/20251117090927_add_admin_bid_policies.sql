/*
  # Add Admin Policies for Bids Table

  1. Changes
    - Add SELECT policy for admins to view all bids
    - This allows admins to:
      * View bidding details for any car
      * Export bid data
      * See all user bids in the system
  
  2. Security
    - Policy checks that user's email exists in admin_users table
    - Admins can view all bids but cannot modify them
*/

-- Allow admins to view all bids from all users
CREATE POLICY "Admins can view all bids"
  ON bids
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = auth.jwt()->>'email'
    )
  );

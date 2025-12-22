/*
  # Add Admin Read Policy for Users Table

  1. Changes
    - Add SELECT policy for admins to view all user profiles
    - This allows admins to:
      * View customer contact details in bidding modal
      * Export user information with bids
      * Access user data for administrative purposes
  
  2. Security
    - Policy checks that user's email exists in admin_users table
    - Admins can view all user profiles but regular users can only see their own
*/

-- Allow admins to view all user profiles
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

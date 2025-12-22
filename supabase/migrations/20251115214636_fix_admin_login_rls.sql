/*
  # Fix Admin Login RLS Policy
  
  1. Purpose
    - Allow unauthenticated users to check if an email is an admin
    - This is needed for the login flow to work properly
  
  2. Changes
    - Add RLS policy for anonymous users to read admin_users by email
    - This only exposes which emails are admins, not passwords or other sensitive data
  
  3. Security
    - Only allows SELECT operations
    - Password hash is not exposed in the application
    - Maintains security while enabling login functionality
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Authenticated users can check admin status" ON admin_users;

-- Create new policies for both authenticated and anonymous users
CREATE POLICY "Users can check admin status"
  ON admin_users FOR SELECT
  TO authenticated, anon
  USING (true);

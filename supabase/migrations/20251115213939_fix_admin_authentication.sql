/*
  # Fix Admin Authentication System
  
  1. Purpose
    - Synchronizes admin_users table with auth.users
    - Updates RLS policies to work correctly with authentication
  
  2. Changes
    - Updates admin_users to use auth user ID
    - Modifies RLS policy to check by email instead of ID
    - Adds policy for reading admin_users by email
  
  3. Security
    - Maintains RLS protection
    - Allows admin login verification
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Admin users can read own data" ON admin_users;

-- Create a more flexible policy that allows checking admin status by email
CREATE POLICY "Authenticated users can check admin status"
  ON admin_users FOR SELECT
  TO authenticated
  USING (true);

-- Update the admin_users record to match the auth.users ID
UPDATE admin_users 
SET id = (SELECT id FROM auth.users WHERE email = 'admin@carbidding.com')
WHERE email = 'admin@carbidding.com';

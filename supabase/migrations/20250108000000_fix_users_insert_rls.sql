/*
  # Fix Users Table INSERT RLS Policy
  
  1. Purpose
    - Ensure users can register by explicitly setting role = 'bidder'
    - The RLS policy requires role = 'bidder' in WITH CHECK clause
    - Default values are applied AFTER WITH CHECK evaluation, so role must be explicitly set
  
  2. Changes
    - Update the INSERT policy to be more explicit about role requirement
    - Add comment explaining why role must be set explicitly
  
  3. Security
    - Policy still enforces that only 'bidder' role can be created by non-admins
    - Admins can create business_user roles via separate policy
*/

-- Drop and recreate the policy to ensure it's correct
DROP POLICY IF EXISTS "Anyone can create bidder profile" ON users;

-- Create policy that explicitly requires role = 'bidder'
-- Note: Even though the column has a default value, WITH CHECK evaluates BEFORE defaults
-- So the role must be explicitly set to 'bidder' in the INSERT statement
CREATE POLICY "Anyone can create bidder profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'bidder'
  );

-- Ensure the policy allows inserts when role is explicitly set
-- This policy works in conjunction with the default value on the role column
-- Application code must explicitly set role: 'bidder' when inserting users


-- ============================================
-- Fix INSERT Policy for Regular Users
-- ============================================
-- This fixes the RLS issue when is_admin = false (regular users)

-- Step 1: Drop the problematic admin policy that uses FOR ALL
-- This policy might be blocking regular user inserts
DROP POLICY IF EXISTS "Admins can view and manage all users" ON users;

-- Step 2: Drop all existing INSERT policies
DROP POLICY IF EXISTS "Anyone can create user profile" ON users;
DROP POLICY IF EXISTS "Anyone can create bidder profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can create bidder profile" ON users;
DROP POLICY IF EXISTS "Admins can create business users" ON users;

-- Step 3: Create a simple, clear INSERT policy for regular users
-- This policy allows ANY authenticated user to insert their own profile
CREATE POLICY "Users can create own bidder profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    -- Role must be 'bidder' (explicitly set)
    AND role = 'bidder'
    -- The id in the row must match the authenticated user's ID
    AND id = auth.uid()
  );

-- Step 4: Create separate admin policies (not FOR ALL)
-- Admin SELECT policy
CREATE POLICY "Admins can select all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Admin UPDATE policy
CREATE POLICY "Admins can update all users"
  ON users
  FOR UPDATE
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

-- Admin DELETE policy
CREATE POLICY "Admins can delete all users"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Admin INSERT policy for business users
CREATE POLICY "Admins can create business users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
    AND role = 'business_user'
  );

-- Step 5: Verify the INSERT policy
SELECT 
  policyname,
  cmd,
  with_check,
  CASE 
    WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ Correct'
    WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ Missing WITH CHECK'
    ELSE 'ℹ️ Other'
  END as status
FROM pg_policies 
WHERE tablename = 'users' 
  AND schemaname = 'public'
  AND cmd = 'INSERT'
ORDER BY policyname;


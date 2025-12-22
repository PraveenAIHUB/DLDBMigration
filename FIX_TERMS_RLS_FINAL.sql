-- FINAL FIX for terms_and_conditions 406 error
-- This script will:
-- 1. Diagnose the current state
-- 2. Fix RLS policies
-- 3. Verify the fix
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- STEP 1: DIAGNOSE CURRENT STATE
-- ============================================

-- Check if table exists and RLS status
DO $$
DECLARE
  rls_enabled boolean;
  table_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'terms_and_conditions'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE 'ERROR: terms_and_conditions table does not exist!';
    RAISE NOTICE 'You need to run the migration that creates this table first.';
  ELSE
    SELECT rowsecurity INTO rls_enabled
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'terms_and_conditions';
    
    IF NOT rls_enabled THEN
      RAISE NOTICE 'WARNING: RLS is not enabled on terms_and_conditions table';
    ELSE
      RAISE NOTICE '✓ RLS is enabled on terms_and_conditions table';
    END IF;
  END IF;
END $$;

-- Show current policies
SELECT 
  'Current Policies:' as info,
  policyname,
  cmd as command,
  roles::text as roles,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_status
FROM pg_policies 
WHERE tablename = 'terms_and_conditions'
ORDER BY policyname;

-- ============================================
-- STEP 2: FIX RLS POLICIES
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS terms_and_conditions ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (clean slate)
DROP POLICY IF EXISTS "Anyone can view active terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Public can view active terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can manage terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can insert terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can update terms" ON terms_and_conditions;
DROP POLICY IF EXISTS "Admins can delete terms" ON terms_and_conditions;

-- Create SELECT policy for BOTH anonymous and authenticated users
-- This is CRITICAL - anonymous users need to see terms during registration
CREATE POLICY "Public can view active terms"
  ON terms_and_conditions FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Create separate admin policies (to avoid conflicts)
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

-- ============================================
-- STEP 3: VERIFY THE FIX
-- ============================================

-- Show new policies
SELECT 
  'New Policies:' as info,
  policyname,
  cmd as command,
  roles::text as roles
FROM pg_policies 
WHERE tablename = 'terms_and_conditions'
ORDER BY policyname;

-- Test query (simulate anonymous user)
-- This should return rows if the fix worked
DO $$
DECLARE
  row_count integer;
BEGIN
  -- Simulate anonymous access
  SET LOCAL ROLE anon;
  
  SELECT COUNT(*) INTO row_count
  FROM terms_and_conditions
  WHERE active = true;
  
  RESET ROLE;
  
  IF row_count > 0 THEN
    RAISE NOTICE '✓ SUCCESS: Anonymous users can now view % active term(s)', row_count;
  ELSE
    RAISE NOTICE '⚠ WARNING: No active terms found in the table';
    RAISE NOTICE 'The policy is correct, but you need to insert terms data.';
  END IF;
END $$;

-- Final verification
SELECT 
  'Verification Complete!' as status,
  COUNT(*) as total_policies,
  COUNT(*) FILTER (WHERE cmd = 'SELECT' AND 'anon' = ANY(roles)) as anon_select_policy
FROM pg_policies 
WHERE tablename = 'terms_and_conditions';


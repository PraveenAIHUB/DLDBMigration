-- ============================================
-- Diagnose RLS Policy Issue for Users Table
-- ============================================
-- Run this to see what's wrong with the policies

-- 1. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 2. List ALL policies on users table
SELECT 
  policyname,
  cmd as command,
  permissive,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- 3. Check for INSERT policies specifically
SELECT 
  policyname,
  cmd,
  with_check as with_check_clause,
  CASE 
    WHEN with_check IS NULL THEN '⚠️ MISSING WITH CHECK - This will cause INSERT to fail!'
    ELSE '✅ Has WITH CHECK clause'
  END as status
FROM pg_policies 
WHERE tablename = 'users' 
  AND schemaname = 'public'
  AND (cmd = 'INSERT' OR cmd = 'ALL')
ORDER BY policyname;

-- 4. Check current authenticated user context
SELECT 
  auth.uid() as current_user_id,
  auth.jwt()->>'email' as current_user_email;

-- 5. Test if admin policy is blocking (check if you're admin)
SELECT 
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE id = auth.uid()
  ) as is_admin;


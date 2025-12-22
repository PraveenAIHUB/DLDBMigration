-- ============================================
-- Check RLS Policies for Users Table
-- ============================================
-- Run this in Supabase SQL Editor to diagnose RLS issues

-- 1. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 2. List all policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname;

-- 3. Check for conflicting policies
-- Look for policies that might block INSERT operations
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'ALL' THEN '⚠️ This policy affects ALL operations (SELECT, INSERT, UPDATE, DELETE)'
    WHEN cmd = 'INSERT' THEN '✅ This is an INSERT policy'
    ELSE 'ℹ️ Other operation'
  END as policy_type,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'users' 
  AND schemaname = 'public'
  AND (cmd = 'ALL' OR cmd = 'INSERT')
ORDER BY cmd, policyname;

-- 4. Test if a user can insert (replace with actual user ID)
-- This will show what policies are being evaluated
SET ROLE authenticated;
EXPLAIN (ANALYZE, BUFFERS) 
INSERT INTO users (id, email, name, phone, role) 
VALUES (
  gen_random_uuid(),
  'test@example.com',
  'Test User',
  '+1234567890',
  'bidder'
);

-- 5. Check current authenticated user context
SELECT 
  auth.uid() as current_user_id,
  auth.jwt()->>'email' as current_user_email;


-- Diagnose terms_and_conditions RLS policies
-- Run this in Supabase SQL Editor to check current state

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'terms_and_conditions';

-- Check current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'terms_and_conditions'
ORDER BY policyname;

-- Check if table exists and has data
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE active = true) as active_rows
FROM terms_and_conditions;

-- Test query as anonymous user (simulate)
-- This will show what an anonymous user can see
SET ROLE anon;
SELECT content, active, created_at 
FROM terms_and_conditions 
WHERE active = true 
ORDER BY created_at DESC 
LIMIT 1;
RESET ROLE;


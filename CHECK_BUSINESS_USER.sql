-- ============================================
-- Check Business User by Email
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- Replace 'praveensftwr77@gmail.com' with the actual email you're checking

-- Check if business user exists (case-insensitive)
SELECT 
  id,
  email,
  name,
  phone,
  CASE 
    WHEN password_hash IS NULL THEN 'NO PASSWORD'
    WHEN password_hash = '' THEN 'EMPTY PASSWORD'
    ELSE 'HAS PASSWORD (' || LENGTH(password_hash) || ' chars)'
  END as password_status,
  created_at,
  created_by
FROM business_users
WHERE LOWER(TRIM(email)) = LOWER(TRIM('praveensftwr77@gmail.com'));

-- ============================================
-- Check ALL Business Users
-- ============================================
SELECT 
  id,
  email,
  LOWER(TRIM(email)) as normalized_email,
  name,
  CASE 
    WHEN password_hash IS NULL THEN 'NO PASSWORD'
    WHEN password_hash = '' THEN 'EMPTY PASSWORD'
    ELSE 'HAS PASSWORD'
  END as password_status,
  created_at
FROM business_users
ORDER BY created_at DESC;

-- ============================================
-- Find Business User with Similar Email
-- ============================================
-- This will find emails that are similar (in case of typos)
SELECT 
  id,
  email,
  name
FROM business_users
WHERE email ILIKE '%praveensftwr77%'
   OR email ILIKE '%praveensftwr%'
   OR email ILIKE '%gmail%';

-- ============================================
-- Fix Email if Found (Normalize)
-- ============================================
-- If the user exists but email has case/whitespace issues, normalize it
UPDATE business_users
SET email = LOWER(TRIM(email))
WHERE email != LOWER(TRIM(email));

-- ============================================
-- Create Business User (if doesn't exist)
-- ============================================
-- WARNING: Replace 'YOUR_ADMIN_ID' with actual admin user ID
-- Replace 'DEFAULT_PASSWORD' with a secure password
/*
INSERT INTO business_users (
  email,
  name,
  password_hash,
  created_by
) VALUES (
  LOWER(TRIM('praveensftwr77@gmail.com')),
  'Business User Name',
  'DEFAULT_PASSWORD',
  'YOUR_ADMIN_ID'::uuid
);
*/


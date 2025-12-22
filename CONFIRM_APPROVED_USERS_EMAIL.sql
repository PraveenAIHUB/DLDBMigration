-- Confirm email for all approved users in auth.users table
-- This fixes the issue where approved users still see email confirmation errors
-- Run this in Supabase SQL Editor
-- NOTE: This requires superuser access. If it doesn't work, use the Supabase Dashboard instead.

-- Create a function to confirm emails for approved users
CREATE OR REPLACE FUNCTION confirm_approved_users_email()
RETURNS TABLE(
  user_id uuid,
  email text,
  approved boolean,
  email_confirmed_at timestamptz,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update auth.users to confirm email for all users who are approved in public.users
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id IN (
    SELECT id 
    FROM public.users 
    WHERE approved = true
    AND id IN (SELECT id FROM auth.users)
  )
  AND email_confirmed_at IS NULL;

  -- Return verification results
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.approved,
    au.email_confirmed_at,
    CASE 
      WHEN au.email_confirmed_at IS NOT NULL THEN '✅ Email confirmed'::text
      ELSE '❌ Email not confirmed'::text
    END as status
  FROM public.users u
  LEFT JOIN auth.users au ON u.id = au.id
  WHERE u.approved = true
  ORDER BY u.email;
END;
$$;

-- Run the function
SELECT * FROM confirm_approved_users_email();

-- Alternative: If the function doesn't work due to permissions,
-- Use Supabase Dashboard → Authentication → Users
-- Find each approved user and manually confirm their email


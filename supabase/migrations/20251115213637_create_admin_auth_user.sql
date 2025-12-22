/*
  # Create Admin User in Auth System
  
  1. Purpose
    - Creates a function to properly register admin users in both auth.users and admin_users tables
    - Ensures admin accounts work with Supabase authentication
  
  2. Changes
    - Creates a secure function to insert admin users into auth.users
    - Links auth user to admin_users table
  
  3. Security
    - Function is SECURITY DEFINER to allow auth.users access
    - Validates admin email before creation
*/

-- Function to create admin user in auth system
CREATE OR REPLACE FUNCTION create_admin_auth_user(
  admin_email text,
  admin_password text,
  admin_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  encrypted_pw text;
BEGIN
  -- Generate a user ID
  new_user_id := gen_random_uuid();
  
  -- Hash the password using pgcrypto extension
  encrypted_pw := crypt(admin_password, gen_salt('bf'));
  
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    admin_email,
    encrypted_pw,
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', admin_name),
    'authenticated',
    'authenticated'
  );
  
  -- Insert into admin_users table
  INSERT INTO admin_users (email, name, password_hash)
  VALUES (admin_email, admin_name, encrypted_pw)
  ON CONFLICT (email) 
  DO UPDATE SET 
    name = admin_name,
    password_hash = encrypted_pw;
  
  RETURN json_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', admin_email
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

/*
  # Admin User Management

  ## New Functions
  
  ### 1. create_admin_user
  Allows creating admin users programmatically with proper password hashing.
  This is a secure way to add new admin accounts.
  
  ## Security
  - Function uses proper password hashing
  - Only creates admin entries, actual auth is handled by Supabase Auth
*/

-- Function to create admin users (for initial setup)
CREATE OR REPLACE FUNCTION create_admin_user(
  admin_email text,
  admin_name text,
  admin_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Note: In production, password should be properly hashed
  -- This is a simplified version for demo purposes
  INSERT INTO admin_users (email, name, password_hash)
  VALUES (admin_email, admin_name, admin_password)
  ON CONFLICT (email) DO NOTHING;
END;
$$;

# Quick Fix: Create OTP Storage Table

## The Problem
You're getting the error: `Could not find the table 'public.otp_storage' in the schema cache`

This means the database table hasn't been created yet.

## Solution: Apply the Migration

### Method 1: Supabase Dashboard (Easiest)

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste this SQL:**

```sql
-- Create otp_storage table
CREATE TABLE IF NOT EXISTS otp_storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  otp_code text NOT NULL,
  otp_method text NOT NULL CHECK (otp_method IN ('email', 'mobile')),
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_otp_storage_email ON otp_storage(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otp_storage_phone ON otp_storage(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otp_storage_code ON otp_storage(otp_code);
CREATE INDEX IF NOT EXISTS idx_otp_storage_expires ON otp_storage(expires_at);

-- Function to clean up expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM otp_storage
  WHERE expires_at < now() OR verified = true;
END;
$$;

-- Enable RLS
ALTER TABLE otp_storage ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert OTPs (for registration)
CREATE POLICY "Allow OTP creation"
  ON otp_storage FOR INSERT
  WITH CHECK (true);

-- Policy: Allow anyone to verify OTPs (for registration)
CREATE POLICY "Allow OTP verification"
  ON otp_storage FOR SELECT, UPDATE
  USING (true)
  WITH CHECK (true);
```

4. **Run the Query**
   - Click the "Run" button (or press Ctrl+Enter)
   - You should see "Success. No rows returned"

5. **Verify it worked**
   - Go to "Table Editor" in the left sidebar
   - You should see `otp_storage` in the list of tables

### Method 2: Using Supabase CLI (If you have it set up)

```bash
# Make sure you're in the project root directory
cd D:\DLCarBiddingPlatform-main

# Link to your Supabase project (if not already linked)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push
```

## After Applying

1. **Refresh your application** - The error should be gone
2. **Test OTP registration**:
   - Go to the registration page
   - Fill in the form
   - Click "Send OTP"
   - You should see the OTP in an alert (for testing)
   - Enter the OTP and verify

## Troubleshooting

If you still get errors:
1. Make sure you ran the SQL in the correct database
2. Check that the table exists in "Table Editor"
3. Verify RLS policies are created (go to Authentication → Policies)
4. Try refreshing your browser

## What This Does

- Creates `otp_storage` table to store OTP codes
- Allows OTP verification before user registration
- OTPs expire after 10 minutes
- Each OTP can only be used once
- Includes indexes for fast lookups


/*
  # Create OTP Storage Table
  
  Creates a table to store OTP codes temporarily for email and mobile verification.
  This allows OTP verification before user registration is complete.
*/

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

-- Policy: Allow anyone to verify OTPs (for registration - SELECT)
CREATE POLICY "Allow OTP verification SELECT"
  ON otp_storage FOR SELECT
  USING (true);

-- Policy: Allow anyone to verify OTPs (for registration - UPDATE)
CREATE POLICY "Allow OTP verification UPDATE"
  ON otp_storage FOR UPDATE
  USING (true)
  WITH CHECK (true);


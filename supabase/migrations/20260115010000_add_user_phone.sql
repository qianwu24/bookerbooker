-- Add phone number to users table for SMS notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create index for phone lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

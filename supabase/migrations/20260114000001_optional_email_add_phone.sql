-- Migration: Make email optional and add phone support for invitees
-- Either email OR phone is required (enforced via CHECK constraint)

-- Step 1: Add phone column to invitees
ALTER TABLE invitees ADD COLUMN IF NOT EXISTS phone TEXT;

-- Step 2: Make email nullable
ALTER TABLE invitees ALTER COLUMN email DROP NOT NULL;

-- Step 3: Drop the old unique constraint on (event_id, email)
ALTER TABLE invitees DROP CONSTRAINT IF EXISTS invitees_event_id_email_key;

-- Step 4: Create a new unique constraint that handles NULL emails
-- We use a partial unique index for email (when not null) and phone (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitees_event_email_unique 
  ON invitees(event_id, email) 
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitees_event_phone_unique 
  ON invitees(event_id, phone) 
  WHERE phone IS NOT NULL;

-- Step 5: Add CHECK constraint to ensure at least email or phone is provided
ALTER TABLE invitees ADD CONSTRAINT invitees_email_or_phone_required 
  CHECK (email IS NOT NULL OR phone IS NOT NULL);

-- Step 6: Add index on phone for lookups
CREATE INDEX IF NOT EXISTS idx_invitees_phone ON invitees(phone) WHERE phone IS NOT NULL;

-- Step 7: Update RLS policies to also check by phone for invitees
-- Drop existing policy first
DROP POLICY IF EXISTS "Invitees can view their own invitations" ON invitees;

-- Recreate with phone support
CREATE POLICY "Invitees can view their own invitations"
  ON invitees FOR SELECT
  USING (
    email = (SELECT email FROM users WHERE id = auth.uid())
    OR phone = (SELECT phone FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Invitees can update their own status" ON invitees;

CREATE POLICY "Invitees can update their own status"
  ON invitees FOR UPDATE
  USING (
    email = (SELECT email FROM users WHERE id = auth.uid())
    OR phone = (SELECT phone FROM users WHERE id = auth.uid())
  );

-- Step 8: Also update events RLS policy for phone-based invitees
DROP POLICY IF EXISTS "Users can view events they are invited to" ON events;

CREATE POLICY "Users can view events they are invited to"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invitees 
      WHERE invitees.event_id = events.id 
      AND (
        invitees.email = (SELECT email FROM users WHERE id = auth.uid())
        OR invitees.phone = (SELECT phone FROM users WHERE id = auth.uid())
      )
    )
  );

-- Step 9: Add phone column to users table (optional, for phone-based auth later)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone) WHERE phone IS NOT NULL;

-- Step 10: Add phone to contacts table if not already present
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone TEXT;

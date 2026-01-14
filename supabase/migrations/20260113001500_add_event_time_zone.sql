-- Add optional time zone to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS time_zone TEXT;

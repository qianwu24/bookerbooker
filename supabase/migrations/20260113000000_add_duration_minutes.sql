-- Add duration_minutes column to events for invitation duration metadata
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

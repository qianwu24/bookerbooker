-- Add spots column to events table
-- Default is 1 (single spot, like tennis singles)
-- When spots are filled, further accepts are rejected

ALTER TABLE events
ADD COLUMN IF NOT EXISTS spots INTEGER NOT NULL DEFAULT 1;

-- Add constraint to ensure spots is at least 1
ALTER TABLE events
ADD CONSTRAINT events_spots_positive CHECK (spots >= 1);

-- Add index for events with unfilled spots (for queries)
CREATE INDEX IF NOT EXISTS idx_events_spots ON events(spots);

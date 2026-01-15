-- Force schema cache refresh by making a trivial DDL change
-- This migration exists solely to trigger PostgREST schema reload

-- Add a comment to the event_invitees table
COMMENT ON TABLE public.event_invitees IS 'Links events to contacts (invitees). Updated 2026-01-14.';

-- Verify foreign key exists (this will fail if it doesn't, helping us debug)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'event_invitees_contact_id_fkey'
    AND table_name = 'event_invitees'
  ) THEN
    -- If FK doesn't exist, create it
    ALTER TABLE public.event_invitees 
    ADD CONSTRAINT event_invitees_contact_id_fkey 
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;
    RAISE NOTICE 'Created missing foreign key constraint';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

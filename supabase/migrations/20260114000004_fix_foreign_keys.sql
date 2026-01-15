-- Fix migration: Restore foreign key and constraints after contacts table recreation

-- 1) Recreate foreign key from event_invitees to contacts
-- First, clean up any orphaned event_invitees that reference non-existent contacts
DELETE FROM public.event_invitees 
WHERE contact_id NOT IN (SELECT id FROM public.contacts);

-- Add back the foreign key constraint
ALTER TABLE public.event_invitees 
DROP CONSTRAINT IF EXISTS event_invitees_contact_id_fkey;

ALTER TABLE public.event_invitees 
ADD CONSTRAINT event_invitees_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

-- 2) Ensure unique constraints exist on contacts for upsert operations
-- These should have been created but let's make sure
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_owner_email_unique 
  ON public.contacts(owner_id, email) 
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_owner_phone_unique 
  ON public.contacts(owner_id, phone) 
  WHERE phone IS NOT NULL;

-- 3) Recreate RLS policy for events that was dropped with invitees table
DROP POLICY IF EXISTS "Users can view events they are invited to" ON public.events;

CREATE POLICY "Users can view events they are invited to"
  ON public.events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_invitees ei
      JOIN public.contacts c ON c.id = ei.contact_id
      WHERE ei.event_id = events.id 
      AND (
        c.email = (SELECT email FROM public.users WHERE id = auth.uid())
        OR c.phone = (SELECT phone FROM public.users WHERE id = auth.uid())
      )
    )
  );

-- 4) Refresh PostgREST schema cache (this happens automatically on deploy)
NOTIFY pgrst, 'reload schema';

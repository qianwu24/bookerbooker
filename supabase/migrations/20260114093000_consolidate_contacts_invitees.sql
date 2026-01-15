-- Consolidate contacts and invitees: add contact id, create event_invitees link table, backfill.

BEGIN;

-- 1) Add surrogate primary key to contacts; keep unique per owner/email.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
UPDATE public.contacts SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_pkey;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.contacts ADD CONSTRAINT contacts_owner_email_key UNIQUE (owner_id, email);

-- 2) event_invitees table linking events to contacts
CREATE TABLE IF NOT EXISTS public.event_invitees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','invited','accepted','declined')),
  priority integer DEFAULT 0,
  invited_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  role text DEFAULT 'guest',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, contact_id)
);

-- Timestamps helper
CREATE OR REPLACE FUNCTION public.set_event_invitee_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_event_invitee_timestamp ON public.event_invitees;
CREATE TRIGGER set_event_invitee_timestamp
  BEFORE UPDATE ON public.event_invitees
  FOR EACH ROW EXECUTE FUNCTION public.set_event_invitee_timestamp();

-- 3) Backfill contacts and event_invitees from legacy invitees
-- Upsert contacts per owner/email
INSERT INTO public.contacts (id, owner_id, email, name, phone)
SELECT DISTINCT gen_random_uuid(), e.organizer_id, i.email, i.name, NULL
FROM public.invitees i
JOIN public.events e ON e.id = i.event_id
ON CONFLICT (owner_id, email) DO NOTHING;

-- Link events to contacts
INSERT INTO public.event_invitees (event_id, contact_id, status, priority, invited_at, responded_at, role)
SELECT
  i.event_id,
  c.id,
  i.status,
  i.priority,
  COALESCE(i.created_at, now()),
  CASE WHEN i.status IN ('accepted','declined') THEN i.updated_at ELSE NULL END,
  'guest'
FROM public.invitees i
JOIN public.events e ON e.id = i.event_id
JOIN public.contacts c ON c.owner_id = e.organizer_id AND c.email = i.email
ON CONFLICT (event_id, contact_id) DO NOTHING;

-- 4) RLS for event_invitees
ALTER TABLE public.event_invitees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "EventInvitees: organizer view" ON public.event_invitees;
DROP POLICY IF EXISTS "EventInvitees: invitee view" ON public.event_invitees;
DROP POLICY IF EXISTS "EventInvitees: organizer insert" ON public.event_invitees;
DROP POLICY IF EXISTS "EventInvitees: organizer update" ON public.event_invitees;
DROP POLICY IF EXISTS "EventInvitees: invitee self update" ON public.event_invitees;
DROP POLICY IF EXISTS "EventInvitees: organizer delete" ON public.event_invitees;

-- Organizers can view invitees of their events
CREATE POLICY "EventInvitees: organizer view" ON public.event_invitees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_invitees.event_id
        AND e.organizer_id = auth.uid()
    )
  );

-- Invitees can view their own invitation
CREATE POLICY "EventInvitees: invitee view" ON public.event_invitees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      JOIN public.users u ON u.id = auth.uid()
      WHERE c.id = event_invitees.contact_id
        AND c.email = u.email
    )
  );

-- Organizers can insert invitees for their events (and matching contact owner)
CREATE POLICY "EventInvitees: organizer insert" ON public.event_invitees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.contacts c ON c.id = event_invitees.contact_id
      WHERE e.id = event_invitees.event_id
        AND e.organizer_id = auth.uid()
        AND c.owner_id = e.organizer_id
    )
  );

-- Organizers can update invitees of their events
CREATE POLICY "EventInvitees: organizer update" ON public.event_invitees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_invitees.event_id
        AND e.organizer_id = auth.uid()
    )
  );

-- Invitees can update their own status
CREATE POLICY "EventInvitees: invitee self update" ON public.event_invitees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      JOIN public.users u ON u.id = auth.uid()
      WHERE c.id = event_invitees.contact_id
        AND c.email = u.email
    )
  );

-- Organizers can delete invitees of their events
CREATE POLICY "EventInvitees: organizer delete" ON public.event_invitees
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_invitees.event_id
        AND e.organizer_id = auth.uid()
    )
  );

COMMIT;

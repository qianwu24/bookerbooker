-- Fix RLS infinite recursion on event_invitees and events
-- The policies were causing circular references between tables

BEGIN;

-- 1. Create a security definer function to check event ownership without RLS
CREATE OR REPLACE FUNCTION public.is_event_organizer(event_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = event_uuid AND organizer_id = auth.uid()
  );
$$;

-- 2. Fix event_invitees policies to use the function instead of querying events
DROP POLICY IF EXISTS "EventInvitees: invitee view" ON public.event_invitees;
DROP POLICY IF EXISTS "EventInvitees: invitee self update" ON public.event_invitees;
DROP POLICY IF EXISTS "EventInvitees: organizer view" ON public.event_invitees;
DROP POLICY IF EXISTS "EventInvitees: organizer update" ON public.event_invitees;
DROP POLICY IF EXISTS "EventInvitees: organizer delete" ON public.event_invitees;

CREATE POLICY "EventInvitees: organizer view" ON public.event_invitees
  FOR SELECT USING (public.is_event_organizer(event_id));

CREATE POLICY "EventInvitees: organizer update" ON public.event_invitees
  FOR UPDATE USING (public.is_event_organizer(event_id));

CREATE POLICY "EventInvitees: organizer delete" ON public.event_invitees
  FOR DELETE USING (public.is_event_organizer(event_id));

-- Policy for contact owners to see invitations for their contacts
DROP POLICY IF EXISTS "EventInvitees: contact owner view" ON public.event_invitees;
CREATE POLICY "EventInvitees: contact owner view" ON public.event_invitees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = event_invitees.contact_id
        AND c.owner_id = auth.uid()
    )
  );

-- Policy for invitees to update their own status (uses JWT instead of users table)
DROP POLICY IF EXISTS "EventInvitees: invitee self update v2" ON public.event_invitees;
CREATE POLICY "EventInvitees: invitee self update v2" ON public.event_invitees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = event_invitees.contact_id
        AND c.email = auth.jwt()->>'email'
    )
  );

-- 3. Fix events policy to use JWT instead of querying users table
DROP POLICY IF EXISTS "Users can view events they are invited to" ON public.events;
CREATE POLICY "Users can view events they are invited to" ON public.events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM event_invitees ei
      JOIN contacts c ON c.id = ei.contact_id
      WHERE ei.event_id = events.id
        AND (c.email = auth.jwt()->>'email' OR c.phone = auth.jwt()->>'phone')
    )
  );

COMMIT;

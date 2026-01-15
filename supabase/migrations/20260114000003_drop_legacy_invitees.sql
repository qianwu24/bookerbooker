-- Migration: Drop legacy invitees table
-- The invitees table has been replaced by event_invitees + contacts
-- Data was already migrated in 20260114093000_consolidate_contacts_invitees.sql

-- Drop the legacy invitees table and its indexes
DROP TABLE IF EXISTS public.invitees CASCADE;

-- Clean up any orphaned indexes (in case they weren't dropped with CASCADE)
DROP INDEX IF EXISTS idx_invitees_email;
DROP INDEX IF EXISTS idx_invitees_event;
DROP INDEX IF EXISTS idx_invitees_status;

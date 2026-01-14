-- Add invite mode and auto-promote interval to events
alter table events add column if not exists invite_mode text default 'priority';
alter table events add column if not exists auto_promote_after_minutes integer default 30;

-- Track when an invitee was invited (for timeout-based promotion)
alter table invitees add column if not exists invited_at timestamptz default now();

-- Backfill invited_at for existing records
update invitees set invited_at = coalesce(invited_at, updated_at, created_at, now()) where invited_at is null;

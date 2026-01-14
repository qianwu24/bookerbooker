# Technical Decisions Log

## Architecture & Backend
- Chose Supabase Edge Function (Hono/Deno) for invite/RVSP/email flow; uses service role Supabase client.
- Email delivery via Resend with inline HTML and ICS attachments; templates kept alongside edge function.
- RSVP uses signed tokens (HMAC) with `/rsvp` endpoint updating invitee status and sending confirmations.
- ICS generation added for creator and invitees (including promoted invitees and confirmations).
- Priority vs FCFS: events store `invite_mode`; priority invites only the first initially, FCFS invites all immediately.
- Auto-promote: default 30 minutes (`auto_promote_after_minutes`); decline path promotes next pending; cron endpoint `/make-server-37f8437f/cron/auto-promote` expires stale invites and promotes next pending with email + ICS.

## Data Model & Migrations
- Base tables: users, events, invitees (priority/status), contacts; RLS policies per owner/organizer/invitee.
- Added columns: events.invite_mode, events.auto_promote_after_minutes, invitees.invited_at (for timeouts), events.duration_minutes, events.time_zone.
- Migrations applied to cloud project `umxycfmyuilnzgawtstd`; duplicate migration timestamp fixed by renaming to `20260111010000_auto_promote_invited_at.sql` and making contacts policies idempotent.

## Frontend
- Event creation form includes duration selector and timezone; `durationMinutes` and `timeZone` flow through payload; dashboard normalizes both.
- Invite modes reflected in form; validation enforces future date/time, duration > 0, and invitees present.
- Priority mode temporarily disabled in UI and marked "Coming soon"; only First-Come-First-Serve can be selected (default).
- Calendar invites now always send to both organizer and invitees (UI toggles removed).
- SMS notifications hidden for MVP: UI removed and payload forces `notifyByPhone` to false.
- Event form tweaks: default title "Tennis Match", emoji picker added, cached location dropdown with manual entry fallback.
- Settings view added with timezone selector (auto-detected per browser) and accessible from dashboard gear.
- Favicon/tab icon now uses the inline Booker logo (exported to `/booker-logo.svg`) linked in `index.html`.

## Operational Choices
- Selected Option 1 (scheduled sweep) for auto-promotion rather than per-event timers or client polling.
- Deployments via `supabase functions deploy make-server-37f8437f --project-ref umxycfmyuilnzgawtstd`.
- Docker not required for cloud deploy; only needed for local Supabase stack/emulation.

## Emails & Edge Function
- Edge function now stores and returns `duration_minutes` and `time_zone` and includes both in outgoing emails/ICS.
- Invitee inserts use upsert (primary key on email) with name updates to avoid duplicates.
- Auth validation uses bearer JWT and short-circuits unauthorized requests early.

## Environment Variables
- Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL, APP_BASE_URL, RSVP_SECRET.
- Optional: GOOGLE_CLIENT_SECRET (warning if unset), RESEND_TEMPLATE_ID (kept but inline HTML used).

## Open/Follow-ups
- Ensure function env vars set in Supabase dashboard.
- If using auto-promote, create a schedule (e.g., every 10 minutes) hitting `/make-server-37f8437f/cron/auto-promote`.
- Consider adding reminders before auto-decline and observability logs/metrics.

## TODO
- Update Google OAuth app to show "continue to bookerbooker.com" (set App name/domain, authorized domain, and replace client ID/secret in Supabase Google provider).

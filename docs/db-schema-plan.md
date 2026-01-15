# DB Schema Consolidation Plan

## Goal
Use `contacts` as the single people source and link them to events via a join table, avoiding duplicated invitee blobs.

## Tables

### contacts
- id: uuid primary key
- owner_id: uuid not null (fk users.id)
- email: text not null
- name: text
- phone: text
- created_at: timestamptz default now()
- updated_at: timestamptz default now()
- unique: (owner_id, email)

### event_invitees (new)
- id: uuid primary key
- event_id: uuid not null (fk events.id)
- contact_id: uuid not null (fk contacts.id)
- status: text check in ('invited','pending','accepted','declined')
- priority: integer
- invited_at: timestamptz default now()
- responded_at: timestamptz
- role: text default 'guest' (optional, for organizer/guest split)
- unique: (event_id, contact_id)
- constraint: contact.owner_id must match event.organizer_id (enforce via fk or trigger)

### events (unchanged schema)
- Keep current fields (title, date, time, location, invite_mode, etc.)
- Stop storing invitee blobs once backfill is done (or keep as legacy, ignored).

## Backfill plan
1) Add `id` to contacts and unique (owner_id, email) if not present.
2) Create event_invitees.
3) For each event, upsert its invitees into contacts (owner_id + email), then insert event_invitees rows pointing to those contacts, copying status/priority/invited_at.
4) Verify counts match; optionally null out/remove legacy invitee blobs in events.

## API changes
- Reads: return invitees by joining events -> event_invitees -> contacts; optionally expose a view `event_with_invitees`.
- Writes: on create/update event, upsert contacts per (owner_id,email) and populate event_invitees. Do not write invitee blobs into events.

## Frontend changes
- No payload change needed if backend still accepts `invitees`; backend handles contact upsert + link creation.
- Contact list pulls from contacts; invitee status per event comes from event_invitees.

## Safeguards
- RLS: contacts scoped by owner_id; event_invitees scoped so users see only events they own and contacts they own.
- Constraints: unique (owner_id,email) on contacts; unique (event_id,contact_id) on event_invitees; check status values.

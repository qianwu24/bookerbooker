-- Allow same contact email across different owners by making PK composite
BEGIN;

-- Drop existing primary key on email
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_pkey;

-- Add composite primary key on (owner_id, email)
ALTER TABLE public.contacts ADD CONSTRAINT contacts_pkey PRIMARY KEY (owner_id, email);

-- Ensure we still have an index to filter by owner (PK already covers, but keep explicitly)
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts(owner_id);

COMMIT;

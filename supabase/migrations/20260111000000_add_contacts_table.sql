-- Contacts table scoped by owner with email as primary key
CREATE TABLE IF NOT EXISTS public.contacts (
  email TEXT PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_contact_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_contact_timestamp ON public.contacts;
CREATE TRIGGER set_contact_timestamp
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_contact_timestamp();

-- Index for owner lookups
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts(owner_id);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Policies: owner-only access (drop first to make migration idempotent)
DROP POLICY IF EXISTS "Contacts: owners can select" ON public.contacts;
DROP POLICY IF EXISTS "Contacts: owners can insert" ON public.contacts;
DROP POLICY IF EXISTS "Contacts: owners can update" ON public.contacts;
DROP POLICY IF EXISTS "Contacts: owners can delete" ON public.contacts;

CREATE POLICY "Contacts: owners can select" ON public.contacts
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Contacts: owners can insert" ON public.contacts
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Contacts: owners can update" ON public.contacts
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Contacts: owners can delete" ON public.contacts
  FOR DELETE USING (owner_id = auth.uid());

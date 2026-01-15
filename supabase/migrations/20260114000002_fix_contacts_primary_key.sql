-- Migration: Fix contacts table to support phone-only contacts
-- Change primary key from email to UUID, make email optional

-- Step 1: Create new contacts table with proper structure
CREATE TABLE IF NOT EXISTS public.contacts_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT,  -- Now optional
  name TEXT NOT NULL,
  phone TEXT,  -- Optional
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure at least email or phone is provided
  CONSTRAINT contacts_email_or_phone_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Step 2: Migrate existing data
INSERT INTO public.contacts_new (owner_id, email, name, phone, created_at, updated_at)
SELECT owner_id, email, COALESCE(name, email), phone, created_at, updated_at
FROM public.contacts
ON CONFLICT DO NOTHING;

-- Step 3: Drop old table and rename new one
DROP TABLE IF EXISTS public.contacts CASCADE;
ALTER TABLE public.contacts_new RENAME TO contacts;

-- Step 4: Create unique indexes per owner (partial indexes for nullable columns)
CREATE UNIQUE INDEX idx_contacts_owner_email_unique 
  ON public.contacts(owner_id, email) 
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX idx_contacts_owner_phone_unique 
  ON public.contacts(owner_id, phone) 
  WHERE phone IS NOT NULL;

-- Step 5: Create indexes for common queries
CREATE INDEX idx_contacts_owner ON public.contacts(owner_id);
CREATE INDEX idx_contacts_email ON public.contacts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_phone ON public.contacts(phone) WHERE phone IS NOT NULL;

-- Step 6: Keep updated_at fresh
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

-- Step 7: Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Step 8: Recreate RLS policies
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

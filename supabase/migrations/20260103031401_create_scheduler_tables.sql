-- Create users table (synced from Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT,
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create invitees table (junction table with priority queue)
CREATE TABLE IF NOT EXISTS invitees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'invited', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, email)
);

-- Create indexes for common queries
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_invitees_email ON invitees(email);
CREATE INDEX idx_invitees_event ON invitees(event_id);
CREATE INDEX idx_invitees_status ON invitees(status);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for events table
CREATE POLICY "Users can view events they organize"
  ON events FOR SELECT
  USING (auth.uid() = organizer_id);

CREATE POLICY "Users can view events they are invited to"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invitees 
      WHERE invitees.event_id = events.id 
      AND invitees.email = (SELECT email FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can create events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Users can update their own events"
  ON events FOR UPDATE
  USING (auth.uid() = organizer_id);

CREATE POLICY "Users can delete their own events"
  ON events FOR DELETE
  USING (auth.uid() = organizer_id);

-- RLS Policies for invitees table
CREATE POLICY "Organizers can view invitees of their events"
  ON invitees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = invitees.event_id 
      AND events.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Invitees can view their own invitations"
  ON invitees FOR SELECT
  USING (email = (SELECT email FROM users WHERE id = auth.uid()));

CREATE POLICY "Organizers can add invitees to their events"
  ON invitees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = invitees.event_id 
      AND events.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can update invitees of their events"
  ON invitees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = invitees.event_id 
      AND events.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Invitees can update their own status"
  ON invitees FOR UPDATE
  USING (email = (SELECT email FROM users WHERE id = auth.uid()));

CREATE POLICY "Organizers can delete invitees from their events"
  ON invitees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = invitees.event_id 
      AND events.organizer_id = auth.uid()
    )
  );

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call function on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also handle updates (e.g., when user updates their profile)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

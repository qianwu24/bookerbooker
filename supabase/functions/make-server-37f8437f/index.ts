import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper to create Supabase client with service role (for admin operations)
const getServiceClient = () => createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL');

type InviteePayload = {
  email: string;
  name?: string;
};

const sendInviteEmail = async (
  invitee: InviteePayload,
  event: { title: string; date: string; time: string; location?: string; organizerName?: string },
) => {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.log('Email not sent: RESEND_API_KEY or RESEND_FROM_EMAIL not configured');
    return;
  }

  try {
    const subject = `You're invited: ${event.title}`;
    const bodyText = `Hi ${invitee.name || invitee.email},\n\nYou're invited to "${event.title}".\nDate: ${event.date}\nTime: ${event.time}\nLocation: ${event.location || 'TBD'}\nOrganizer: ${event.organizerName || 'Organizer'}\n\nPlease respond at your earliest convenience.`;
    const bodyHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;">
        <h2>You're invited: ${event.title}</h2>
        <p>Hi ${invitee.name || invitee.email},</p>
        <p>You're invited to <strong>${event.title}</strong>.</p>
        <ul>
          <li><strong>Date:</strong> ${event.date}</li>
          <li><strong>Time:</strong> ${event.time}</li>
          <li><strong>Location:</strong> ${event.location || 'TBD'}</li>
          <li><strong>Organizer:</strong> ${event.organizerName || 'Organizer'}</li>
        </ul>
        <p>Please respond at your earliest convenience.</p>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [invitee.email],
        subject,
        text: bodyText,
        html: bodyHtml,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log('Resend email failed:', errText);
    }
  } catch (error) {
    console.log('Error sending invite email:', error);
  }
};

// Helper function to get authenticated user
async function getAuthenticatedUser(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Missing or invalid Authorization header');
    return null;
  }
  
  const accessToken = authHeader.split(' ')[1];
  const supabase = getServiceClient();
  
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    console.log('Authentication error:', error?.message);
    return null;
  }
  
  console.log('User authenticated:', user.email);
  return { user, accessToken };
}

// Health check endpoint
app.get("/make-server-37f8437f/health", (c) => {
  return c.json({ status: "ok" });
});

// Sign up endpoint - creates user in auth and profile
app.post("/make-server-37f8437f/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    const supabase = getServiceClient();
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: true
    });
    
    if (error) {
      console.log('Error creating user:', error);
      return c.json({ error: error.message }, 400);
    }
    
    return c.json({ success: true, user: data.user });
  } catch (error) {
    console.log('Unexpected error during signup:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create event endpoint
app.post("/make-server-37f8437f/events", async (c) => {
  try {
    const auth = await getAuthenticatedUser(c.req.header('Authorization'));
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const { user } = auth;
    const eventData = await c.req.json();
    const supabase = getServiceClient();
    
    // Ensure user exists in users table
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
    }, { onConflict: 'id' });
    
    // Create the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: eventData.title,
        description: eventData.description,
        date: eventData.date,
        time: eventData.time,
        location: eventData.location,
        organizer_id: user.id,
      })
      .select()
      .single();
    
    if (eventError) {
      console.log('Error creating event:', eventError);
      return c.json({ error: eventError.message }, 400);
    }
    
    // Add invitees
    const invitedNow: any[] = [];
    if (eventData.invitees && eventData.invitees.length > 0) {
      const inviteesData = eventData.invitees.map((invitee: any, index: number) => ({
        event_id: event.id,
        email: invitee.email,
        name: invitee.name,
        priority: invitee.priority ?? index,
        status: index === 0 ? 'invited' : 'pending', // First person gets invited
      }));
      
      const { error: inviteesError } = await supabase
        .from('invitees')
        .insert(inviteesData);
      
      if (inviteesError) {
        console.log('Error adding invitees:', inviteesError);
        // Don't fail the whole request, event was created
      } else {
        invitedNow.push(...inviteesData.filter((i) => i.status === 'invited'));
      }
    }
    
    // Fetch the complete event with invitees
    const { data: fullEvent } = await supabase
      .from('events')
      .select(`
        *,
        organizer:users!events_organizer_id_fkey(id, email, name, avatar_url),
        invitees(*)
      `)
      .eq('id', event.id)
      .single();
    
    // Transform to match frontend expected format
    const responseEvent = {
      id: fullEvent.id,
      title: fullEvent.title,
      description: fullEvent.description,
      date: fullEvent.date,
      time: fullEvent.time,
      location: fullEvent.location,
      organizer: {
        email: fullEvent.organizer.email,
        name: fullEvent.organizer.name,
      },
      invitees: fullEvent.invitees.map((inv: any) => ({
        email: inv.email,
        name: inv.name,
        priority: inv.priority,
        status: inv.status,
      })),
      createdAt: fullEvent.created_at,
    };

    // Send emails to invitees who are invited now
    if (invitedNow.length > 0) {
      const mailPayload = {
        title: responseEvent.title,
        date: responseEvent.date,
        time: responseEvent.time,
        location: responseEvent.location,
        organizerName: responseEvent.organizer.name,
      };
      for (const inv of invitedNow) {
        sendInviteEmail({ email: inv.email, name: inv.name }, mailPayload);
      }
    }
    
    return c.json({ success: true, event: responseEvent });
  } catch (error) {
    console.log('Error creating event:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all events for a user (organized + invited)
app.get("/make-server-37f8437f/events", async (c) => {
  try {
    const auth = await getAuthenticatedUser(c.req.header('Authorization'));
    if (!auth) {
      return c.json({ code: 401, message: 'Invalid JWT' }, 401);
    }
    
    const { user } = auth;
    const supabase = getServiceClient();
    
    // Get events organized by user
    const { data: organizedEvents, error: orgError } = await supabase
      .from('events')
      .select(`
        *,
        organizer:users!events_organizer_id_fkey(id, email, name, avatar_url),
        invitees(*)
      `)
      .eq('organizer_id', user.id);
    
    if (orgError) {
      console.log('Error fetching organized events:', orgError);
    }
    
    // Get event IDs where user is invited
    const { data: invitedEventIds } = await supabase
      .from('invitees')
      .select('event_id')
      .eq('email', user.email);
    
    let invitedEvents: any[] = [];
    if (invitedEventIds && invitedEventIds.length > 0) {
      const ids = invitedEventIds.map(i => i.event_id);
      const { data } = await supabase
        .from('events')
        .select(`
          *,
          organizer:users!events_organizer_id_fkey(id, email, name, avatar_url),
          invitees(*)
        `)
        .in('id', ids)
        .neq('organizer_id', user.id);
      
      invitedEvents = data || [];
    }
    
    // Combine and dedupe events
    const allEvents = [...(organizedEvents || []), ...invitedEvents];
    const uniqueEvents = Array.from(new Map(allEvents.map(e => [e.id, e])).values());
    
    // Transform to match frontend expected format
    const events = uniqueEvents.map((event: any) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      organizer: {
        email: event.organizer.email,
        name: event.organizer.name,
      },
      invitees: (event.invitees || []).map((inv: any) => ({
        email: inv.email,
        name: inv.name,
        priority: inv.priority,
        status: inv.status,
      })),
      createdAt: event.created_at,
    }));
    
    console.log(`Returning ${events.length} events`);
    return c.json({ events });
  } catch (error) {
    console.log('Error fetching events:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update invitee status
app.put("/make-server-37f8437f/events/:eventId/invitees/:inviteeEmail/status", async (c) => {
  try {
    const auth = await getAuthenticatedUser(c.req.header('Authorization'));
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const { user } = auth;
    const eventId = c.req.param('eventId');
    const inviteeEmail = decodeURIComponent(c.req.param('inviteeEmail'));
    const { status } = await c.req.json();
    
    const supabase = getServiceClient();
    
    // Verify user is the invitee
    if (inviteeEmail !== user.email) {
      return c.json({ error: 'Unauthorized - not the invitee' }, 403);
    }
    
    // Get the invitee record
    const { data: invitee, error: inviteeError } = await supabase
      .from('invitees')
      .select('*')
      .eq('event_id', eventId)
      .eq('email', inviteeEmail)
      .single();
    
    if (inviteeError || !invitee) {
      return c.json({ error: 'Invitee not found' }, 404);
    }
    
    // Update the invitee status
    const { error: updateError } = await supabase
      .from('invitees')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('email', inviteeEmail);
    
    if (updateError) {
      console.log('Error updating invitee status:', updateError);
      return c.json({ error: updateError.message }, 400);
    }
    
    // If declined, invite the next person in queue
    if (status === 'declined') {
      // Find next pending invitee with higher priority number (lower priority)
      const { data: nextInvitee } = await supabase
        .from('invitees')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'pending')
        .gt('priority', invitee.priority)
        .order('priority', { ascending: true })
        .limit(1)
        .single();
      
      if (nextInvitee) {
        await supabase
          .from('invitees')
          .update({ status: 'invited', updated_at: new Date().toISOString() })
          .eq('id', nextInvitee.id);

        // Send invite to the promoted invitee
        sendInviteEmail(
          { email: nextInvitee.email, name: nextInvitee.name },
          {
            title: event?.title || 'Event Invitation',
            date: event?.date || '',
            time: event?.time || '',
            location: event?.location,
            organizerName: event?.organizer?.name,
          },
        );
      }
    }
    
    // Fetch the updated event
    const { data: event } = await supabase
      .from('events')
      .select(`
        *,
        organizer:users!events_organizer_id_fkey(id, email, name, avatar_url),
        invitees(*)
      `)
      .eq('id', eventId)
      .single();
    
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }
    
    // Transform to match frontend expected format
    const responseEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      organizer: {
        email: event.organizer.email,
        name: event.organizer.name,
      },
      invitees: event.invitees.map((inv: any) => ({
        email: inv.email,
        name: inv.name,
        priority: inv.priority,
        status: inv.status,
      })),
      createdAt: event.created_at,
    };
    
    return c.json({ success: true, event: responseEvent });
  } catch (error) {
    console.log('Error updating invitee status:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete event
app.delete("/make-server-37f8437f/events/:eventId", async (c) => {
  try {
    const auth = await getAuthenticatedUser(c.req.header('Authorization'));
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const { user } = auth;
    const eventId = c.req.param('eventId');
    const supabase = getServiceClient();
    
    // Verify user is the organizer
    const { data: event } = await supabase
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single();
    
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }
    
    if (event.organizer_id !== user.id) {
      return c.json({ error: 'Unauthorized - not the organizer' }, 403);
    }
    
    // Delete the event (invitees will cascade delete)
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);
    
    if (deleteError) {
      console.log('Error deleting event:', deleteError);
      return c.json({ error: deleteError.message }, 400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting event:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

Deno.serve(app.fetch);

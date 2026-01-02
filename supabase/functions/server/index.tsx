import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

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

// Health check endpoint
app.get("/make-server-37f8437f/health", (c) => {
  return c.json({ status: "ok" });
});

// Helper function to get authenticated user
async function getAuthenticatedUser(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Missing or invalid Authorization header:', authHeader?.substring(0, 20));
    return null;
  }
  
  const accessToken = authHeader.split(' ')[1];
  console.log('Validating token:', accessToken.substring(0, 30) + '...');
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  );
  
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    console.log('Authentication error while getting user:', error?.message, error?.status);
    return null;
  }
  
  console.log('User authenticated successfully:', user.email);
  return user;
}

// Sign up endpoint
app.post("/make-server-37f8437f/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });
    
    if (error) {
      console.log('Error creating user during signup:', error);
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
    const user = await getAuthenticatedUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const eventData = await c.req.json();
    const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const event = {
      ...eventData,
      id: eventId,
      organizer: {
        email: user.email,
        name: user.user_metadata?.name || user.email,
      },
      createdAt: new Date().toISOString(),
    };
    
    // Store event
    await kv.set(`event:${eventId}`, event);
    
    // Add to organizer's events list
    const userEvents = await kv.get(`user_events:${user.id}`) || [];
    userEvents.push(eventId);
    await kv.set(`user_events:${user.id}`, userEvents);
    
    // Add to invitees' invitation lists
    for (const invitee of event.invitees) {
      const inviteeKey = `user_invitations:${invitee.email}`;
      const invitations = await kv.get(inviteeKey) || [];
      invitations.push(eventId);
      await kv.set(inviteeKey, invitations);
    }
    
    return c.json({ success: true, event });
  } catch (error) {
    console.log('Error creating event:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all events for a user (organized + invited)
app.get("/make-server-37f8437f/events", async (c) => {
  try {
    console.log('📨 GET /events - Headers:', Object.fromEntries(c.req.raw.headers.entries()));
    
    const authHeader = c.req.header('Authorization');
    console.log('🔐 Authorization header:', authHeader?.substring(0, 50) + '...');
    
    const user = await getAuthenticatedUser(authHeader);
    if (!user) {
      console.log('❌ Authentication failed, returning 401');
      return c.json({ code: 401, message: 'Invalid JWT' }, 401);
    }
    
    console.log('✅ User authenticated, fetching events for:', user.email);
    
    const eventIds = new Set<string>();
    
    // Get events organized by user
    const organizedEventIds = await kv.get(`user_events:${user.id}`) || [];
    organizedEventIds.forEach((id: string) => eventIds.add(id));
    
    // Get events user is invited to
    const invitedEventIds = await kv.get(`user_invitations:${user.email}`) || [];
    invitedEventIds.forEach((id: string) => eventIds.add(id));
    
    console.log('📋 Found event IDs:', Array.from(eventIds));
    
    // Fetch all events
    const events = [];
    for (const eventId of eventIds) {
      const event = await kv.get(`event:${eventId}`);
      if (event) {
        events.push(event);
      }
    }
    
    console.log(`✅ Returning ${events.length} events`);
    return c.json({ events });
  } catch (error) {
    console.log('❌ Error fetching events:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update invitee status
app.put("/make-server-37f8437f/events/:eventId/invitees/:inviteeEmail/status", async (c) => {
  try {
    const user = await getAuthenticatedUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const eventId = c.req.param('eventId');
    const inviteeEmail = decodeURIComponent(c.req.param('inviteeEmail'));
    const { status } = await c.req.json();
    
    // Get event
    const event = await kv.get(`event:${eventId}`);
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }
    
    // Verify user is the invitee
    const invitee = event.invitees.find((inv: any) => inv.email === inviteeEmail);
    if (!invitee || invitee.email !== user.email) {
      return c.json({ error: 'Unauthorized - not the invitee' }, 403);
    }
    
    // Update invitee status
    event.invitees = event.invitees.map((inv: any) => {
      if (inv.email === inviteeEmail) {
        return { ...inv, status };
      }
      return inv;
    });
    
    // If declined, invite next person in queue
    if (status === 'declined') {
      const declinedInvitee = event.invitees.find((inv: any) => inv.email === inviteeEmail);
      
      if (declinedInvitee) {
        // Find the next pending invitee with lower priority (higher priority number)
        const nextInvitee = event.invitees.find(
          (inv: any) =>
            inv.status === 'pending' &&
            inv.priority > declinedInvitee.priority
        );
        
        if (nextInvitee) {
          // Mark next invitee as invited
          event.invitees = event.invitees.map((inv: any) =>
            inv.email === nextInvitee.email
              ? { ...inv, status: 'invited' }
              : inv
          );
          
          // Add to next invitee's invitation list if not already there
          const nextInviteeKey = `user_invitations:${nextInvitee.email}`;
          const nextInvitations = await kv.get(nextInviteeKey) || [];
          if (!nextInvitations.includes(eventId)) {
            nextInvitations.push(eventId);
            await kv.set(nextInviteeKey, nextInvitations);
          }
        }
      }
    }
    
    // Save updated event
    await kv.set(`event:${eventId}`, event);
    
    return c.json({ success: true, event });
  } catch (error) {
    console.log('Error updating invitee status:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

Deno.serve(app.fetch);
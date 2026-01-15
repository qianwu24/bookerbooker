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
const RESEND_CONFIRM_FROM_EMAIL = Deno.env.get('RESEND_CONFIRM_FROM_EMAIL'); // Optional: separate sender for confirmations
const RESEND_TEMPLATE_ID = Deno.env.get('RESEND_TEMPLATE_ID');
const RESEND_CONFIRM_TEMPLATE_ID = Deno.env.get('RESEND_CONFIRM_TEMPLATE_ID');
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://bookerbooker.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
// Functions base used for RSVP links so they hit the Edge Function directly (avoids SPA 404)
const FUNCTION_BASE_URL = Deno.env.get('FUNCTION_BASE_URL') ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/make-server-37f8437f` : `${APP_BASE_URL}/make-server-37f8437f`);
const RSVP_SECRET = Deno.env.get('RSVP_SECRET') || 'dev-secret-change-me';
const DEFAULT_AUTO_PROMOTE_MINUTES = 30;

type InviteePayload = {
  email: string;
  name?: string;
};

type EventEmailPayload = {
  title: string;
  date: string;
  time: string;
  location?: string;
  timeZone?: string;
  durationMinutes?: number;
  organizerName?: string;
  notes?: string;
  confirmUrl?: string;
  declineUrl?: string;
  orgName?: string;
  icsContent?: string;
};

type EmailAttachment = {
  filename: string;
  content: string; // base64
  path?: string;
};

// --- RSVP token helpers ---
const textEncoder = new TextEncoder();

const padTime = (isoLike: string) => {
  // Ensure we have seconds; if time is HH:MM, append :00
  if (/^\d{2}:\d{2}$/.test(isoLike)) return `${isoLike}:00`;
  return isoLike;
};

const formatIcsDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

const toBase64 = (input: string) => {
  const bytes = textEncoder.encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const buildIcs = (event: {
  id: string;
  title: string;
  description?: string;
  location?: string;
  date: string;
  time: string;
  timeZone?: string;
  durationMinutes?: number;
  organizerEmail: string;
  attendeeEmail?: string;
}) => {
  // Format date/time as local time (no Z suffix) so calendar apps interpret in the given timezone
  const localDateTime = `${event.date.replace(/-/g, '')}T${padTime(event.time).replace(/:/g, '')}`;
  const duration = event.durationMinutes ?? 60;
  const startDate = new Date(`${event.date}T${padTime(event.time)}`);
  const endDate = new Date(startDate.getTime() + duration * 60_000);
  const endDateTime = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}T${String(endDate.getHours()).padStart(2, '0')}${String(endDate.getMinutes()).padStart(2, '0')}${String(endDate.getSeconds()).padStart(2, '0')}`;
  const dtStamp = formatIcsDate(new Date().toISOString());
  const uid = `${event.id}@bookerbooker.com`;
  const tzid = event.timeZone || 'UTC';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Booker//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${tzid}:${localDateTime}`,
    `DTEND;TZID=${tzid}:${endDateTime}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description || ''}`,
    `LOCATION:${event.location || ''}`,
    `ORGANIZER:mailto:${event.organizerEmail}`,
    event.attendeeEmail ? `ATTENDEE;CN=${event.attendeeEmail}:mailto:${event.attendeeEmail}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const content = toBase64(lines);
  return { filename: 'event.ics', content } as EmailAttachment;
};

const base64UrlEncode = (bytes: Uint8Array) => {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const signData = async (data: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(RSVP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, textEncoder.encode(data));
  return base64UrlEncode(new Uint8Array(sig));
};

const createRsvpToken = async (payload: { eventId: string; inviteeEmail: string; action: 'confirm' | 'decline'; exp: number; }) => {
  const json = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(textEncoder.encode(json));
  const sig = await signData(payloadB64);
  return `${payloadB64}.${sig}`;
};

const verifyRsvpToken = async (token: string) => {
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;
  const expectedSig = await signData(payloadB64);
  if (expectedSig !== sig) return null;
  const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
  const payload = JSON.parse(json);
  if (!payload?.exp || Date.now() > payload.exp) return null;
  return payload as { eventId: string; inviteeEmail: string; action: 'confirm' | 'decline'; exp: number; };
};

const buildRsvpUrls = async (eventId: string, inviteeEmail: string) => {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
  const confirmToken = await createRsvpToken({ eventId, inviteeEmail, action: 'confirm', exp });
  const declineToken = await createRsvpToken({ eventId, inviteeEmail, action: 'decline', exp });
  return {
    confirmUrl: `${FUNCTION_BASE_URL}/rsvp?token=${confirmToken}`,
    declineUrl: `${FUNCTION_BASE_URL}/rsvp?token=${declineToken}`,
  };
};

const buildResultPage = (options: {
  title: string;
  detail: string;
  eventTitle?: string;
  eventWhen?: string;
  accentColor?: string;
  badge?: string;
}) => {
  const {
    title,
    detail,
    eventTitle,
    eventWhen,
    accentColor = '#16a34a',
    badge = 'OK',
  } = options;

  const eventBlock = eventTitle || eventWhen
    ? `<div style="background:#0f172a08;border:1px solid #e5e7eb;border-radius:14px;padding:14px 16px;margin:18px 0;">
         ${eventTitle ? `<div style="font-weight:700;color:#0f172a;font-size:16px;">${eventTitle}</div>` : ''}
         ${eventWhen ? `<div style="color:#475569;margin-top:6px;font-size:14px;">${eventWhen}</div>` : ''}
       </div>`
    : '';

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f8fafc;color:#0f172a;">
      <div style="max-width:560px;margin:48px auto;background:#ffffff;border-radius:16px;padding:28px;box-shadow:0 20px 60px rgba(15,23,42,0.10);border:1px solid #e5e7eb;">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
          <div style="width:46px;height:46px;border-radius:12px;background:${accentColor};display:inline-flex;align-items:center;justify-content:center;color:#ffffff;font-weight:700;font-size:16px;box-shadow:0 10px 25px ${accentColor}33;">${badge}</div>
          <div>
            <div style="font-size:14px;color:#6b7280;">RSVP</div>
            <h1 style="margin:2px 0 0 0;font-size:22px;color:#0f172a;">${title}</h1>
          </div>
        </div>
        <p style="margin:0 0 16px 0;font-size:15px;color:#374151;">${detail}</p>
        ${eventBlock}
        <div style="margin-top:18px;text-align:center;">
          <a href="${APP_BASE_URL}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;box-shadow:0 12px 30px rgba(79,70,229,0.25);">Return to Booker</a>
        </div>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:12px;">You can close this tab.</p>
    </body>
  </html>`;
};

const sendInviteEmail = async (
  invitee: InviteePayload,
  event: EventEmailPayload,
  options?: { variant?: 'invite' | 'confirm' }
): Promise<boolean> => {
  const variant = options?.variant ?? 'invite';
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.log('Email not sent: RESEND_API_KEY or RESEND_FROM_EMAIL not configured');
    return false;
  }

  try {
    const subject = variant === 'invite'
      ? `You're invited: ${event.title}`
      : `You're confirmed: ${event.title}`;

    const durationText = event.durationMinutes
      ? `${event.durationMinutes} minute${event.durationMinutes === 1 ? '' : 's'}`
      : 'Not specified';
    const tzText = event.timeZone || 'UTC';

    // If template is configured, send using the template with variables; otherwise fall back to inline HTML/text.
    const templateVariables = {
      invitee_name: invitee.name || invitee.email,
      host_name: event.organizerName || 'Organizer',
      event_title: event.title,
      event_date: event.date,
      event_time: event.time,
      event_location: event.location || 'TBD',
      event_time_zone: tzText,
      event_duration: durationText,
      event_notes: event.notes || '—',
      confirm_url: event.confirmUrl || 'https://bookerbooker.com/confirm',
      decline_url: event.declineUrl || 'https://bookerbooker.com/decline',
      org_name: event.orgName || 'Booker',
    };

    const bodyText = variant === 'invite'
      ? [
          `Hi ${templateVariables.invitee_name}`,
          '',
          `${templateVariables.host_name} invited you to ${templateVariables.event_title}.`,
          `Date: ${templateVariables.event_date}`,
          `Time: ${templateVariables.event_time} (${templateVariables.event_time_zone})`,
          `Duration: ${templateVariables.event_duration}`,
          `Location: ${templateVariables.event_location}`,
          `Organizer: ${templateVariables.host_name}`,
          `Notes: ${templateVariables.event_notes}`,
          '',
          'RSVP:',
          `Confirm: ${templateVariables.confirm_url}`,
          `Decline: ${templateVariables.decline_url}`,
          '',
          `Sent by ${templateVariables.org_name}`,
        ].join('\n')
      : [
          `Hi ${templateVariables.invitee_name}`,
          '',
          `You're confirmed for ${templateVariables.event_title}.`,
          `Date: ${templateVariables.event_date}`,
          `Time: ${templateVariables.event_time} (${templateVariables.event_time_zone})`,
          `Duration: ${templateVariables.event_duration}`,
          `Location: ${templateVariables.event_location}`,
          `Organizer: ${templateVariables.host_name}`,
          `Notes: ${templateVariables.event_notes}`,
          '',
          `View: ${templateVariables.confirm_url}`,
          '',
          `Sent by ${templateVariables.org_name}`,
        ].join('\n');

    const buttonsHtml = variant === 'invite'
      ? `
        <p style="margin:0 0 10px 0; font-weight:600;">Quick RSVP</p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0 10px; margin:0 0 12px 0;">
          <tr>
            <td>
              <a href="${templateVariables.confirm_url}" style="display:block; padding:12px 16px; background:#16a34a; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:700; text-align:center;">Confirm attendance</a>
            </td>
          </tr>
          <tr>
            <td>
              <a href="${templateVariables.decline_url}" style="display:block; padding:12px 16px; background:#dc2626; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:700; text-align:center;">Decline</a>
            </td>
          </tr>
        </table>
      `
      : `
        <div style="margin:0 0 14px 0;">
          <a href="${templateVariables.confirm_url}" style="display:inline-block; padding:12px 16px; background:#4f46e5; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:700; text-align:center;">View event</a>
        </div>
      `;

    const inviteeGreeting = variant === 'invite'
      ? `${templateVariables.host_name} invited you to <strong>${templateVariables.event_title}</strong>.`
      : `You are confirmed for <strong>${templateVariables.event_title}</strong>.`;

    const bodyHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px; color:#0f172a;">
        <h2 style="margin:0 0 12px 0;">${variant === 'invite' ? "You're invited" : "You're confirmed"}: ${templateVariables.event_title}</h2>
        <p style="margin:0 0 12px 0;">Hi ${templateVariables.invitee_name},</p>
        <p style="margin:0 0 14px 0;">${inviteeGreeting}</p>
        ${buttonsHtml}
        <p style="margin:0 0 12px 0;">Event details:</p>
        <ul style="padding-left:18px; margin:0 0 16px 0; line-height:1.4;">
          <li><strong>Date:</strong> ${templateVariables.event_date}</li>
          <li><strong>Time:</strong> ${templateVariables.event_time} (${templateVariables.event_time_zone})</li>
          <li><strong>Duration:</strong> ${templateVariables.event_duration}</li>
          <li><strong>Location:</strong> ${templateVariables.event_location}</li>
          <li><strong>Organizer:</strong> ${templateVariables.host_name}</li>
        </ul>
        <p style="margin:0 0 16px 0;">Notes: ${templateVariables.event_notes}</p>
        <p style="margin:0; font-size:12px; color:#475569;">${variant === 'invite'
          ? `If you do not see the buttons, copy these links:<br />Confirm: ${templateVariables.confirm_url}<br />Decline: ${templateVariables.decline_url}`
          : `If the button does not work, open: ${templateVariables.confirm_url}`}</p>
      </div>`;

    const attachments: EmailAttachment[] = [];
    if (event.icsContent) {
      attachments.push({ filename: 'event.ics', content: event.icsContent });
    }

    // Use different sender for confirmation emails if configured
    const fromEmail = (variant === 'confirm' && RESEND_CONFIRM_FROM_EMAIL)
      ? RESEND_CONFIRM_FROM_EMAIL
      : RESEND_FROM_EMAIL;

    const payload: Record<string, unknown> = {
      from: fromEmail,
      to: [invitee.email],
      subject,
      text: bodyText,
      html: bodyHtml,
      attachments: attachments.length ? attachments : undefined,
    };

    console.log('Sending via Resend', {
      to: invitee.email,
      from: fromEmail,
      subject,
      variant,
      hasIcs: attachments.length > 0,
    });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log('Resend email failed:', res.status, res.statusText, errText);
      return false;
    }

    console.log('Resend email sent to invitee:', invitee.email);
    return true;
  } catch (error) {
    console.log('Error sending invite email:', error);
    return false;
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

  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) {
      console.log('Failed to validate user with Supabase auth', error?.message);
      return null;
    }

    const { user } = data;
    console.log('User authenticated:', user.email);
    return { user, accessToken };
  } catch (err) {
    console.log('Error validating user token:', err);
    return null;
  }
}

// Health check endpoint
app.get("/make-server-37f8437f/health", (c) => {
  return c.json({ status: "ok" });
});

// RSVP endpoint (GET /rsvp?token=...)
app.get("/make-server-37f8437f/rsvp", async (c) => {
  const token = c.req.query('token');
  if (!token) {
    return c.json({ error: 'Missing token' }, 400);
  }

  const payload = await verifyRsvpToken(token);
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 400);
  }

  const { eventId, inviteeEmail, action } = payload;
  const supabase = getServiceClient();

  // Update invitee status
  const { data: invitee, error: inviteeError } = await supabase
    .from('event_invitees')
    .select('*, contact:contacts!inner(email, name, owner_id)')
    .eq('event_id', eventId)
    .eq('contact.email', inviteeEmail)
    .single();

  if (inviteeError || !invitee) {
    return c.json({ error: 'Invitee not found' }, 404);
  }

  // Database constraint allows: pending, invited, accepted, declined
  const newStatus = action === 'confirm' ? 'accepted' : 'declined';

  const { error: updateError } = await supabase
    .from('event_invitees')
    .update({ status: newStatus, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('contact_id', invitee.contact_id);

  if (updateError) {
    return c.json({ error: updateError.message }, 400);
  }

  // Fetch event details for follow-up
  const { data: event } = await supabase
    .from('events')
    .select(`
      *,
      organizer:users!events_organizer_id_fkey(id, email, name)
    `)
    .eq('id', eventId)
    .single();

  // Send confirmation email to invitee on confirm
  if (newStatus === 'accepted' && event) {
    const ics = buildIcs({
      id: eventId,
      title: event.title,
      description: event.description,
      location: event.location,
      date: event.date,
      time: event.time,
      timeZone: event.time_zone,
      durationMinutes: event.duration_minutes,
      organizerEmail: event.organizer?.email || '',
      attendeeEmail: inviteeEmail,
    });

    await sendInviteEmail(
      { email: inviteeEmail, name: invitee?.name },
      {
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        timeZone: event.time_zone,
        durationMinutes: event.duration_minutes,
        organizerName: event.organizer?.name,
        notes: event.description || '—',
        orgName: event.organizer?.name || 'Booker',
        confirmUrl: `${APP_BASE_URL}/events/${eventId}`,
        declineUrl: `${APP_BASE_URL}/events/${eventId}`,
        icsContent: ics.content,
      },
      { variant: 'confirm' },
    );
  }

  // If declined, promote next pending invitee
  if (newStatus === 'declined') {
    const { data: nextInvitee } = await supabase
      .from('event_invitees')
      .select('*, contact:contacts!inner(email, name)')
      .eq('event_id', eventId)
      .eq('status', 'pending')
      .gt('priority', invitee.priority)
      .order('priority', { ascending: true })
      .limit(1)
      .single();

    if (nextInvitee) {
      await supabase
        .from('event_invitees')
        .update({
          status: 'invited',
          invited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', nextInvitee.id);

      // Send invite to promoted
      await sendInviteEmail(
        { email: nextInvitee.contact.email, name: nextInvitee.contact.name },
        {
          title: event?.title || 'Event Invitation',
          date: event?.date || '',
          time: event?.time || '',
          location: event?.location,
          timeZone: event?.time_zone,
          durationMinutes: event?.duration_minutes,
          organizerName: event?.organizer?.name,
          notes: event?.description || '—',
          orgName: event?.organizer?.name || 'Booker',
          confirmUrl: (await buildRsvpUrls(eventId, nextInvitee.contact.email)).confirmUrl,
          declineUrl: (await buildRsvpUrls(eventId, nextInvitee.contact.email)).declineUrl,
        },
      );
    }
  }

  const isAccepted = newStatus === 'accepted';
  const eventTitle = event?.title || 'Event';
  const eventWhen = event?.date && event?.time
    ? `${event.date} at ${event.time}${event?.time_zone ? ` (${event.time_zone})` : ''}`
    : '';

  const html = buildResultPage({
    title: isAccepted ? 'You are confirmed' : 'RSVP recorded',
    detail: isAccepted
      ? 'Thanks! Your attendance is confirmed. We will send you a calendar invite.'
      : 'You have declined this invitation. The organizer has been notified.',
    eventTitle,
    eventWhen,
    accentColor: isAccepted ? '#16a34a' : '#ef4444',
    badge: isAccepted ? 'OK' : 'X',
  });

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// Scheduled endpoint to auto-promote when invited users don't respond in time
app.get("/make-server-37f8437f/cron/auto-promote", async (c) => {
  const supabase = getServiceClient();
  const now = new Date();

  const { data: events, error } = await supabase
    .from('events')
    .select(`
      id,
      title,
      description,
      date,
      time,
      duration_minutes,
      location,
      invite_mode,
      auto_promote_after_minutes,
      organizer:users!events_organizer_id_fkey(email, name),
      invitees:invitees(id, email, name, status, priority, invited_at)
    `);

  if (error || !events) {
    console.log('Auto-promote fetch error:', error);
    return c.json({ promoted: 0, error: error?.message || 'Fetch failed' }, 500);
  }

  let promoted = 0;

  for (const event of events) {
    const hasConfirmed = event.invitees.some((inv: any) => inv.status === 'confirmed' || inv.status === 'accepted');
    if (hasConfirmed) continue;

    const thresholdMinutes = event.auto_promote_after_minutes ?? DEFAULT_AUTO_PROMOTE_MINUTES;
    const cutoff = now.getTime() - thresholdMinutes * 60_000;

    const staleInvited = event.invitees.filter((inv: any) => inv.status === 'invited' && inv.invited_at && new Date(inv.invited_at).getTime() <= cutoff);
    if (staleInvited.length === 0) continue;

    const nextPending = event.invitees
      .filter((inv: any) => inv.status === 'pending')
      .sort((a: any, b: any) => a.priority - b.priority)[0];

    if (!nextPending) continue;

    const nowIso = now.toISOString();

    // Expire stale invited users
    const staleIds = staleInvited.map((inv: any) => inv.id);
    if (staleIds.length > 0) {
      await supabase
        .from('invitees')
        .update({ status: 'declined', updated_at: nowIso })
        .in('id', staleIds);
    }

    // Promote next pending
    const { error: promoteError } = await supabase
      .from('invitees')
      .update({ status: 'invited', invited_at: nowIso, updated_at: nowIso })
      .eq('id', nextPending.id);

    if (promoteError) {
      console.log('Auto-promote update error:', promoteError);
      continue;
    }

    // Send invite to promoted user
    const urls = await buildRsvpUrls(event.id, nextPending.email);

    await sendInviteEmail(
      { email: nextPending.email, name: nextPending.name },
      {
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        timeZone: event.time_zone,
        durationMinutes: event.duration_minutes,
        organizerName: event.organizer?.name,
        notes: event.description || '—',
        orgName: event.organizer?.name || 'Booker',
        confirmUrl: urls.confirmUrl,
        declineUrl: urls.declineUrl,
      },
    );

    promoted += 1;
  }

  return c.json({ promoted });
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
        time_zone: eventData.timeZone || null,
        duration_minutes: eventData.durationMinutes ?? null,
        invite_mode: eventData.inviteMode || 'priority',
        auto_promote_after_minutes: eventData.autoPromoteInterval ?? 30,
        organizer_id: user.id,
      })
      .select()
      .single();
    
    if (eventError) {
      console.log('Error creating event:', eventError);
      return c.json({ error: eventError.message }, 400);
    }
    
    // Add invitees: upsert contacts and link via event_invitees
    const invitedNow: any[] = [];
    const notices: string[] = [];
    if (eventData.invitees && eventData.invitees.length > 0) {
      const isPriorityMode = eventData.inviteMode === 'priority';
      const invitedAt = new Date().toISOString();

      // Upsert contacts per owner/email
      const contactPayload = eventData.invitees.map((invitee: any) => ({
        owner_id: user.id,
        email: invitee.email,
        name: invitee.name,
        phone: invitee.phone ?? null,
      }));

      const { data: contacts, error: contactError } = await supabase
        .from('contacts')
        .upsert(contactPayload, { onConflict: 'owner_id,email' })
        .select();

      if (contactError) {
        console.log('Error upserting contacts:', contactError);
      }

      const contactMap = new Map<string, any>();
      (contacts || []).forEach((c: any) => contactMap.set(c.email, c));

      const inviteesData = eventData.invitees.map((invitee: any, index: number) => {
        const status = isPriorityMode
          ? (index === 0 ? 'invited' : 'pending')
          : 'invited';

        const contact = contactMap.get(invitee.email);

        return {
          event_id: event.id,
          contact_id: contact?.id,
          status,
          priority: invitee.priority ?? index,
          invited_at: status === 'invited' ? invitedAt : null,
        };
      }).filter((inv: any) => inv.contact_id);
      
      const { data: insertedLinks, error: inviteesError } = await supabase
        .from('event_invitees')
        .upsert(inviteesData, { onConflict: 'event_id,contact_id', ignoreDuplicates: false })
        .select(`*, contact:contacts(id, email, name)`);
      
      if (inviteesError) {
        console.log('Error adding invitees:', inviteesError);
        // Don't fail the whole request, event was created
      } else {
        const inviteSource = insertedLinks || inviteesData;
        if (insertedLinks && insertedLinks.length < inviteesData.length) {
          notices.push('Some invitees already existed for this event and were updated.');
        }
        invitedNow.push(...inviteSource.filter((inv: any) => inv.status === 'invited'));
      }
    }
    
    // Fetch the complete event with invitees
    const { data: fullEvent, error: fetchError } = await supabase
      .from('events')
      .select(`
        *,
        organizer:users!events_organizer_id_fkey(id, email, name, avatar_url),
        invitees:event_invitees (
          status,
          priority,
          invited_at,
          contact:contacts (id, email, name, phone)
        )
      `)
      .eq('id', event.id)
      .single();

    if (fetchError || !fullEvent) {
      console.log('Error fetching full event after creation:', fetchError);
      return c.json({ error: 'Failed to fetch created event', details: fetchError?.message }, 500);
    }
    
    // Transform to match frontend expected format
    const responseEvent = {
      id: fullEvent.id,
      title: fullEvent.title,
      description: fullEvent.description,
      date: fullEvent.date,
      time: fullEvent.time,
      location: fullEvent.location,
      timeZone: fullEvent.time_zone || eventData.timeZone || null,
      durationMinutes: fullEvent.duration_minutes ?? eventData.durationMinutes ?? null,
      inviteMode: fullEvent.invite_mode || 'priority',
      autoPromoteInterval: fullEvent.auto_promote_after_minutes ?? 30,
      organizer: {
        email: fullEvent.organizer.email,
        name: fullEvent.organizer.name,
      },
      invitees: (fullEvent.invitees || []).map((inv: any) => ({
        email: inv.contact?.email,
        name: inv.contact?.name,
        priority: inv.priority,
        status: inv.status,
        invitedAt: inv.invited_at,
      })).filter((inv: any) => inv.email),
      createdAt: fullEvent.created_at,
    };
    const responseNotices = eventData.invitees && eventData.invitees.length > 0 ? notices : [];

    // Send creator confirmation (with ICS) and invitee invites
    // Creator confirmation (no ICS on initial create)
    await sendInviteEmail(
      { email: responseEvent.organizer.email, name: responseEvent.organizer.name },
      {
        title: responseEvent.title,
        date: responseEvent.date,
        time: responseEvent.time,
        location: responseEvent.location,
        timeZone: responseEvent.timeZone,
        durationMinutes: responseEvent.durationMinutes,
        organizerName: responseEvent.organizer.name,
        notes: responseEvent.description || '—',
        orgName: responseEvent.organizer.name || 'Booker',
        confirmUrl: `${APP_BASE_URL}/events/${responseEvent.id}`,
        declineUrl: `${APP_BASE_URL}/events/${responseEvent.id}`,
      },
    );

    // Invitees
    if (invitedNow.length > 0) {
      await Promise.all(invitedNow.map(async (inv) => {
        const email = inv.contact?.email || inv.email;
        const name = inv.contact?.name || inv.name;
        if (!email) return;
        const urls = await buildRsvpUrls(responseEvent.id, email);
        await sendInviteEmail(
          { email, name },
          {
            title: responseEvent.title,
            date: responseEvent.date,
            time: responseEvent.time,
            location: responseEvent.location,
            timeZone: responseEvent.timeZone,
            durationMinutes: responseEvent.durationMinutes,
            organizerName: responseEvent.organizer.name,
            notes: responseEvent.description || '—',
            orgName: responseEvent.organizer.name || 'Booker',
            confirmUrl: urls.confirmUrl,
            declineUrl: urls.declineUrl,
          },
        );
      }));
    }
    
    return c.json({ success: true, event: responseEvent, notices: responseNotices });
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
        invitees:event_invitees (
          status,
          priority,
          invited_at,
          contact:contacts!event_invitees_contact_id_fkey (id, email, name, phone)
        )
      `)
      .eq('organizer_id', user.id);
    
    if (orgError) {
      console.log('Error fetching organized events:', orgError);
    }
    
    // Get event IDs where user is invited
    const { data: invitedEventIds } = await supabase
      .from('event_invitees')
      .select('event_id, contact:contacts!inner(email, owner_id)')
      .eq('contact.email', user.email)
      .eq('contact.owner_id', user.id);
    
    let invitedEvents: any[] = [];
    if (invitedEventIds && invitedEventIds.length > 0) {
      const ids = invitedEventIds.map(i => i.event_id);
      const { data } = await supabase
        .from('events')
        .select(`
          *,
          organizer:users!events_organizer_id_fkey(id, email, name, avatar_url),
          invitees:event_invitees (
            status,
            priority,
            invited_at,
            contact:contacts!event_invitees_contact_id_fkey (id, email, name, phone)
          )
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
        email: inv.contact.email,
        name: inv.contact.name,
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
      .from('event_invitees')
      .select('*, contact:contacts!inner(email, name, id)')
      .eq('event_id', eventId)
      .eq('contact.email', inviteeEmail)
      .single();
    
    if (inviteeError || !invitee) {
      return c.json({ error: 'Invitee not found' }, 404);
    }
    
    // Fetch event upfront for later notifications
    const { data: event } = await supabase
      .from('events')
      .select(`
        *,
        organizer:users!events_organizer_id_fkey(id, email, name, avatar_url),
        invitees:event_invitees (
          status,
          priority,
          invited_at,
          contact:contacts!event_invitees_contact_id_fkey (id, email, name, phone)
        )
      `)
      .eq('id', eventId)
      .single();

    // Update the invitee status
    const { error: updateError } = await supabase
      .from('event_invitees')
      .update({ status, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('contact_id', invitee.contact_id);
    
    if (updateError) {
      console.log('Error updating invitee status:', updateError);
      return c.json({ error: updateError.message }, 400);
    }
    
    // If declined, invite the next person in queue
    if (status === 'declined') {
      // Find next pending invitee with higher priority number (lower priority)
      const { data: nextInvitee } = await supabase
        .from('event_invitees')
        .select('*, contact:contacts!inner(email, name)')
        .eq('event_id', eventId)
        .eq('status', 'pending')
        .gt('priority', invitee.priority)
        .order('priority', { ascending: true })
        .limit(1)
        .single();
      
      if (nextInvitee) {
        await supabase
          .from('event_invitees')
          .update({ status: 'invited', invited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', nextInvitee.id);

        // Send invite to the promoted invitee
        await sendInviteEmail(
          { email: nextInvitee.contact.email, name: nextInvitee.contact.name },
          {
            title: event?.title || 'Event Invitation',
            date: event?.date || '',
            time: event?.time || '',
            location: event?.location,
            timeZone: event?.time_zone,
            durationMinutes: event?.duration_minutes,
            organizerName: event?.organizer?.name,
            notes: event?.description || '—',
            orgName: event?.organizer?.name || 'Booker',
            confirmUrl: (await buildRsvpUrls(eventId, nextInvitee.contact.email)).confirmUrl,
            declineUrl: (await buildRsvpUrls(eventId, nextInvitee.contact.email)).declineUrl,
          },
        );
      }
    }
    
    // Fetch the updated event
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
        email: inv.contact.email,
        name: inv.contact.name,
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

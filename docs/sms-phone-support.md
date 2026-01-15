# SMS / Phone Number Support - Technical Specification

> **Status:** Planned  
> **Last Updated:** January 15, 2026  
> **Priority:** Medium

## Overview

Enable SMS-based invitations and RSVP responses for invitees who prefer text messages over email. This allows users to add phone-only contacts and receive confirmations via SMS.

## User Flow

### Outbound (Sending Invites)

```
Event Created with phone-only invitee
       ↓
Send SMS: "🎾 You're invited to [Event] on [Date] at [Time].
           Reply Y to accept or N to decline."
       ↓
Store pending response in DB (sms_sent_at timestamp)
```

### Inbound (Receiving Replies via Webhook)

```
User replies "Y" or "N" via SMS
       ↓
Twilio/Telnyx webhook → Edge Function (/sms-webhook)
       ↓
Look up invitee by phone number
       ↓
If "Y" (Accept):
  ├─ Check if spot still available
  ├─ If available: 
  │    - Update status to 'accepted'
  │    - Send "✅ Confirmed! You're attending [Event]..."
  └─ If taken:
       - Send "😔 Sorry, the spot was just taken by another invitee."
       
If "N" (Decline):
  └─ Update status to 'declined'
     (No confirmation SMS needed)
```

## SMS Provider Comparison

| Provider | Send Cost (US) | Receive Cost | Phone # | Free Tier | Recommendation |
|----------|---------------|--------------|---------|-----------|----------------|
| **Telnyx** | $0.004/msg | $0.004/msg | $1/mo | $10 credit | ⭐ Best value |
| Twilio | $0.0079/msg | $0.0079/msg | $1.15/mo | $15 credit | Most popular |
| Plivo | $0.005/msg | $0.005/msg | $0.80/mo | Free trial | Good alternative |
| Vonage | $0.0068/msg | $0.0068/msg | $1.25/mo | €2 credit | Enterprise focus |

### Cost Estimates

| Monthly Active Users | SMS Sent | Telnyx Cost | Twilio Cost |
|---------------------|----------|-------------|-------------|
| 100 | 300 | ~$2.20 | ~$3.50 |
| 500 | 1,500 | ~$7.00 | ~$13.00 |
| 1,000 | 3,000 | ~$13.00 | ~$25.00 |

**Recommendation:** Start with **Telnyx** for ~50% cost savings.

## Implementation Plan

### 1. Provider Setup (Manual)

```bash
# After signing up for Telnyx/Twilio:
supabase secrets set TELNYX_API_KEY=xxx
supabase secrets set TELNYX_PHONE_NUMBER=+1234567890
# OR
supabase secrets set TWILIO_ACCOUNT_SID=xxx
supabase secrets set TWILIO_AUTH_TOKEN=xxx
supabase secrets set TWILIO_PHONE_NUMBER=+1234567890
```

### 2. Database Migration

```sql
-- File: supabase/migrations/YYYYMMDD_add_sms_support.sql

-- Track notification preferences per invitee
ALTER TABLE event_invitees 
  ADD COLUMN notification_method TEXT DEFAULT 'email'
  CHECK (notification_method IN ('email', 'sms', 'both'));

-- Track SMS delivery and response
ALTER TABLE event_invitees 
  ADD COLUMN sms_sent_at TIMESTAMPTZ,
  ADD COLUMN sms_responded_at TIMESTAMPTZ;

-- Index for webhook lookups by phone
CREATE INDEX idx_contacts_phone_lookup 
  ON contacts(phone) 
  WHERE phone IS NOT NULL;
```

### 3. Backend: SMS Sending Function

```typescript
// In supabase/functions/make-server-37f8437f/index.ts

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function sendSMS(to: string, body: string): Promise<SMSResult> {
  const provider = Deno.env.get('SMS_PROVIDER') || 'telnyx'; // or 'twilio'
  
  if (provider === 'telnyx') {
    return sendViaTelnyx(to, body);
  } else {
    return sendViaTwilio(to, body);
  }
}

async function sendViaTelnyx(to: string, body: string): Promise<SMSResult> {
  const apiKey = Deno.env.get('TELNYX_API_KEY');
  const from = Deno.env.get('TELNYX_PHONE_NUMBER');
  
  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      text: body,
    }),
  });
  
  const data = await response.json();
  return {
    success: response.ok,
    messageId: data.data?.id,
    error: data.errors?.[0]?.detail,
  };
}

async function sendViaTwilio(to: string, body: string): Promise<SMSResult> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE_NUMBER');
  
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from!, Body: body }),
    }
  );
  
  const data = await response.json();
  return {
    success: response.ok,
    messageId: data.sid,
    error: data.message,
  };
}
```

### 4. Backend: SMS Webhook Endpoint

```typescript
// POST /make-server-37f8437f/sms-webhook
app.post("/make-server-37f8437f/sms-webhook", async (c) => {
  const body = await c.req.parseBody();
  
  // Telnyx format
  const from = body.from || body.From;
  const text = (body.text || body.Body || '').toString().trim().toUpperCase();
  
  // Normalize phone number
  const phone = normalizePhone(from);
  
  // Find the invitee with pending invite
  const { data: invitee } = await supabase
    .from('event_invitees')
    .select(`
      id, event_id, status,
      contact:contacts!inner(phone, name),
      event:events!inner(title, date, time, location)
    `)
    .eq('contact.phone', phone)
    .eq('status', 'invited')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!invitee) {
    // No pending invite found
    await sendSMS(from, "We couldn't find a pending invitation for this number.");
    return c.text('OK');
  }
  
  if (text === 'Y' || text === 'YES') {
    // Check if someone else already accepted
    const { data: existing } = await supabase
      .from('event_invitees')
      .select('id')
      .eq('event_id', invitee.event_id)
      .eq('status', 'accepted')
      .limit(1);
    
    if (existing && existing.length > 0) {
      // Spot taken
      await sendSMS(from, 
        `😔 Sorry, the spot for "${invitee.event.title}" was just taken by another invitee.`
      );
    } else {
      // Accept
      await supabase
        .from('event_invitees')
        .update({ 
          status: 'accepted', 
          sms_responded_at: new Date().toISOString() 
        })
        .eq('id', invitee.id);
      
      await sendSMS(from,
        `✅ Confirmed! You're attending "${invitee.event.title}" on ${invitee.event.date} at ${invitee.event.time}. Location: ${invitee.event.location}. See you there!`
      );
    }
  } else if (text === 'N' || text === 'NO') {
    // Decline - no confirmation needed
    await supabase
      .from('event_invitees')
      .update({ 
        status: 'declined', 
        sms_responded_at: new Date().toISOString() 
      })
      .eq('id', invitee.id);
    
    // Optionally promote next invitee (priority mode)
    // ... promotion logic ...
  } else {
    // Invalid response
    await sendSMS(from, 
      `Please reply Y to accept or N to decline the invitation to "${invitee.event.title}".`
    );
  }
  
  return c.text('OK');
});
```

### 5. Update Invite Flow

When creating an event, for invitees with phone numbers:

```typescript
// In POST /events handler, after creating event_invitees:

for (const invitee of inviteesWithPhone) {
  if (invitee.status === 'invited') {
    const message = `🎾 You're invited to "${event.title}" on ${event.date} at ${event.time}.\n\nReply Y to accept or N to decline.`;
    
    await sendSMS(invitee.phone, message);
    
    await supabase
      .from('event_invitees')
      .update({ 
        sms_sent_at: new Date().toISOString(),
        notification_method: invitee.email ? 'both' : 'sms'
      })
      .eq('id', invitee.id);
  }
}
```

### 6. Webhook Configuration

After deploying, configure webhook URL in provider dashboard:

**Telnyx:**
```
Messaging Profile → Inbound Settings → Webhook URL:
https://umxycfmyuilnzgawtstd.supabase.co/functions/v1/make-server-37f8437f/sms-webhook
```

**Twilio:**
```
Phone Number → Messaging → Webhook URL:
https://umxycfmyuilnzgawtstd.supabase.co/functions/v1/make-server-37f8437f/sms-webhook
```

## Message Templates

| Scenario | Message |
|----------|---------|
| **Invite** | `🎾 You're invited to "[Event]" on [Date] at [Time]. Reply Y to accept or N to decline.` |
| **Confirmed** | `✅ Confirmed! You're attending "[Event]" on [Date] at [Time]. Location: [Location]. See you there!` |
| **Spot Taken** | `😔 Sorry, the spot for "[Event]" was just taken by another invitee. We'll let you know if it opens up.` |
| **Invalid Reply** | `Please reply Y to accept or N to decline the invitation to "[Event]".` |
| **No Invite Found** | `We couldn't find a pending invitation for this number.` |

## Frontend Changes

The frontend already supports phone numbers:
- ✅ Phone input field in create-event form
- ✅ Phone-only invitees allowed
- ✅ Phone displayed in invitee lists

No additional frontend changes needed for MVP.

## Testing Checklist

- [ ] Send invite SMS to phone-only invitee
- [ ] Reply Y → confirm acceptance, receive confirmation
- [ ] Reply N → decline (no response SMS)
- [ ] Reply Y when spot taken → receive "spot taken" message
- [ ] Reply invalid text → receive clarification message
- [ ] Reply from unknown number → receive "no invite" message

## Security Considerations

1. **Webhook validation**: Verify webhook signatures (both Telnyx and Twilio provide this)
2. **Rate limiting**: Prevent SMS bombing via webhook
3. **Phone normalization**: Handle various phone formats (+1, 1, etc.)
4. **Opt-out handling**: Support STOP/UNSUBSCRIBE keywords

## Future Enhancements

- [ ] Reminder SMS before event
- [ ] Two-way conversation for questions
- [ ] SMS delivery status tracking
- [ ] International phone number support
- [ ] WhatsApp integration (via Twilio/Telnyx)

---

## Next Steps

1. **Sign up** for Telnyx or Twilio
2. **Purchase** a phone number
3. **Add secrets** to Supabase
4. **Implement** backend changes (this doc serves as spec)
5. **Configure** webhook URL
6. **Test** end-to-end flow

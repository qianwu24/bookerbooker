/**
 * SMS Templates for Twilio
 * 
 * All templates are designed to be concise (under 160 chars when possible)
 * to fit in a single SMS segment and reduce costs.
 */

export interface EventSmsData {
  eventTitle: string;
  eventDate: string; // Formatted date string (e.g., "Sat, Jan 15")
  eventTime: string; // Formatted time string (e.g., "3:00 PM")
  location?: string;
  organizerName: string;
  inviteeName?: string;
}

/**
 * 1. INVITATION SMS - Sent to invitees when they are invited
 * Includes Y/N reply instructions for confirmation
 */
export function getInvitationSms(data: EventSmsData): string {
  const locationPart = data.location ? ` at ${data.location}` : '';
  return `📅 ${data.organizerName} invited you to "${data.eventTitle}" on ${data.eventDate} at ${data.eventTime}${locationPart}.

Reply Y to confirm, N to decline.`;
}

/**
 * 2a. CONFIRMATION SMS - Sent to invitee when they accept
 */
export function getInviteeConfirmationSms(data: EventSmsData): string {
  const locationPart = data.location ? ` at ${data.location}` : '';
  return `✅ You're confirmed for "${data.eventTitle}" on ${data.eventDate} at ${data.eventTime}${locationPart}. See you there!`;
}

/**
 * 2b. CONFIRMATION SMS - Sent to organizer when invitee accepts
 */
export function getOrganizerConfirmationSms(data: EventSmsData): string {
  return `🎉 ${data.inviteeName || 'Someone'} confirmed for "${data.eventTitle}" on ${data.eventDate} at ${data.eventTime}.`;
}

/**
 * 2c. DECLINE SMS - Sent to organizer when invitee declines
 */
export function getOrganizerDeclineSms(data: EventSmsData): string {
  return `❌ ${data.inviteeName || 'Someone'} declined "${data.eventTitle}" on ${data.eventDate}.`;
}

/**
 * 3a. REMINDER SMS - Sent to invitee 1 hour before event
 */
export function getInviteeReminderSms(data: EventSmsData): string {
  const locationPart = data.location ? ` at ${data.location}` : '';
  return `⏰ Reminder: "${data.eventTitle}" starts in 1 hour (${data.eventTime})${locationPart}. See you soon!`;
}

/**
 * 3b. REMINDER SMS - Sent to organizer 1 hour before event
 */
export function getOrganizerReminderSms(data: EventSmsData): string {
  const locationPart = data.location ? ` at ${data.location}` : '';
  return `⏰ Reminder: Your event "${data.eventTitle}" starts in 1 hour (${data.eventTime})${locationPart}.`;
}

/**
 * Helper: Format date for SMS (compact format)
 */
export function formatDateForSms(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Helper: Format time for SMS (12-hour format)
 */
export function formatTimeForSms(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Parse Y/N reply from incoming SMS
 * Returns 'accepted' | 'declined' | null (if unrecognized)
 */
export function parseReplyStatus(message: string): 'accepted' | 'declined' | null {
  const normalized = message.trim().toUpperCase();
  
  // Accept variations of Yes
  if (['Y', 'YES', 'YEP', 'YA', 'YEAH', 'YUP', 'CONFIRM', 'OK', 'OKAY', 'SURE'].includes(normalized)) {
    return 'accepted';
  }
  
  // Accept variations of No
  if (['N', 'NO', 'NOPE', 'NAH', 'DECLINE', 'CANCEL', 'CANT', "CAN'T", 'CANNOT'].includes(normalized)) {
    return 'declined';
  }
  
  return null;
}

/**
 * Unrecognized reply response
 */
export function getUnrecognizedReplySms(): string {
  return `Sorry, I didn't understand that. Reply Y to confirm or N to decline your event invitation.`;
}

/**
 * No pending invitation response
 */
export function getNoPendingInvitationSms(): string {
  return `You don't have any pending event invitations to respond to.`;
}

/**
 * Already responded response
 */
export function getAlreadyRespondedSms(status: 'accepted' | 'declined'): string {
  const statusText = status === 'accepted' ? 'confirmed' : 'declined';
  return `You've already ${statusText} this invitation.`;
}

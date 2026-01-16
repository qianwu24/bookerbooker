import type { Event, ConfirmationStatus, TimeStatus } from '../app/types';

export interface EventStatuses {
  confirmationStatus: ConfirmationStatus;
  timeStatus: TimeStatus;
}

/**
 * Calculate event statuses based on invitee responses and time.
 * 
 * Confirmation Status:
 * - 'scheduled': At least one invitee has accepted
 * - 'declined': All invitees have declined (event won't happen)
 * - 'invited': Future event with pending/invited invitees (or no invitees yet)
 * - 'no-show': Past event with no accepted invitees
 * 
 * Time Status:
 * - 'completed': Event is in the past
 * - 'approaching': Event is within 24 hours
 * - 'upcoming': Event is more than 24 hours away
 */
export function calculateEventStatuses(event: Event, now: Date = new Date()): EventStatuses {
  const eventDateTime = new Date(`${event.date}T${event.time}`);
  const hoursUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  const hasPassed = eventDateTime < now;
  const hasAccepted = event.invitees.some(inv => inv.status === 'accepted');
  const hasInvited = event.invitees.some(inv => inv.status === 'invited');
  const hasPending = event.invitees.some(inv => inv.status === 'pending');
  const allDeclined = event.invitees.length > 0 && event.invitees.every(inv => inv.status === 'declined');
  
  // Confirmation status: scheduled (accepted) > declined (all declined) > invited > no-show (only for past events)
  let confirmationStatus: ConfirmationStatus;
  if (hasAccepted) {
    confirmationStatus = 'scheduled';
  } else if (allDeclined) {
    confirmationStatus = 'declined';
  } else if (hasPassed) {
    // Past event with no accepted invitees = no-show
    confirmationStatus = 'no-show';
  } else if (hasInvited || hasPending) {
    confirmationStatus = 'invited';
  } else {
    // Future event with no invitees yet - treat as invited (pending setup)
    confirmationStatus = 'invited';
  }
  
  // Time status
  let timeStatus: TimeStatus;
  if (hasPassed) {
    timeStatus = 'completed';
  } else if (hoursUntilEvent <= 24) {
    timeStatus = 'approaching';
  } else {
    timeStatus = 'upcoming';
  }
  
  return { confirmationStatus, timeStatus };
}

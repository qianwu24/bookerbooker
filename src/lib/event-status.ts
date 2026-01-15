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
  
  // Confirmation status: scheduled (accepted) > invited > no-show (only for past events)
  let confirmationStatus: ConfirmationStatus;
  if (hasAccepted) {
    confirmationStatus = 'scheduled';
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

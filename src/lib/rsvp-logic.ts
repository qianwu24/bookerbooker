/**
 * Core business logic for RSVP handling.
 * Extracted for testability.
 */

export type InviteeStatus = 'pending' | 'invited' | 'accepted' | 'declined';

export interface Invitee {
  id: string;
  email: string;
  status: InviteeStatus;
  priority: number;
  contact_id: string;
}

export interface RsvpResult {
  success: boolean;
  newStatus?: InviteeStatus;
  error?: string;
  shouldPromoteNext?: boolean;
  promotedInvitee?: Invitee;
}

/**
 * Determines if an RSVP action (confirm/decline) should be allowed
 * and what the outcome should be.
 * 
 * Business rules:
 * 1. Only one person can accept an event (first-come-first-served for acceptance)
 * 2. If someone already accepted, subsequent accepts are rejected
 * 3. When declining, the next pending invitee should be promoted
 */
export function processRsvpAction(
  invitees: Invitee[],
  targetInviteeEmail: string,
  action: 'confirm' | 'decline'
): RsvpResult {
  const targetInvitee = invitees.find(
    (inv) => inv.email.toLowerCase() === targetInviteeEmail.toLowerCase()
  );

  if (!targetInvitee) {
    return { success: false, error: 'Invitee not found' };
  }

  // Check if someone already accepted
  const alreadyAccepted = invitees.find(
    (inv) => inv.status === 'accepted' && inv.email.toLowerCase() !== targetInviteeEmail.toLowerCase()
  );

  if (action === 'confirm') {
    // Rule: Only one person can accept
    if (alreadyAccepted) {
      return {
        success: false,
        error: 'This event has already been confirmed by another invitee',
      };
    }

    // Check if invitee is in a valid state to accept
    if (targetInvitee.status !== 'invited' && targetInvitee.status !== 'pending') {
      if (targetInvitee.status === 'accepted') {
        return { success: false, error: 'You have already accepted this invitation' };
      }
      if (targetInvitee.status === 'declined') {
        return { success: false, error: 'You have already declined this invitation' };
      }
    }

    return {
      success: true,
      newStatus: 'accepted',
    };
  }

  if (action === 'decline') {
    // Check if invitee is in a valid state to decline
    if (targetInvitee.status === 'declined') {
      return { success: false, error: 'You have already declined this invitation' };
    }
    if (targetInvitee.status === 'accepted') {
      return { success: false, error: 'You have already accepted this invitation. Contact the organizer to cancel.' };
    }

    // Find next pending invitee to promote
    const pendingInvitees = invitees
      .filter((inv) => inv.status === 'pending')
      .sort((a, b) => a.priority - b.priority);

    const nextPending = pendingInvitees.find(
      (inv) => inv.priority > targetInvitee.priority
    );

    return {
      success: true,
      newStatus: 'declined',
      shouldPromoteNext: !!nextPending,
      promotedInvitee: nextPending,
    };
  }

  return { success: false, error: 'Invalid action' };
}

/**
 * Calculate event status badges based on invitees and event time.
 */
export type ConfirmationStatus = 'scheduled' | 'invited' | 'no-show';
export type TimeStatus = 'approaching' | 'upcoming' | 'completed';

export function calculateEventStatuses(
  invitees: { status: InviteeStatus }[],
  eventDateTime: Date,
  now: Date = new Date()
): { confirmationStatus: ConfirmationStatus; timeStatus: TimeStatus } {
  const hoursUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const hasPassed = eventDateTime < now;
  const hasAccepted = invitees.some((inv) => inv.status === 'accepted');
  const hasInvited = invitees.some((inv) => inv.status === 'invited');
  const hasPending = invitees.some((inv) => inv.status === 'pending');

  // Confirmation status
  let confirmationStatus: ConfirmationStatus;
  if (hasAccepted) {
    confirmationStatus = 'scheduled';
  } else if (hasInvited || hasPending) {
    confirmationStatus = 'invited';
  } else {
    confirmationStatus = 'no-show';
  }

  // For past events with no acceptance, mark as no-show
  if (hasPassed && !hasAccepted) {
    confirmationStatus = 'no-show';
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

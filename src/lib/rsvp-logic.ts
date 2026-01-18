/**
 * Core business logic for RSVP handling.
 * Extracted for testability.
 */

export type InviteeStatus = 'pending' | 'invited' | 'accepted' | 'declined';
export type InviteMode = 'priority' | 'first-come-first-serve';

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
  isEventFull?: boolean;
  spotsRemaining?: number;
}

/**
 * Determines if an RSVP action (confirm/decline) should be allowed
 * and what the outcome should be.
 * 
 * Business rules for FIRST-COME-FIRST-SERVE mode:
 * - All invitees are invited at the same time (all have status 'invited')
 * - First N people (where N = spots) to accept win
 * - No promotion needed on decline (everyone was already invited)
 * 
 * Business rules for PRIORITY mode:
 * - Invitees are invited one at a time in priority order
 * - First invitee (priority 0) is invited, rest are pending
 * - When someone declines, next pending invitee is promoted to invited
 * - Only N people (where N = spots) can accept
 * 
 * @param spots - Number of spots available (default 1)
 */
export function processRsvpAction(
  invitees: Invitee[],
  targetInviteeEmail: string,
  action: 'confirm' | 'decline',
  inviteMode: InviteMode = 'priority',
  spots: number = 1
): RsvpResult {
  const targetInvitee = invitees.find(
    (inv) => inv.email.toLowerCase() === targetInviteeEmail.toLowerCase()
  );

  if (!targetInvitee) {
    return { success: false, error: 'Invitee not found' };
  }

  // Count how many have already accepted (excluding current invitee)
  const acceptedCount = invitees.filter(
    (inv) => inv.status === 'accepted' && inv.email.toLowerCase() !== targetInviteeEmail.toLowerCase()
  ).length;

  if (action === 'confirm') {
    // Rule: Only N people can accept (where N = spots)
    if (acceptedCount >= spots) {
      return {
        success: false,
        error: spots === 1 
          ? 'This event has already been confirmed by another invitee'
          : `This event is full (${spots} spot${spots > 1 ? 's' : ''} filled)`,
        isEventFull: true,
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

    // Check if this acceptance fills all spots
    const willBeFull = (acceptedCount + 1) >= spots;

    return {
      success: true,
      newStatus: 'accepted',
      isEventFull: willBeFull,
      spotsRemaining: spots - acceptedCount - 1,
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

    // In first-come-first-serve mode, no promotion needed (everyone was already invited)
    if (inviteMode === 'first-come-first-serve') {
      return {
        success: true,
        newStatus: 'declined',
        shouldPromoteNext: false,
      };
    }

    // In priority mode, find next pending invitee to promote
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
export type ConfirmationStatus = 'scheduled' | 'invited' | 'declined' | 'no-show';
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
  const allDeclined = invitees.length > 0 && invitees.every((inv) => inv.status === 'declined');

  // Confirmation status
  let confirmationStatus: ConfirmationStatus;
  if (hasAccepted) {
    confirmationStatus = 'scheduled';
  } else if (allDeclined) {
    confirmationStatus = 'declined';
  } else if (hasInvited || hasPending) {
    confirmationStatus = 'invited';
  } else {
    confirmationStatus = 'no-show';
  }

  // For past events with no acceptance, mark as no-show (unless all declined)
  if (hasPassed && !hasAccepted && !allDeclined) {
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

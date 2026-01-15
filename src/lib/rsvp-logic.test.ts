import { describe, it, expect } from 'vitest';
import {
  processRsvpAction,
  calculateEventStatuses,
  type Invitee,
} from './rsvp-logic';

describe('processRsvpAction', () => {
  const createInvitee = (
    email: string,
    status: Invitee['status'],
    priority: number
  ): Invitee => ({
    id: `id-${email}`,
    email,
    status,
    priority,
    contact_id: `contact-${email}`,
  });

  describe('confirm action', () => {
    it('should allow first invitee to accept', () => {
      const invitees = [
        createInvitee('alice@example.com', 'invited', 0),
        createInvitee('bob@example.com', 'pending', 1),
        createInvitee('charlie@example.com', 'pending', 2),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'confirm');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
    });

    it('should reject second confirm after first person accepted', () => {
      const invitees = [
        createInvitee('alice@example.com', 'accepted', 0), // Already accepted
        createInvitee('bob@example.com', 'invited', 1),
        createInvitee('charlie@example.com', 'pending', 2),
      ];

      const result = processRsvpAction(invitees, 'bob@example.com', 'confirm');

      expect(result.success).toBe(false);
      expect(result.error).toBe('This event has already been confirmed by another invitee');
    });

    it('should reject confirm if invitee already accepted', () => {
      const invitees = [
        createInvitee('alice@example.com', 'accepted', 0),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'confirm');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You have already accepted this invitation');
    });

    it('should reject confirm if invitee already declined', () => {
      const invitees = [
        createInvitee('alice@example.com', 'declined', 0),
        createInvitee('bob@example.com', 'invited', 1),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'confirm');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You have already declined this invitation');
    });

    it('should allow pending invitee to accept if no one else accepted', () => {
      const invitees = [
        createInvitee('alice@example.com', 'declined', 0),
        createInvitee('bob@example.com', 'pending', 1),
      ];

      const result = processRsvpAction(invitees, 'bob@example.com', 'confirm');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
    });

    it('should return error for non-existent invitee', () => {
      const invitees = [
        createInvitee('alice@example.com', 'invited', 0),
      ];

      const result = processRsvpAction(invitees, 'unknown@example.com', 'confirm');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invitee not found');
    });

    it('should be case-insensitive for email matching', () => {
      const invitees = [
        createInvitee('Alice@Example.com', 'invited', 0),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'confirm');

      expect(result.success).toBe(true);
    });
  });

  describe('decline action', () => {
    it('should allow invitee to decline and promote next pending', () => {
      const invitees = [
        createInvitee('alice@example.com', 'invited', 0),
        createInvitee('bob@example.com', 'pending', 1),
        createInvitee('charlie@example.com', 'pending', 2),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'decline');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('declined');
      expect(result.shouldPromoteNext).toBe(true);
      expect(result.promotedInvitee?.email).toBe('bob@example.com');
    });

    it('should not promote if no pending invitees remain', () => {
      const invitees = [
        createInvitee('alice@example.com', 'invited', 0),
        createInvitee('bob@example.com', 'declined', 1),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'decline');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('declined');
      expect(result.shouldPromoteNext).toBe(false);
      expect(result.promotedInvitee).toBeUndefined();
    });

    it('should reject decline if already declined', () => {
      const invitees = [
        createInvitee('alice@example.com', 'declined', 0),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'decline');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You have already declined this invitation');
    });

    it('should reject decline if already accepted', () => {
      const invitees = [
        createInvitee('alice@example.com', 'accepted', 0),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'decline');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already accepted');
    });

    it('should promote next in priority order', () => {
      const invitees = [
        createInvitee('alice@example.com', 'invited', 0),
        createInvitee('charlie@example.com', 'pending', 5), // Higher priority number = lower priority
        createInvitee('bob@example.com', 'pending', 2),     // Lower priority number = higher priority
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'decline');

      expect(result.promotedInvitee?.email).toBe('bob@example.com'); // Bob has priority 2, should be promoted first
    });
  });

  describe('first-come-first-serve mode', () => {
    it('should allow any invited person to accept first', () => {
      // In FCFS mode, all invitees start as "invited"
      const invitees = [
        createInvitee('alice@example.com', 'invited', 0),
        createInvitee('bob@example.com', 'invited', 1),
        createInvitee('charlie@example.com', 'invited', 2),
      ];

      const result = processRsvpAction(invitees, 'bob@example.com', 'confirm', 'first-come-first-serve');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
    });

    it('should reject second acceptance after first person accepted', () => {
      const invitees = [
        createInvitee('alice@example.com', 'accepted', 0), // First person accepted
        createInvitee('bob@example.com', 'invited', 1),
        createInvitee('charlie@example.com', 'invited', 2),
      ];

      const result = processRsvpAction(invitees, 'bob@example.com', 'confirm', 'first-come-first-serve');

      expect(result.success).toBe(false);
      expect(result.error).toBe('This event has already been confirmed by another invitee');
    });

    it('should allow third person to accept if they are fastest', () => {
      const invitees = [
        createInvitee('alice@example.com', 'invited', 0),
        createInvitee('bob@example.com', 'invited', 1),
        createInvitee('charlie@example.com', 'invited', 2),
      ];

      // Charlie (priority 2) can accept before Alice (priority 0)
      const result = processRsvpAction(invitees, 'charlie@example.com', 'confirm', 'first-come-first-serve');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
    });

    it('should NOT promote next invitee on decline (everyone already invited)', () => {
      const invitees = [
        createInvitee('alice@example.com', 'invited', 0),
        createInvitee('bob@example.com', 'invited', 1),
        createInvitee('charlie@example.com', 'invited', 2),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'decline', 'first-come-first-serve');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('declined');
      expect(result.shouldPromoteNext).toBe(false);
      expect(result.promotedInvitee).toBeUndefined();
    });

    it('should still allow acceptance after others decline', () => {
      const invitees = [
        createInvitee('alice@example.com', 'declined', 0),
        createInvitee('bob@example.com', 'declined', 1),
        createInvitee('charlie@example.com', 'invited', 2),
      ];

      const result = processRsvpAction(invitees, 'charlie@example.com', 'confirm', 'first-come-first-serve');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
    });

    it('should handle race condition: last person can still accept if no one else did', () => {
      const invitees = [
        createInvitee('alice@example.com', 'declined', 0),
        createInvitee('bob@example.com', 'declined', 1),
        createInvitee('charlie@example.com', 'declined', 2),
        createInvitee('dave@example.com', 'invited', 3),
      ];

      const result = processRsvpAction(invitees, 'dave@example.com', 'confirm', 'first-come-first-serve');

      expect(result.success).toBe(true);
    });
  });
});

describe('calculateEventStatuses', () => {
  const now = new Date('2026-01-14T12:00:00');

  describe('confirmationStatus', () => {
    it('should return "scheduled" when someone accepted', () => {
      const invitees = [
        { status: 'accepted' as const },
        { status: 'pending' as const },
      ];
      const eventTime = new Date('2026-01-15T12:00:00');

      const result = calculateEventStatuses(invitees, eventTime, now);

      expect(result.confirmationStatus).toBe('scheduled');
    });

    it('should return "invited" when no one accepted but invitations sent', () => {
      const invitees = [
        { status: 'invited' as const },
        { status: 'pending' as const },
      ];
      const eventTime = new Date('2026-01-15T12:00:00');

      const result = calculateEventStatuses(invitees, eventTime, now);

      expect(result.confirmationStatus).toBe('invited');
    });

    it('should return "no-show" for past event with no acceptances', () => {
      const invitees = [
        { status: 'declined' as const },
        { status: 'declined' as const },
      ];
      const eventTime = new Date('2026-01-13T12:00:00'); // Past

      const result = calculateEventStatuses(invitees, eventTime, now);

      expect(result.confirmationStatus).toBe('no-show');
    });
  });

  describe('timeStatus', () => {
    it('should return "approaching" when event is within 24 hours', () => {
      const invitees = [{ status: 'invited' as const }];
      const eventTime = new Date('2026-01-14T20:00:00'); // 8 hours from now

      const result = calculateEventStatuses(invitees, eventTime, now);

      expect(result.timeStatus).toBe('approaching');
    });

    it('should return "upcoming" when event is more than 24 hours away', () => {
      const invitees = [{ status: 'invited' as const }];
      const eventTime = new Date('2026-01-20T12:00:00'); // 6 days away

      const result = calculateEventStatuses(invitees, eventTime, now);

      expect(result.timeStatus).toBe('upcoming');
    });

    it('should return "completed" when event has passed', () => {
      const invitees = [{ status: 'accepted' as const }];
      const eventTime = new Date('2026-01-13T12:00:00'); // Yesterday

      const result = calculateEventStatuses(invitees, eventTime, now);

      expect(result.timeStatus).toBe('completed');
    });
  });

  describe('combined statuses', () => {
    it('should return scheduled + approaching for confirmed event within 24 hours', () => {
      const invitees = [{ status: 'accepted' as const }];
      const eventTime = new Date('2026-01-14T18:00:00'); // 6 hours from now

      const result = calculateEventStatuses(invitees, eventTime, now);

      expect(result.confirmationStatus).toBe('scheduled');
      expect(result.timeStatus).toBe('approaching');
    });

    it('should return invited + upcoming for unconfirmed future event', () => {
      const invitees = [
        { status: 'invited' as const },
        { status: 'pending' as const },
      ];
      const eventTime = new Date('2026-01-20T12:00:00');

      const result = calculateEventStatuses(invitees, eventTime, now);

      expect(result.confirmationStatus).toBe('invited');
      expect(result.timeStatus).toBe('upcoming');
    });
  });
});

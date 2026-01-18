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

    it('should return "declined" for past event with all declined invitees', () => {
      const invitees = [
        { status: 'declined' as const },
        { status: 'declined' as const },
      ];
      const eventTime = new Date('2026-01-13T12:00:00'); // Past

      const result = calculateEventStatuses(invitees, eventTime, now);

      expect(result.confirmationStatus).toBe('declined');
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

describe('processRsvpAction with spots', () => {
  const createInvitee = (
    email: string,
    status: 'pending' | 'invited' | 'accepted' | 'declined',
    priority: number
  ) => ({
    id: `id-${email}`,
    email,
    status,
    priority,
    contact_id: `contact-${email}`,
  });

  describe('single spot (default)', () => {
    it('should allow first invitee to accept when spots=1', () => {
      const invitees = [
        createInvitee('alice@example.com', 'invited', 0),
        createInvitee('bob@example.com', 'invited', 1),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'confirm', 'first-come-first-serve', 1);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
      expect(result.isEventFull).toBe(true);
      expect(result.spotsRemaining).toBe(0);
    });

    it('should reject second accept when spots=1', () => {
      const invitees = [
        createInvitee('alice@example.com', 'accepted', 0),
        createInvitee('bob@example.com', 'invited', 1),
      ];

      const result = processRsvpAction(invitees, 'bob@example.com', 'confirm', 'first-come-first-serve', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('This event has already been confirmed by another invitee');
      expect(result.isEventFull).toBe(true);
    });
  });

  describe('multiple spots (doubles/group)', () => {
    it('should allow first invitee to accept when spots=2', () => {
      const invitees = [
        createInvitee('alice@example.com', 'invited', 0),
        createInvitee('bob@example.com', 'invited', 1),
        createInvitee('charlie@example.com', 'invited', 2),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'confirm', 'first-come-first-serve', 2);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
      expect(result.isEventFull).toBe(false);
      expect(result.spotsRemaining).toBe(1);
    });

    it('should allow second invitee to accept when spots=2', () => {
      const invitees = [
        createInvitee('alice@example.com', 'accepted', 0),
        createInvitee('bob@example.com', 'invited', 1),
        createInvitee('charlie@example.com', 'invited', 2),
      ];

      const result = processRsvpAction(invitees, 'bob@example.com', 'confirm', 'first-come-first-serve', 2);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
      expect(result.isEventFull).toBe(true);
      expect(result.spotsRemaining).toBe(0);
    });

    it('should reject third accept when spots=2', () => {
      const invitees = [
        createInvitee('alice@example.com', 'accepted', 0),
        createInvitee('bob@example.com', 'accepted', 1),
        createInvitee('charlie@example.com', 'invited', 2),
      ];

      const result = processRsvpAction(invitees, 'charlie@example.com', 'confirm', 'first-come-first-serve', 2);

      expect(result.success).toBe(false);
      expect(result.error).toBe('This event is full (2 spots filled)');
      expect(result.isEventFull).toBe(true);
    });

    it('should allow 3 accepts when spots=3', () => {
      const invitees = [
        createInvitee('alice@example.com', 'accepted', 0),
        createInvitee('bob@example.com', 'accepted', 1),
        createInvitee('charlie@example.com', 'invited', 2),
        createInvitee('david@example.com', 'invited', 3),
      ];

      const result = processRsvpAction(invitees, 'charlie@example.com', 'confirm', 'first-come-first-serve', 3);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
      expect(result.isEventFull).toBe(true);
      expect(result.spotsRemaining).toBe(0);
    });

    it('should reject 4th accept when spots=3', () => {
      const invitees = [
        createInvitee('alice@example.com', 'accepted', 0),
        createInvitee('bob@example.com', 'accepted', 1),
        createInvitee('charlie@example.com', 'accepted', 2),
        createInvitee('david@example.com', 'invited', 3),
      ];

      const result = processRsvpAction(invitees, 'david@example.com', 'confirm', 'first-come-first-serve', 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe('This event is full (3 spots filled)');
      expect(result.isEventFull).toBe(true);
    });
  });

  describe('spots=5 (maximum)', () => {
    it('should allow 5 accepts when spots=5', () => {
      const invitees = [
        createInvitee('p1@example.com', 'accepted', 0),
        createInvitee('p2@example.com', 'accepted', 1),
        createInvitee('p3@example.com', 'accepted', 2),
        createInvitee('p4@example.com', 'accepted', 3),
        createInvitee('p5@example.com', 'invited', 4),
      ];

      const result = processRsvpAction(invitees, 'p5@example.com', 'confirm', 'first-come-first-serve', 5);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
      expect(result.isEventFull).toBe(true);
      expect(result.spotsRemaining).toBe(0);
    });

    it('should reject 6th accept when spots=5', () => {
      const invitees = [
        createInvitee('p1@example.com', 'accepted', 0),
        createInvitee('p2@example.com', 'accepted', 1),
        createInvitee('p3@example.com', 'accepted', 2),
        createInvitee('p4@example.com', 'accepted', 3),
        createInvitee('p5@example.com', 'accepted', 4),
        createInvitee('p6@example.com', 'invited', 5), // 6th person trying to accept
      ];

      const result = processRsvpAction(invitees, 'p6@example.com', 'confirm', 'first-come-first-serve', 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe('This event is full (5 spots filled)');
      expect(result.isEventFull).toBe(true);
    });
  });

  describe('spots remaining tracking', () => {
    it('should track spots remaining correctly', () => {
      const invitees = [
        createInvitee('alice@example.com', 'invited', 0),
        createInvitee('bob@example.com', 'invited', 1),
        createInvitee('charlie@example.com', 'invited', 2),
        createInvitee('david@example.com', 'invited', 3),
      ];

      // First accept: 4 spots, 0 accepted -> 3 remaining
      const result1 = processRsvpAction(invitees, 'alice@example.com', 'confirm', 'first-come-first-serve', 4);
      expect(result1.spotsRemaining).toBe(3);
      expect(result1.isEventFull).toBe(false);

      // Simulate alice accepted
      invitees[0].status = 'accepted';

      // Second accept: 4 spots, 1 accepted -> 2 remaining
      const result2 = processRsvpAction(invitees, 'bob@example.com', 'confirm', 'first-come-first-serve', 4);
      expect(result2.spotsRemaining).toBe(2);
      expect(result2.isEventFull).toBe(false);

      // Simulate bob accepted
      invitees[1].status = 'accepted';

      // Third accept: 4 spots, 2 accepted -> 1 remaining
      const result3 = processRsvpAction(invitees, 'charlie@example.com', 'confirm', 'first-come-first-serve', 4);
      expect(result3.spotsRemaining).toBe(1);
      expect(result3.isEventFull).toBe(false);

      // Simulate charlie accepted
      invitees[2].status = 'accepted';

      // Fourth accept: 4 spots, 3 accepted -> 0 remaining (full)
      const result4 = processRsvpAction(invitees, 'david@example.com', 'confirm', 'first-come-first-serve', 4);
      expect(result4.spotsRemaining).toBe(0);
      expect(result4.isEventFull).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle declined invitees not counting towards spots', () => {
      const invitees = [
        createInvitee('alice@example.com', 'declined', 0),
        createInvitee('bob@example.com', 'invited', 1),
      ];

      const result = processRsvpAction(invitees, 'bob@example.com', 'confirm', 'first-come-first-serve', 1);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
    });

    it('should handle pending invitees not counting towards spots', () => {
      const invitees = [
        createInvitee('alice@example.com', 'pending', 0),
        createInvitee('bob@example.com', 'invited', 1),
      ];

      const result = processRsvpAction(invitees, 'bob@example.com', 'confirm', 'first-come-first-serve', 1);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
    });

    it('should still reject double-accept from same person', () => {
      const invitees = [
        createInvitee('alice@example.com', 'accepted', 0),
        createInvitee('bob@example.com', 'invited', 1),
      ];

      const result = processRsvpAction(invitees, 'alice@example.com', 'confirm', 'first-come-first-serve', 2);

      expect(result.success).toBe(false);
      expect(result.error).toBe('You have already accepted this invitation');
    });

    it('should work with priority mode and multiple spots', () => {
      const invitees = [
        createInvitee('alice@example.com', 'accepted', 0),
        createInvitee('bob@example.com', 'invited', 1),
        createInvitee('charlie@example.com', 'pending', 2),
      ];

      const result = processRsvpAction(invitees, 'bob@example.com', 'confirm', 'priority', 2);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('accepted');
      expect(result.isEventFull).toBe(true);
    });
  });
});

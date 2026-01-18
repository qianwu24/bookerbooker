import { describe, it, expect } from 'vitest';
import { calculateEventStatuses } from './event-status';
import type { Event } from '../app/types';

// Helper to create a mock event
function createMockEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'test-event-1',
    title: 'Test Event',
    description: 'A test event',
    date: '2026-01-20',
    time: '14:00',
    location: 'Test Location',
    organizer: { email: 'organizer@test.com', name: 'Organizer' },
    invitees: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('calculateEventStatuses', () => {
  // Fixed "now" for consistent testing
  const now = new Date('2026-01-15T12:00:00');

  describe('Confirmation Status', () => {
    describe('scheduled status', () => {
      it('should return "scheduled" when at least one invitee has accepted', () => {
        const event = createMockEvent({
          date: '2026-01-20',
          time: '14:00',
          invitees: [
            { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'accepted' },
            { name: 'Bob', email: 'bob@test.com', priority: 2, status: 'pending' },
          ],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('scheduled');
      });

      it('should return "scheduled" when multiple invitees have accepted', () => {
        const event = createMockEvent({
          date: '2026-01-20',
          time: '14:00',
          invitees: [
            { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'accepted' },
            { name: 'Bob', email: 'bob@test.com', priority: 2, status: 'accepted' },
          ],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('scheduled');
      });

      it('should return "scheduled" for past event if someone accepted', () => {
        const event = createMockEvent({
          date: '2026-01-10', // Past
          time: '14:00',
          invitees: [
            { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'accepted' },
          ],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('scheduled');
      });
    });

    describe('invited status', () => {
      it('should return "invited" for future event with pending invitees', () => {
        const event = createMockEvent({
          date: '2026-01-20',
          time: '14:00',
          invitees: [
            { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'pending' },
          ],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('invited');
      });

      it('should return "invited" for future event with invited invitees', () => {
        const event = createMockEvent({
          date: '2026-01-20',
          time: '14:00',
          invitees: [
            { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'invited' },
          ],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('invited');
      });

      it('should return "invited" for future event with no invitees', () => {
        const event = createMockEvent({
          date: '2026-01-20',
          time: '14:00',
          invitees: [],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('invited');
      });

      it('should return "declined" for future event with only declined invitees', () => {
        const event = createMockEvent({
          date: '2026-01-20',
          time: '14:00',
          invitees: [
            { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'declined' },
            { name: 'Bob', email: 'bob@test.com', priority: 2, status: 'declined' },
          ],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('declined');
      });

      it('should return "invited" for future event with mixed pending and declined', () => {
        const event = createMockEvent({
          date: '2026-01-20',
          time: '14:00',
          invitees: [
            { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'declined' },
            { name: 'Bob', email: 'bob@test.com', priority: 2, status: 'pending' },
          ],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('invited');
      });
    });

    describe('no-show status', () => {
      it('should return "no-show" for past event with no accepted invitees', () => {
        const event = createMockEvent({
          date: '2026-01-10', // Past
          time: '14:00',
          invitees: [
            { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'pending' },
          ],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('no-show');
      });

      it('should return "declined" for past event with all declined invitees', () => {
        const event = createMockEvent({
          date: '2026-01-10', // Past
          time: '14:00',
          invitees: [
            { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'declined' },
            { name: 'Bob', email: 'bob@test.com', priority: 2, status: 'declined' },
          ],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('declined');
      });

      it('should return "no-show" for past event with no invitees', () => {
        const event = createMockEvent({
          date: '2026-01-10', // Past
          time: '14:00',
          invitees: [],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('no-show');
      });

      it('should return "no-show" for past event with invited but not accepted', () => {
        const event = createMockEvent({
          date: '2026-01-10', // Past
          time: '14:00',
          invitees: [
            { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'invited' },
          ],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.confirmationStatus).toBe('no-show');
      });
    });
  });

  describe('Time Status', () => {
    describe('completed status', () => {
      it('should return "completed" for past event', () => {
        const event = createMockEvent({
          date: '2026-01-10', // Past
          time: '14:00',
          invitees: [],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.timeStatus).toBe('completed');
      });

      it('should return "completed" for event earlier today', () => {
        const event = createMockEvent({
          date: '2026-01-15',
          time: '08:00', // Before now (12:00)
          invitees: [],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.timeStatus).toBe('completed');
      });
    });

    describe('approaching status', () => {
      it('should return "approaching" for event within 24 hours', () => {
        const event = createMockEvent({
          date: '2026-01-15',
          time: '20:00', // 8 hours from now (12:00)
          invitees: [],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.timeStatus).toBe('approaching');
      });

      it('should return "approaching" for event exactly 24 hours away', () => {
        const event = createMockEvent({
          date: '2026-01-16',
          time: '12:00', // Exactly 24 hours
          invitees: [],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.timeStatus).toBe('approaching');
      });

      it('should return "approaching" for event tomorrow morning', () => {
        const event = createMockEvent({
          date: '2026-01-16',
          time: '08:00', // 20 hours from now
          invitees: [],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.timeStatus).toBe('approaching');
      });
    });

    describe('upcoming status', () => {
      it('should return "upcoming" for event more than 24 hours away', () => {
        const event = createMockEvent({
          date: '2026-01-20', // 5 days away
          time: '14:00',
          invitees: [],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.timeStatus).toBe('upcoming');
      });

      it('should return "upcoming" for event just over 24 hours away', () => {
        const event = createMockEvent({
          date: '2026-01-16',
          time: '14:00', // 26 hours from now (12:00 + 26 = 14:00 next day)
          invitees: [],
        });

        const result = calculateEventStatuses(event, now);
        expect(result.timeStatus).toBe('upcoming');
      });
    });
  });

  describe('Combined scenarios', () => {
    it('past event with accepted invitee should be scheduled + completed', () => {
      const event = createMockEvent({
        date: '2026-01-10',
        time: '14:00',
        invitees: [
          { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'accepted' },
        ],
      });

      const result = calculateEventStatuses(event, now);
      expect(result.confirmationStatus).toBe('scheduled');
      expect(result.timeStatus).toBe('completed');
    });

    it('future event within 24h with pending invitee should be invited + approaching', () => {
      const event = createMockEvent({
        date: '2026-01-15',
        time: '18:00',
        invitees: [
          { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'pending' },
        ],
      });

      const result = calculateEventStatuses(event, now);
      expect(result.confirmationStatus).toBe('invited');
      expect(result.timeStatus).toBe('approaching');
    });

    it('future event with accepted invitee should be scheduled + upcoming', () => {
      const event = createMockEvent({
        date: '2026-01-20',
        time: '14:00',
        invitees: [
          { name: 'Alice', email: 'alice@test.com', priority: 1, status: 'accepted' },
        ],
      });

      const result = calculateEventStatuses(event, now);
      expect(result.confirmationStatus).toBe('scheduled');
      expect(result.timeStatus).toBe('upcoming');
    });

    it('past event with no invitees should be no-show + completed', () => {
      const event = createMockEvent({
        date: '2026-01-10',
        time: '14:00',
        invitees: [],
      });

      const result = calculateEventStatuses(event, now);
      expect(result.confirmationStatus).toBe('no-show');
      expect(result.timeStatus).toBe('completed');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  getInvitationSms,
  getInviteeConfirmationSms,
  getOrganizerConfirmationSms,
  getOrganizerDeclineSms,
  getInviteeReminderSms,
  getOrganizerReminderSms,
  formatDateForSms,
  formatTimeForSms,
  parseReplyStatus,
  getUnrecognizedReplySms,
  getNoPendingInvitationSms,
  getAlreadyRespondedSms,
  type EventSmsData,
} from './sms-templates';

describe('SMS Templates', () => {
  // Templates expect pre-formatted date/time strings
  const baseEventData: EventSmsData = {
    eventTitle: 'Tennis Match',
    eventDate: 'Tue, Jan 20',  // Pre-formatted by formatDateForSms
    eventTime: '3:00 PM',      // Pre-formatted by formatTimeForSms
    location: 'Central Park Courts',
    organizerName: 'John Doe',
    inviteeName: 'Jane Smith',
  };

  describe('formatDateForSms', () => {
    it('formats date in short format', () => {
      expect(formatDateForSms('2026-01-20')).toBe('Tue, Jan 20');
    });

    it('formats date with different month', () => {
      expect(formatDateForSms('2026-12-25')).toBe('Fri, Dec 25');
    });
  });

  describe('formatTimeForSms', () => {
    it('formats morning time in 12-hour format', () => {
      expect(formatTimeForSms('09:30')).toBe('9:30 AM');
    });

    it('formats afternoon time in 12-hour format', () => {
      expect(formatTimeForSms('15:00')).toBe('3:00 PM');
    });

    it('formats noon correctly', () => {
      expect(formatTimeForSms('12:00')).toBe('12:00 PM');
    });

    it('formats midnight correctly', () => {
      expect(formatTimeForSms('00:00')).toBe('12:00 AM');
    });

    it('formats 11 PM correctly', () => {
      expect(formatTimeForSms('23:45')).toBe('11:45 PM');
    });
  });

  describe('getInvitationSms', () => {
    it('generates invitation with location', () => {
      const sms = getInvitationSms(baseEventData);
      expect(sms).toContain('John Doe invited you to "Tennis Match"');
      expect(sms).toContain('Tue, Jan 20');
      expect(sms).toContain('3:00 PM');
      expect(sms).toContain('at Central Park Courts');
      expect(sms).toContain('Reply Y to confirm, N to decline');
    });

    it('generates invitation without location', () => {
      const sms = getInvitationSms({ ...baseEventData, location: undefined });
      expect(sms).toContain('John Doe invited you to "Tennis Match"');
      expect(sms).not.toContain('at Central Park Courts');
      expect(sms).toContain('Reply Y to confirm, N to decline');
    });

    it('invitation is reasonably short for SMS', () => {
      const sms = getInvitationSms(baseEventData);
      // Should be under 320 chars (2 SMS segments max)
      expect(sms.length).toBeLessThan(320);
    });
  });

  describe('getInviteeConfirmationSms', () => {
    it('generates confirmation with location', () => {
      const sms = getInviteeConfirmationSms(baseEventData);
      expect(sms).toContain('Confirmed!');
      expect(sms).toContain('"Tennis Match"');
      expect(sms).toContain('Tue, Jan 20');
      expect(sms).toContain('3:00 PM');
      expect(sms).toContain('at Central Park Courts');
      expect(sms).toContain('See you there!');
    });

    it('generates confirmation without location', () => {
      const sms = getInviteeConfirmationSms({ ...baseEventData, location: undefined });
      expect(sms).toContain("You're confirmed");
      expect(sms).not.toContain('at Central Park Courts');
    });

    it('confirmation is under 160 chars', () => {
      const sms = getInviteeConfirmationSms(baseEventData);
      expect(sms.length).toBeLessThan(200);
    });
  });

  describe('getOrganizerConfirmationSms', () => {
    it('generates organizer notification with invitee name', () => {
      const sms = getOrganizerConfirmationSms(baseEventData);
      expect(sms).toContain('Jane Smith confirmed');
      expect(sms).toContain('"Tennis Match"');
      expect(sms).toContain('Tue, Jan 20');
    });

    it('falls back to "Someone" when no invitee name', () => {
      const sms = getOrganizerConfirmationSms({ ...baseEventData, inviteeName: undefined });
      expect(sms).toContain('Someone confirmed');
    });
  });

  describe('getOrganizerDeclineSms', () => {
    it('generates decline notification with invitee name', () => {
      const sms = getOrganizerDeclineSms(baseEventData);
      expect(sms).toContain('Jane Smith declined');
      expect(sms).toContain('"Tennis Match"');
    });

    it('falls back to "Someone" when no invitee name', () => {
      const sms = getOrganizerDeclineSms({ ...baseEventData, inviteeName: undefined });
      expect(sms).toContain('Someone declined');
    });
  });

  describe('getInviteeReminderSms', () => {
    it('generates reminder with location', () => {
      const sms = getInviteeReminderSms(baseEventData);
      expect(sms).toContain('Reminder');
      expect(sms).toContain('"Tennis Match"');
      expect(sms).toContain('starts in 1 hour');
      expect(sms).toContain('3:00 PM');
      expect(sms).toContain('at Central Park Courts');
    });

    it('generates reminder without location', () => {
      const sms = getInviteeReminderSms({ ...baseEventData, location: undefined });
      expect(sms).toContain('starts in 1 hour');
      expect(sms).not.toContain('at Central Park Courts');
    });
  });

  describe('getOrganizerReminderSms', () => {
    it('generates organizer reminder with location', () => {
      const sms = getOrganizerReminderSms(baseEventData);
      expect(sms).toContain('Reminder');
      expect(sms).toContain('Your event');
      expect(sms).toContain('"Tennis Match"');
      expect(sms).toContain('starts in 1 hour');
    });
  });
});

describe('parseReplyStatus', () => {
  describe('accepts variations of Yes', () => {
    const yesVariations = ['Y', 'y', 'YES', 'yes', 'Yes', 'YEP', 'yep', 'YA', 'YEAH', 'YUP', 'CONFIRM', 'OK', 'OKAY', 'SURE'];
    
    yesVariations.forEach((input) => {
      it(`parses "${input}" as accepted`, () => {
        expect(parseReplyStatus(input)).toBe('accepted');
      });
    });

    it('handles whitespace around yes', () => {
      expect(parseReplyStatus('  Y  ')).toBe('accepted');
      expect(parseReplyStatus('\nyes\n')).toBe('accepted');
    });
  });

  describe('accepts variations of No', () => {
    const noVariations = ['N', 'n', 'NO', 'no', 'No', 'NOPE', 'nope', 'NAH', 'DECLINE', 'CANCEL', 'CANT', "CAN'T", 'CANNOT'];
    
    noVariations.forEach((input) => {
      it(`parses "${input}" as declined`, () => {
        expect(parseReplyStatus(input)).toBe('declined');
      });
    });

    it('handles whitespace around no', () => {
      expect(parseReplyStatus('  N  ')).toBe('declined');
      expect(parseReplyStatus('\tno\t')).toBe('declined');
    });
  });

  describe('returns null for unrecognized inputs', () => {
    const invalidInputs = ['maybe', 'perhaps', 'hello', '123', '', 'yesno', 'nyes', 'y n', 'what'];
    
    invalidInputs.forEach((input) => {
      it(`returns null for "${input}"`, () => {
        expect(parseReplyStatus(input)).toBeNull();
      });
    });
  });
});

describe('Error response messages', () => {
  describe('getUnrecognizedReplySms', () => {
    it('returns helpful error message', () => {
      const sms = getUnrecognizedReplySms();
      expect(sms).toContain("didn't understand");
      expect(sms).toContain('Reply Y to confirm');
      expect(sms).toContain('N to decline');
    });
  });

  describe('getNoPendingInvitationSms', () => {
    it('returns no pending invitation message', () => {
      const sms = getNoPendingInvitationSms();
      expect(sms).toContain("don't have any pending");
      expect(sms).toContain('invitation');
    });
  });

  describe('getAlreadyRespondedSms', () => {
    it('returns already confirmed message', () => {
      const sms = getAlreadyRespondedSms('accepted');
      expect(sms).toContain('already confirmed');
    });

    it('returns already declined message', () => {
      const sms = getAlreadyRespondedSms('declined');
      expect(sms).toContain('already declined');
    });
  });
});

describe('SMS length constraints', () => {
  const longEventData: EventSmsData = {
    eventTitle: 'Very Long Event Title That Goes On And On',
    eventDate: '2026-12-25',
    eventTime: '14:30',
    location: 'Some Very Long Location Name That Is Way Too Long',
    organizerName: 'Organization With Long Name',
    inviteeName: 'Person With A Very Long Name',
  };

  it('invitation stays within reasonable length', () => {
    const sms = getInvitationSms(longEventData);
    // 3 SMS segments = 480 chars max
    expect(sms.length).toBeLessThan(480);
  });

  it('confirmation stays within reasonable length', () => {
    const sms = getInviteeConfirmationSms(longEventData);
    expect(sms.length).toBeLessThan(320);
  });

  it('organizer notification stays within reasonable length', () => {
    const sms = getOrganizerConfirmationSms(longEventData);
    expect(sms.length).toBeLessThan(240);
  });
});

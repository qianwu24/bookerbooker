export type InviteeStatus = 'pending' | 'invited' | 'accepted' | 'declined';

export type InviteMode = 'priority' | 'first-come-first-serve';

export type EventStatus = 'completed' | 'no-show' | 'approaching' | 'future';

export interface Invitee {
  email: string;
  name: string;
  phone?: string; // Optional phone number for SMS notifications
  priority: number; // Lower number = higher priority
  status: InviteeStatus;
  invitedAt?: string; // Timestamp when this person was invited
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  organizer: {
    email: string;
    name: string;
  };
  invitees: Invitee[];
  inviteMode: InviteMode; // 'priority' or 'first-come-first-serve'
  autoPromoteInterval?: number; // Minutes to wait before auto-promoting to next invitee (priority mode only)
  sendOrganizerCalendarInvite: boolean; // Send calendar invite to organizer
  sendInviteesCalendarInvite: boolean; // Send calendar invites to invitees
  notifyByPhone: boolean; // Send SMS notifications to invitees with phone numbers
  createdAt: string;
}

export interface Contact {
  email: string;
  name: string;
  phone?: string; // Optional phone number
  addedAt?: string; // When they were first added to contacts
  eventCount?: number; // Number of events they've been invited to
  lastInvitedAt?: string; // Last time they were invited to an event
  createdAt?: string;
  updatedAt?: string;
}
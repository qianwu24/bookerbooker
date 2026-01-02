export type InviteeStatus = 'pending' | 'invited' | 'accepted' | 'declined';

export interface Invitee {
  email: string;
  name: string;
  priority: number; // Lower number = higher priority
  status: InviteeStatus;
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
  createdAt: string;
}

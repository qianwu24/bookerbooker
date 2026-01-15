import { EventCard } from './event-card';
import type { Event, InviteeStatus, EventStatus } from '../types';

interface EventListProps {
  events: Event[];
  currentUser: { email: string; name: string };
  onUpdateInviteeStatus: (
    eventId: string,
    inviteeEmail: string,
    status: InviteeStatus
  ) => void;
  onCancelEvent: (eventId: string) => void;
}

// Helper function to calculate event status
const calculateEventStatus = (event: Event): EventStatus => {
  const eventDateTime = new Date(`${event.date}T${event.time}`);
  const now = new Date();
  const hoursUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  // Check if event has passed
  const hasPassed = eventDateTime < now;
  
  // Check if anyone accepted (event is scheduled/confirmed)
  const hasAccepted = event.invitees.some(inv => inv.status === 'accepted');
  
  if (hasPassed) {
    return hasAccepted ? 'completed' : 'no-show';
  }
  
  // Future events - check if scheduled (has confirmed attendee)
  if (hasAccepted) {
    return 'scheduled';
  }
  
  if (hoursUntilEvent <= 24) {
    return 'approaching';
  }
  
  return 'future';
};

export function EventList({
  events,
  currentUser,
  onUpdateInviteeStatus,
  onCancelEvent,
}: EventListProps) {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div>
      {sortedEvents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">
            No events yet. Create your first event!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedEvents.map((event) => {
            const eventStatus = calculateEventStatus(event);
            return (
              <EventCard
                key={event.id}
                event={event}
                currentUser={currentUser}
                onUpdateInviteeStatus={onUpdateInviteeStatus}
                onCancelEvent={onCancelEvent}
                eventStatus={eventStatus}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

import { EventCard } from './event-card';
import { calculateEventStatuses } from '../../lib/event-status';
import type { Event, InviteeStatus } from '../types';

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
            const { confirmationStatus, timeStatus } = calculateEventStatuses(event);
            return (
              <EventCard
                key={event.id}
                event={event}
                currentUser={currentUser}
                onUpdateInviteeStatus={onUpdateInviteeStatus}
                onCancelEvent={onCancelEvent}
                confirmationStatus={confirmationStatus}
                timeStatus={timeStatus}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

import { EventCard } from './event-card';
import type { Event, InviteeStatus, ConfirmationStatus, TimeStatus } from '../types';

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

// Helper function to calculate event statuses (both confirmation and time)
const calculateEventStatuses = (event: Event): { confirmationStatus: ConfirmationStatus; timeStatus: TimeStatus } => {
  const eventDateTime = new Date(`${event.date}T${event.time}`);
  const now = new Date();
  const hoursUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  const hasPassed = eventDateTime < now;
  const hasAccepted = event.invitees.some(inv => inv.status === 'accepted');
  const hasInvited = event.invitees.some(inv => inv.status === 'invited');
  
  // Confirmation status: scheduled (accepted) > invited > no-show
  let confirmationStatus: ConfirmationStatus;
  if (hasAccepted) {
    confirmationStatus = 'scheduled';
  } else if (hasInvited || event.invitees.some(inv => inv.status === 'pending')) {
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

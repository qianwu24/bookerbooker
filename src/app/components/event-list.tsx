import { useState } from 'react';
import { EventCard } from './event-card';
import type { Event, InviteeStatus } from '../types';

interface EventListProps {
  events: Event[];
  currentUser: { email: string; name: string };
  onUpdateInviteeStatus: (
    eventId: string,
    inviteeEmail: string,
    status: InviteeStatus
  ) => void;
}

export function EventList({
  events,
  currentUser,
  onUpdateInviteeStatus,
}: EventListProps) {
  const [filter, setFilter] = useState<'all' | 'organized' | 'invited'>('all');

  const organizedEvents = events.filter(
    (event) => event.organizer.email === currentUser.email
  );

  const invitedEvents = events.filter((event) =>
    event.invitees.some((inv) => inv.email === currentUser.email)
  );

  const filteredEvents =
    filter === 'organized'
      ? organizedEvents
      : filter === 'invited'
      ? invitedEvents
      : events;

  const sortedEvents = [...filteredEvents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2>Events</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All ({events.length})
          </button>
          <button
            onClick={() => setFilter('organized')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'organized'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Organized ({organizedEvents.length})
          </button>
          <button
            onClick={() => setFilter('invited')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'invited'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Invited ({invitedEvents.length})
          </button>
        </div>
      </div>

      {sortedEvents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">
            {filter === 'all'
              ? 'No events yet. Create your first event!'
              : filter === 'organized'
              ? "You haven't organized any events yet."
              : "You haven't been invited to any events yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              currentUser={currentUser}
              onUpdateInviteeStatus={onUpdateInviteeStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

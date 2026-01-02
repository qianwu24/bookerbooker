import { Calendar, Clock, MapPin, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Event, InviteeStatus } from '../types';

interface EventCardProps {
  event: Event;
  currentUser: { email: string; name: string };
  onUpdateInviteeStatus: (
    eventId: string,
    inviteeEmail: string,
    status: InviteeStatus
  ) => void;
}

export function EventCard({
  event,
  currentUser,
  onUpdateInviteeStatus,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const isOrganizer = event.organizer.email === currentUser.email;
  const currentUserInvitee = event.invitees.find(
    (inv) => inv.email === currentUser.email
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: InviteeStatus) => {
    switch (status) {
      case 'invited':
        return 'bg-blue-100 text-blue-700';
      case 'accepted':
        return 'bg-green-100 text-green-700';
      case 'declined':
        return 'bg-red-100 text-red-700';
      case 'pending':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: InviteeStatus) => {
    switch (status) {
      case 'invited':
        return 'Invited';
      case 'accepted':
        return 'Accepted';
      case 'declined':
        return 'Declined';
      case 'pending':
        return 'In Queue';
      default:
        return status;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="mb-2">{event.title}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <User className="w-4 h-4" />
              <span>
                Organized by{' '}
                {isOrganizer ? 'You' : event.organizer.name}
              </span>
            </div>
          </div>
          {currentUserInvitee && (
            <span
              className={`px-3 py-1 rounded-full text-sm ${getStatusColor(
                currentUserInvitee.status
              )}`}
            >
              {getStatusLabel(currentUserInvitee.status)}
            </span>
          )}
        </div>

        {event.description && (
          <p className="text-gray-600 mb-4">{event.description}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>{event.time}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
              <MapPin className="w-4 h-4" />
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {/* Response Actions for Invitees */}
        {currentUserInvitee && currentUserInvitee.status === 'invited' && (
          <div className="flex gap-3 mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex-1">
              <p className="text-sm mb-2">
                You've been invited to this event!
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  onUpdateInviteeStatus(event.id, currentUser.email, 'accepted')
                }
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Accept
              </button>
              <button
                onClick={() =>
                  onUpdateInviteeStatus(event.id, currentUser.email, 'declined')
                }
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Invitees List */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between w-full text-sm text-gray-700 hover:text-gray-900 transition-colors"
          >
            <span>
              Priority Invitees ({event.invitees.length})
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              {event.invitees
                .sort((a, b) => a.priority - b.priority)
                .map((invitee, index) => (
                  <div
                    key={invitee.email}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center justify-center min-w-[2rem] h-8 bg-indigo-600 text-white rounded-full text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{invitee.name}</p>
                      <p className="text-xs text-gray-500">{invitee.email}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs ${getStatusColor(
                        invitee.status
                      )}`}
                    >
                      {getStatusLabel(invitee.status)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

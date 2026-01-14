import { Calendar, Clock, MapPin, User, ChevronDown, ChevronUp, Users, Zap, Timer, Trash2, CheckCircle, XCircle, AlertCircle, CalendarDays } from 'lucide-react';
import { useState } from 'react';
import type { Event, InviteeStatus, EventStatus } from '../types';

interface EventCardProps {
  event: Event;
  currentUser: { email: string; name: string };
  onUpdateInviteeStatus: (
    eventId: string,
    inviteeEmail: string,
    status: InviteeStatus
  ) => void;
  onCancelEvent?: (eventId: string) => void;
  eventStatus: EventStatus;
}

export function EventCard({
  event,
  currentUser,
  onUpdateInviteeStatus,
  onCancelEvent,
  eventStatus,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const isOrganizer = event.organizer.email === currentUser.email;
  const currentUserInvitee = event.invitees.find(
    (inv) => inv.email === currentUser.email
  );
  const isAcceptedByCurrentUser = currentUserInvitee?.status === 'accepted';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    // timeStr is in HH:MM format (24-hour)
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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

  // Get card styling based on event status
  const getCardStyle = () => {
    if (isAcceptedByCurrentUser) {
      return 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200 shadow-sm';
    }
    switch (eventStatus) {
      case 'completed':
        return 'border-green-300 bg-green-50/30';
      case 'no-show':
        return 'border-gray-300 bg-gray-50 opacity-75';
      case 'approaching':
        return 'border-orange-300 bg-orange-50/30';
      case 'future':
      default:
        return 'border-gray-200 bg-white';
    }
  };

  // Get status badge
  const getStatusBadge = () => {
    if (isAcceptedByCurrentUser) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium shadow-inner">
          <CheckCircle className="w-4 h-4" />
          <span>You're confirmed</span>
        </div>
      );
    }
    switch (eventStatus) {
      case 'completed':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            <span>Completed</span>
          </div>
        );
      case 'no-show':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">
            <XCircle className="w-4 h-4" />
            <span>No Show</span>
          </div>
        );
      case 'approaching':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            <span>Approaching</span>
          </div>
        );
      case 'future':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
            <CalendarDays className="w-4 h-4" />
            <span>Upcoming</span>
          </div>
        );
    }
  };

  return (
    <div className={`rounded-xl shadow-sm border overflow-hidden ${getCardStyle()}`}>
      <div className="p-6">
        {/* Event Status Badge */}
        <div className="mb-4">
          {getStatusBadge()}
        </div>

        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="mb-0">{event.title}</h3>
              {/* Invite Mode Badge */}
              {event.inviteMode === 'first-come-first-serve' ? (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  First-Come
                </span>
              ) : (
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Priority
                </span>
              )}
            </div>
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
            <span>{formatTime(event.time)}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
              <MapPin className="w-4 h-4" />
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {/* Auto-Promote Interval Display - only show for priority mode */}
        {event.inviteMode === 'priority' && event.autoPromoteInterval && (
          <div className="mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-2 text-sm text-indigo-900">
              <Timer className="w-4 h-4 text-indigo-600" />
              <span>
                <span className="font-semibold">Auto-Promote Timer:</span> Next person gets invited after {event.autoPromoteInterval} {event.autoPromoteInterval === 1 ? 'minute' : 'minutes'} of no response
              </span>
            </div>
          </div>
        )}

        {/* Calendar Invite Settings Display - only show for organizer in expanded view */}
        {isOrganizer && expanded && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 text-sm text-green-900 mb-2">
              <Calendar className="w-4 h-4 text-green-600" />
              <span className="font-semibold">Calendar Invites:</span>
            </div>
            <div className="space-y-1 ml-6">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className={`w-2 h-2 rounded-full ${event.sendOrganizerCalendarInvite ? 'bg-green-600' : 'bg-gray-400'}`}></div>
                <span>{event.sendOrganizerCalendarInvite ? '✓' : '✗'} Send to organizer (you)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className={`w-2 h-2 rounded-full ${event.sendInviteesCalendarInvite ? 'bg-green-600' : 'bg-gray-400'}`}></div>
                <span>{event.sendInviteesCalendarInvite ? '✓' : '✗'} Send to invitees</span>
              </div>
            </div>
          </div>
        )}

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
              {event.inviteMode === 'first-come-first-serve' ? 'Invitees' : 'Priority Invitees'} ({event.invitees.length})
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
                    {/* Only show priority number if in priority mode */}
                    {event.inviteMode !== 'first-come-first-serve' && (
                      <div className="flex items-center justify-center min-w-[2rem] h-8 bg-indigo-600 text-white rounded-full text-sm">
                        {index + 1}
                      </div>
                    )}
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

        {/* Cancel Event Button - only show for organizer */}
        {isOrganizer && onCancelEvent && (
          <button
            onClick={() => onCancelEvent(event.id)}
            className="mt-4 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center justify-center gap-2 ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Cancel Event
          </button>
        )}
      </div>
    </div>
  );
}
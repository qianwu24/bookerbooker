import { useState, useEffect } from 'react';
import { Calendar, LogOut, Plus, User } from 'lucide-react';
import { CreateEvent } from './create-event';
import { EventList } from './event-list';
import { API_BASE_URL } from '../utils/supabase-client';
import type { Event, InviteeStatus } from '../types';

interface DashboardProps {
  user: { email: string; name: string; picture: string };
  accessToken: string;
  onLogout: () => void;
}

export function Dashboard({ user, accessToken, onLogout }: DashboardProps) {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/events`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('Error fetching events:', await response.text());
        return;
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (eventData: Omit<Event, 'id' | 'organizer' | 'createdAt'>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Error creating event:', error);
        alert('Failed to create event. Please try again.');
        return;
      }

      const data = await response.json();
      setEvents((prevEvents) => [data.event, ...prevEvents]);
      setView('list');
    } catch (error) {
      console.error('Error creating event:', error);
      alert('An error occurred while creating the event.');
    }
  };

  const handleUpdateInviteeStatus = async (
    eventId: string,
    inviteeEmail: string,
    status: InviteeStatus
  ) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/events/${eventId}/invitees/${encodeURIComponent(inviteeEmail)}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Error updating invitee status:', error);
        alert('Failed to update status. Please try again.');
        return;
      }

      const data = await response.json();
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === eventId ? data.event : event
        )
      );
    } catch (error) {
      console.error('Error updating invitee status:', error);
      alert('An error occurred while updating the status.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-indigo-600">Booker</h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
                <div className="hidden sm:block">
                  <p className="text-sm">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-4">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-3 border-b-2 transition-colors ${
                view === 'list'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              My Events
            </button>
            <button
              onClick={() => setView('create')}
              className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-2 ${
                view === 'create'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              Create Event
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'list' ? (
          <EventList
            events={events}
            currentUser={user}
            onUpdateInviteeStatus={handleUpdateInviteeStatus}
          />
        ) : (
          <CreateEvent
            currentUser={user}
            onCreateEvent={handleCreateEvent}
            onCancel={() => setView('list')}
          />
        )}
      </main>
    </div>
  );
}
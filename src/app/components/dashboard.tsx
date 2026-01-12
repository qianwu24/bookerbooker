import { useState, useEffect } from 'react';
import { Calendar, LogOut, Plus, User, X, Filter, Users } from 'lucide-react';
import { CreateEvent } from './create-event';
import { EventList } from './event-list';
import { ContactList } from './contact-list';
import { API_BASE_URL } from '../utils/supabase-client';
import { supabase } from '../utils/supabase-client';
import { BookerLogo } from './booker-logo';
import type { Event, InviteeStatus, Contact } from '../types';

interface DashboardProps {
  user: { id: string; email: string; name: string; picture: string };
  accessToken: string;
  onLogout: () => void;
}

export function Dashboard({ user, accessToken, onLogout }: DashboardProps) {
  const [view, setView] = useState<'list' | 'create' | 'contacts'>('list');
  const [events, setEvents] = useState<Event[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<'all' | 'today' | 'tomorrow' | 'week' | 'past'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [showInviteeFilter, setShowInviteeFilter] = useState(false);
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);

  // Helper function to get fresh access token
  const getFreshToken = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log('🔍 Session check:', { 
      hasSession: !!session, 
      hasToken: !!session?.access_token,
      tokenPreview: session?.access_token?.substring(0, 30),
      error: error?.message 
    });
    
    if (error || !session) {
      console.error('❌ Error getting session:', error);
      throw new Error('No valid session');
    }
    
    console.log('✅ Fresh token obtained');
    return session.access_token;
  };

  const normalizeEvent = (rawEvent: any): Event => {
    const invitees = (rawEvent.invitees || []).map((inv: any) => ({
      email: inv.email,
      name: inv.name,
      phone: inv.phone,
      priority: inv.priority ?? 0,
      status: inv.status as InviteeStatus,
      invitedAt: inv.invitedAt ?? inv.created_at,
    }));

    return {
      id: rawEvent.id,
      title: rawEvent.title,
      description: rawEvent.description || '',
      date: rawEvent.date,
      time: rawEvent.time,
      location: rawEvent.location || '',
      organizer: rawEvent.organizer || { email: user.email, name: user.name },
      invitees,
      inviteMode: rawEvent.inviteMode || 'priority',
      autoPromoteInterval: rawEvent.autoPromoteInterval,
      sendOrganizerCalendarInvite: rawEvent.sendOrganizerCalendarInvite ?? true,
      sendInviteesCalendarInvite: rawEvent.sendInviteesCalendarInvite ?? true,
      notifyByPhone: rawEvent.notifyByPhone ?? false,
      createdAt: rawEvent.createdAt || rawEvent.created_at || new Date().toISOString(),
    };
  };

  useEffect(() => {
    console.log('🚀 Dashboard mounted, user:', user.email);
    console.log('📦 Initial accessToken prop:', accessToken?.substring(0, 30));

    fetchEvents();
    fetchContacts();
    testBackendConnection();
  }, []);

  // Test backend connectivity
  const testBackendConnection = async () => {
    try {
      console.log('🔗 Testing backend connection...');
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      console.log('✅ Backend connected:', data);
    } catch (error) {
      console.error('❌ Backend connection failed:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      console.log('📥 Fetching events...');
      const freshToken = await getFreshToken();
      console.log('🔑 Using token for fetch:', freshToken.substring(0, 30) + '...');
      
      const response = await fetch(`${API_BASE_URL}/events`, {
        headers: {
          'Authorization': `Bearer ${freshToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching events - Status:', response.status, 'Error:', errorText);
        return;
      }

      const data = await response.json();
      const normalized = (data.events || []).map((evt: any) => normalizeEvent(evt));
      setEvents(normalized);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      console.log('📒 Fetching contacts...');
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('owner_id', user.id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching contacts:', error.message);
        return;
      }

      const mapped = (data || []).map((c) => ({
        email: c.email,
        name: c.name || c.email,
        phone: c.phone || undefined,
        addedAt: c.created_at,
        lastInvitedAt: c.updated_at || c.created_at,
        eventCount: 0,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));

      setContacts(mapped);
    } catch (error) {
      console.error('Unexpected error fetching contacts:', error);
    }
  };

  // Update contacts based on invitees in an event
  const updateContactsFromEvent = async (eventData: Omit<Event, 'id' | 'organizer' | 'createdAt'>) => {
    try {
      const records = eventData.invitees.map((invitee) => ({
        email: invitee.email,
        owner_id: user.id,
        name: invitee.name,
        phone: invitee.phone,
      }));

      const { error } = await supabase.from('contacts').upsert(records, { onConflict: 'email' });
      if (error) {
        console.error('Error upserting contacts:', error.message);
      }

      await fetchContacts();
    } catch (error) {
      console.error('Unexpected error updating contacts:', error);
    }
  };

  // Delete a contact
  const handleDeleteContact = (email: string) => {
    const performDelete = async () => {
      try {
        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('email', email)
          .eq('owner_id', user.id);

        if (error) {
          console.error('Error deleting contact:', error.message);
          alert('Failed to delete contact.');
          return;
        }

        setContacts((prev) => prev.filter((c) => c.email.toLowerCase() !== email.toLowerCase()));
        console.log('✅ Contact deleted:', email);
      } catch (error) {
        console.error('Unexpected error deleting contact:', error);
        alert('An error occurred while deleting the contact.');
      }
    };

    performDelete();
  };

  // Cancel an event with confirmation
  const handleCancelEvent = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const confirmed = window.confirm(
      `Are you sure you want to cancel "${event.title}"?\n\n` +
      `This will permanently delete the event and notify all invitees.\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    const performDelete = async () => {
      try {
        const freshToken = await getFreshToken();
        const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${freshToken}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error deleting event:', errorText);
          alert('Failed to delete the event. Please try again.');
          return;
        }

        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        console.log('✅ Event cancelled on backend:', eventId);
      } catch (error) {
        console.error('Error cancelling event:', error);
        alert('An error occurred while deleting the event.');
      }
    };

    performDelete();
  };

  const handleCreateEvent = async (eventData: Omit<Event, 'id' | 'organizer' | 'createdAt'>) => {
    // Update contacts first (client-side address book)
    await updateContactsFromEvent(eventData);

    try {
      const freshToken = await getFreshToken();
      console.log('Creating event with token:', freshToken ? 'Token exists' : 'No token');
      
      const response = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${freshToken}`,
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Error creating event - Status:', response.status, 'Error:', error);
        alert('Failed to create event. Please try again.');
        return;
      }

      const data = await response.json();
      const normalized = normalizeEvent({ ...data.event, ...eventData });
      setEvents((prevEvents) => [normalized, ...prevEvents]);
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
      const freshToken = await getFreshToken();
      const response = await fetch(
        `${API_BASE_URL}/events/${eventId}/invitees/${encodeURIComponent(inviteeEmail)}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${freshToken}`,
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
      const normalized = normalizeEvent(data.event);
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === eventId ? { ...normalized, inviteMode: event.inviteMode ?? normalized.inviteMode } : event
        )
      );
    } catch (error) {
      console.error('Error updating invitee status:', error);
      alert('An error occurred while updating the status.');
    }
  };

  // Get today's date string in YYYY-MM-DD format
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get tomorrow's date string
  const getTomorrowString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  // Get this week's date range (Sunday to Saturday)
  const getThisWeekRange = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Start of week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    
    // End of week (Saturday)
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - dayOfWeek));
    
    return {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0],
    };
  };

  // Count events for each quick filter
  const countEventsByFilter = () => {
    const todayStr = getTodayString();
    const tomorrowStr = getTomorrowString();
    const weekRange = getThisWeekRange();
    const today = new Date();
    
    return {
      today: events.filter(e => e.date === todayStr).length,
      tomorrow: events.filter(e => e.date === tomorrowStr).length,
      week: events.filter(e => e.date >= weekRange.start && e.date <= weekRange.end).length,
      past: events.filter(e => new Date(e.date) < today).length,
    };
  };

  // Get all unique invitees from all events
  const getAllInvitees = () => {
    const inviteeMap = new Map<string, { email: string; name: string }>();
    
    events.forEach(event => {
      event.invitees.forEach(invitee => {
        if (!inviteeMap.has(invitee.email)) {
          inviteeMap.set(invitee.email, {
            email: invitee.email,
            name: invitee.name,
          });
        }
      });
    });
    
    return Array.from(inviteeMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  };

  // Toggle invitee selection
  const toggleInviteeSelection = (email: string) => {
    setSelectedInvitees(prev => {
      if (prev.includes(email)) {
        return prev.filter(e => e !== email);
      } else {
        return [...prev, email];
      }
    });
  };

  // Clear invitee filter
  const clearInviteeFilter = () => {
    setSelectedInvitees([]);
  };

  // Filter events based on quick filter selection
  const getFilteredEventsByQuickFilter = () => {
    let eventsToFilter = events;

    // Apply date filtering
    if (startDate || endDate) {
      // Date range filter is active
      eventsToFilter = eventsToFilter.filter(event => {
        try {
          const eventDate = event.date;
          if (!eventDate) return false;
          
          if (startDate && !endDate) {
            return eventDate >= startDate;
          }
          
          if (!startDate && endDate) {
            return eventDate <= endDate;
          }
          
          return eventDate >= startDate && eventDate <= endDate;
        } catch (error) {
          return false;
        }
      });
    } else {
      // Quick filter is active
      switch (selectedQuickFilter) {
        case 'today':
          eventsToFilter = eventsToFilter.filter(e => e.date === getTodayString());
          break;
        case 'tomorrow':
          eventsToFilter = eventsToFilter.filter(e => e.date === getTomorrowString());
          break;
        case 'week':
          const weekRange = getThisWeekRange();
          eventsToFilter = eventsToFilter.filter(e => e.date >= weekRange.start && e.date <= weekRange.end);
          break;
        case 'past':
          const today = new Date();
          eventsToFilter = eventsToFilter.filter(e => new Date(e.date) < today);
          break;
        default:
          // 'all' - no filtering
          break;
      }
    }

    // Apply invitee filtering
    if (selectedInvitees.length > 0) {
      eventsToFilter = eventsToFilter.filter(event => 
        event.invitees.some(invitee => selectedInvitees.includes(invitee.email))
      );
    }

    return eventsToFilter;
  };

  const filteredEvents = getFilteredEventsByQuickFilter();

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedDate(null);
    setStartDate('');
    setEndDate('');
  };

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const dateOnly = date.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      if (dateOnly === todayStr) return 'Today';
      if (dateOnly === tomorrowStr) return 'Tomorrow';
      
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookerLogo className="w-8 h-8 text-indigo-600" />
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
            <button
              onClick={() => setView('contacts')}
              className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-2 ${
                view === 'contacts'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4" />
              Contacts
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'list' && events.length > 0 && (
          <div className="mb-6">
            {/* Quick Date Filters with Date Range Button */}
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Filters</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Invitee Filter Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowInviteeFilter(!showInviteeFilter)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    Filter by Invitee
                    {selectedInvitees.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                        {selectedInvitees.length}
                      </span>
                    )}
                  </button>

                  {/* Invitee Filter Dropdown */}
                  {showInviteeFilter && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 w-96 max-h-96 overflow-hidden z-50">
                      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-semibold text-gray-900">Filter by Invitees</h3>
                          </div>
                          <button
                            onClick={() => setShowInviteeFilter(false)}
                            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <X className="w-5 h-5 text-gray-600" />
                          </button>
                        </div>
                        {selectedInvitees.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {selectedInvitees.length} invitee{selectedInvitees.length !== 1 ? 's' : ''} selected
                          </p>
                        )}
                      </div>

                      <div className="overflow-y-auto max-h-64 p-4">
                        {getAllInvitees().length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-8">
                            No invitees found in your events
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {getAllInvitees().map((invitee) => (
                              <button
                                key={invitee.email}
                                onClick={() => toggleInviteeSelection(invitee.email)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${ selectedInvitees.includes(invitee.email)
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                    selectedInvitees.includes(invitee.email)
                                      ? 'border-indigo-600 bg-indigo-600'
                                      : 'border-gray-300'
                                  }`}>
                                    {selectedInvitees.includes(invitee.email) && (
                                      <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M5 13l4 4L19 7"></path>
                                      </svg>
                                    )}
                                  </div>
                                  <div className="text-left">
                                    <p className="text-sm font-medium text-gray-900">
                                      {invitee.name}
                                    </p>
                                    <p className="text-xs text-gray-500">{invitee.email}</p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
                        <button
                          onClick={() => {
                            clearInviteeFilter();
                            setShowInviteeFilter(false);
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => setShowInviteeFilter(false)}
                          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Date Range Filter Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    <Filter className="w-4 h-4" />
                    Date Range
                    {(startDate || endDate) && (
                      <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                        Active
                      </span>
                    )}
                  </button>

                  {/* Date Range Picker Dropdown */}
                  {showDateRangePicker && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-6 z-50">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-indigo-600" />
                          <h3 className="font-semibold text-gray-900">Select Date Range</h3>
                        </div>
                        <button
                          onClick={() => setShowDateRangePicker(false)}
                          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label htmlFor="modal-start-date" className="block text-sm text-gray-600 mb-2">
                            Start Date
                          </label>
                          <input
                            id="modal-start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                              setStartDate(e.target.value);
                              setSelectedDate(null);
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                          />
                        </div>

                        <div>
                          <label htmlFor="modal-end-date" className="block text-sm text-gray-600 mb-2">
                            End Date
                          </label>
                          <input
                            id="modal-end-date"
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                              setEndDate(e.target.value);
                              setSelectedDate(null);
                            }}
                            min={startDate || undefined}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                          />
                        </div>

                        <div className="flex gap-3 pt-4">
                          <button
                            onClick={() => {
                              setStartDate('');
                              setEndDate('');
                              setShowDateRangePicker(false);
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Clear
                          </button>
                          <button
                            onClick={() => setShowDateRangePicker(false)}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedQuickFilter('all');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-4 py-2 rounded-lg transition-all ${
                  selectedQuickFilter === 'all' && !startDate && !endDate
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                All Events ({events.length})
              </button>
              <button
                onClick={() => {
                  setSelectedQuickFilter('today');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-4 py-2 rounded-lg transition-all ${
                  selectedQuickFilter === 'today' && !startDate && !endDate
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                Today ({countEventsByFilter().today})
              </button>
              <button
                onClick={() => {
                  setSelectedQuickFilter('tomorrow');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-4 py-2 rounded-lg transition-all ${
                  selectedQuickFilter === 'tomorrow' && !startDate && !endDate
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                Tomorrow ({countEventsByFilter().tomorrow})
              </button>
              <button
                onClick={() => {
                  setSelectedQuickFilter('week');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-4 py-2 rounded-lg transition-all ${
                  selectedQuickFilter === 'week' && !startDate && !endDate
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                This Week ({countEventsByFilter().week})
              </button>
              <button
                onClick={() => {
                  setSelectedQuickFilter('past');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-4 py-2 rounded-lg transition-all ${
                  selectedQuickFilter === 'past' && !startDate && !endDate
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                Past Events ({countEventsByFilter().past})
              </button>
            </div>
            
            {/* Active Date Range Summary */}
            {(startDate || endDate) && (
              <div className="mt-3 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-indigo-900">
                  Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} 
                  {startDate && endDate && ` from ${formatDateDisplay(startDate)} to ${formatDateDisplay(endDate)}`}
                  {startDate && !endDate && ` from ${formatDateDisplay(startDate)} onwards`}
                  {!startDate && endDate && ` up to ${formatDateDisplay(endDate)}`}
                </p>
                <button
                  onClick={handleClearFilters}
                  className="text-indigo-700 hover:text-indigo-900 text-sm font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
        
        {view === 'list' ? (
          <EventList
            events={filteredEvents}
            currentUser={user}
            onUpdateInviteeStatus={handleUpdateInviteeStatus}
            onCancelEvent={handleCancelEvent}
          />
        ) : view === 'create' ? (
          <CreateEvent
            currentUser={user}
            contacts={contacts}
            onCreateEvent={handleCreateEvent}
            onCancel={() => setView('list')}
          />
        ) : (
          <ContactList
            contacts={contacts}
            onDeleteContact={handleDeleteContact}
          />
        )}
      </main>
    </div>
  );
}
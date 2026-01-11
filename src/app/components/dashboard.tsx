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
  user: { email: string; name: string; picture: string };
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

  useEffect(() => {
    console.log('🚀 Dashboard mounted, user:', user.email);
    console.log('📦 Initial accessToken prop:', accessToken?.substring(0, 30));
    
    // Load events from localStorage
    const storedEvents = localStorage.getItem('booker_events');
    if (storedEvents) {
      try {
        setEvents(JSON.parse(storedEvents));
      } catch (error) {
        console.error('Error parsing stored events:', error);
      }
    } else {
      // Add mock events if no stored events exist
      const now = new Date();
      const mockEvents: Event[] = [
        // 1. APPROACHING EVENT - 12 hours from now
        {
          id: 'mock-approaching-1',
          title: 'Team Standup Meeting',
          description: 'Daily standup to discuss progress and blockers',
          date: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString().split('T')[0],
          time: '10:00',
          location: 'Conference Room A',
          organizer: {
            email: user.email,
            name: user.name,
          },
          invitees: [
            { email: 'sarah@example.com', name: 'Sarah Chen', priority: 1, status: 'accepted', invitedAt: new Date().toISOString() },
            { email: 'mike@example.com', name: 'Mike Johnson', priority: 2, status: 'invited', invitedAt: new Date().toISOString() },
          ],
          inviteMode: 'first-come-first-serve',
          sendOrganizerCalendarInvite: true,
          sendInviteesCalendarInvite: true,
          notifyByPhone: false,
          createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // 2. APPROACHING EVENT - 18 hours from now
        {
          id: 'mock-approaching-2',
          title: 'Client Presentation',
          description: 'Q1 results presentation for client',
          date: new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString().split('T')[0],
          time: '14:30',
          location: 'Virtual - Zoom',
          organizer: {
            email: user.email,
            name: user.name,
          },
          invitees: [
            { email: 'client@company.com', name: 'John Smith', priority: 1, status: 'pending', invitedAt: undefined },
            { email: 'backup@company.com', name: 'Jane Doe', priority: 2, status: 'pending', invitedAt: undefined },
          ],
          inviteMode: 'priority',
          autoPromoteInterval: 60,
          sendOrganizerCalendarInvite: true,
          sendInviteesCalendarInvite: true,
          notifyByPhone: false,
          createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // 3. UPCOMING/FUTURE EVENT - 3 days from now
        {
          id: 'mock-future-1',
          title: 'Product Launch Event',
          description: 'Launching our new product line with stakeholders',
          date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          time: '11:00',
          location: 'Main Auditorium',
          organizer: {
            email: user.email,
            name: user.name,
          },
          invitees: [
            { email: 'ceo@company.com', name: 'Alex Rivera', priority: 1, status: 'invited', invitedAt: new Date().toISOString() },
            { email: 'cto@company.com', name: 'Emma Watson', priority: 2, status: 'invited', invitedAt: new Date().toISOString() },
            { email: 'cmo@company.com', name: 'David Lee', priority: 3, status: 'invited', invitedAt: new Date().toISOString() },
          ],
          inviteMode: 'first-come-first-serve',
          sendOrganizerCalendarInvite: true,
          sendInviteesCalendarInvite: true,
          notifyByPhone: false,
          createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // 4. FUTURE EVENT - 1 week from now
        {
          id: 'mock-future-2',
          title: 'Team Building Workshop',
          description: 'Fun activities and team bonding exercises',
          date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          time: '09:00',
          location: 'Outdoor Park',
          organizer: {
            email: user.email,
            name: user.name,
          },
          invitees: [
            { email: 'team1@example.com', name: 'Alice Cooper', priority: 1, status: 'pending', invitedAt: undefined },
            { email: 'team2@example.com', name: 'Bob Martin', priority: 2, status: 'pending', invitedAt: undefined },
            { email: 'team3@example.com', name: 'Carol White', priority: 3, status: 'pending', invitedAt: undefined },
          ],
          inviteMode: 'priority',
          autoPromoteInterval: 120,
          sendOrganizerCalendarInvite: true,
          sendInviteesCalendarInvite: true,
          notifyByPhone: false,
          createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // 5. COMPLETED EVENT - 2 days ago with accepted invitees
        {
          id: 'mock-completed-1',
          title: 'Sprint Planning Meeting',
          description: 'Planning for Sprint 23',
          date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          time: '15:00',
          location: 'Conference Room B',
          organizer: {
            email: user.email,
            name: user.name,
          },
          invitees: [
            { email: 'dev1@example.com', name: 'Tom Hardy', priority: 1, status: 'accepted', invitedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() },
            { email: 'dev2@example.com', name: 'Lisa Brown', priority: 2, status: 'accepted', invitedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() },
            { email: 'dev3@example.com', name: 'James Wilson', priority: 3, status: 'declined', invitedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() },
          ],
          inviteMode: 'first-come-first-serve',
          sendOrganizerCalendarInvite: true,
          sendInviteesCalendarInvite: true,
          notifyByPhone: false,
          createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // 6. COMPLETED EVENT - 1 week ago
        {
          id: 'mock-completed-2',
          title: 'Client Onboarding Session',
          description: 'Onboarding new client to our platform',
          date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          time: '13:00',
          location: 'Virtual - Google Meet',
          organizer: {
            email: user.email,
            name: user.name,
          },
          invitees: [
            { email: 'newclient@corp.com', name: 'Robert Davis', priority: 1, status: 'accepted', invitedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString() },
          ],
          inviteMode: 'priority',
          autoPromoteInterval: 30,
          sendOrganizerCalendarInvite: true,
          sendInviteesCalendarInvite: true,
          notifyByPhone: false,
          createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // 7. NO-SHOW EVENT - 3 days ago with no accepted invitees
        {
          id: 'mock-noshow-1',
          title: 'Optional Coffee Chat',
          description: 'Casual coffee and networking',
          date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          time: '16:00',
          location: 'Office Cafeteria',
          organizer: {
            email: user.email,
            name: user.name,
          },
          invitees: [
            { email: 'person1@example.com', name: 'Chris Evans', priority: 1, status: 'declined', invitedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString() },
            { email: 'person2@example.com', name: 'Mark Taylor', priority: 2, status: 'declined', invitedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString() },
          ],
          inviteMode: 'first-come-first-serve',
          sendOrganizerCalendarInvite: false,
          sendInviteesCalendarInvite: false,
          notifyByPhone: false,
          createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // 8. NO-SHOW EVENT - 5 days ago
        {
          id: 'mock-noshow-2',
          title: 'Networking Event',
          description: 'Industry networking meetup',
          date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          time: '18:30',
          location: 'Downtown Hotel',
          organizer: {
            email: user.email,
            name: user.name,
          },
          invitees: [
            { email: 'contact1@company.com', name: 'Nancy Green', priority: 1, status: 'pending', invitedAt: undefined },
            { email: 'contact2@company.com', name: 'Paul Anderson', priority: 2, status: 'pending', invitedAt: undefined },
          ],
          inviteMode: 'priority',
          autoPromoteInterval: 90,
          sendOrganizerCalendarInvite: true,
          sendInviteesCalendarInvite: true,
          notifyByPhone: false,
          createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];
      
      setEvents(mockEvents);
      localStorage.setItem('booker_events', JSON.stringify(mockEvents));
      console.log('✅ Added mock events for testing');
    }
    
    // Load contacts from localStorage
    const storedContacts = localStorage.getItem('booker_contacts');
    if (storedContacts) {
      try {
        setContacts(JSON.parse(storedContacts));
      } catch (error) {
        console.error('Error parsing stored contacts:', error);
      }
    }
    setLoading(false);
    // Commenting out API calls for local testing
    // fetchEvents();
    // testBackendConnection();
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
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update contacts based on invitees in an event
  const updateContactsFromEvent = (eventData: Omit<Event, 'id' | 'organizer' | 'createdAt'>) => {
    const now = new Date().toISOString();
    const updatedContacts = [...contacts];
    
    eventData.invitees.forEach((invitee) => {
      const existingContactIndex = updatedContacts.findIndex(
        (c) => c.email.toLowerCase() === invitee.email.toLowerCase()
      );
      
      if (existingContactIndex >= 0) {
        // Update existing contact
        updatedContacts[existingContactIndex] = {
          ...updatedContacts[existingContactIndex],
          name: invitee.name, // Update name in case it changed
          phone: invitee.phone || updatedContacts[existingContactIndex].phone, // Update phone if provided
          eventCount: updatedContacts[existingContactIndex].eventCount + 1,
          lastInvitedAt: now,
        };
      } else {
        // Add new contact
        updatedContacts.push({
          email: invitee.email,
          name: invitee.name,
          phone: invitee.phone,
          addedAt: now,
          eventCount: 1,
          lastInvitedAt: now,
        });
      }
    });
    
    setContacts(updatedContacts);
    localStorage.setItem('booker_contacts', JSON.stringify(updatedContacts));
    console.log('✅ Contacts updated:', updatedContacts.length);
  };

  // Delete a contact
  const handleDeleteContact = (email: string) => {
    const updatedContacts = contacts.filter(
      (c) => c.email.toLowerCase() !== email.toLowerCase()
    );
    setContacts(updatedContacts);
    localStorage.setItem('booker_contacts', JSON.stringify(updatedContacts));
    console.log('✅ Contact deleted:', email);
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

    const updatedEvents = events.filter(e => e.id !== eventId);
    setEvents(updatedEvents);
    localStorage.setItem('booker_events', JSON.stringify(updatedEvents));
    console.log('✅ Event cancelled:', eventId);
  };

  const handleCreateEvent = async (eventData: Omit<Event, 'id' | 'organizer' | 'createdAt'>) => {
    // Update contacts first
    updateContactsFromEvent(eventData);
    
    // Local storage version - no API call
    const newEvent: Event = {
      ...eventData,
      id: `event_${Date.now()}`,
      organizer: {
        email: user.email,
        name: user.name,
      },
      inviteMode: eventData.inviteMode || 'priority', // Default to priority for backward compatibility
      sendOrganizerCalendarInvite: eventData.sendOrganizerCalendarInvite ?? true, // Default to true
      sendInviteesCalendarInvite: eventData.sendInviteesCalendarInvite ?? true, // Default to true
      notifyByPhone: eventData.notifyByPhone ?? false, // Default to false
      createdAt: new Date().toISOString(),
    };
    
    const updatedEvents = [newEvent, ...events];
    setEvents(updatedEvents);
    localStorage.setItem('booker_events', JSON.stringify(updatedEvents));
    setView('list');
    
    console.log('✅ Event created locally:', newEvent);
    
    /* Original API version - commented out for local testing
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
      setEvents((prevEvents) => [data.event, ...prevEvents]);
      setView('list');
    } catch (error) {
      console.error('Error creating event:', error);
      alert('An error occurred while creating the event.');
    }
    */
  };

  const handleUpdateInviteeStatus = async (
    eventId: string,
    inviteeEmail: string,
    status: InviteeStatus
  ) => {
    // Local storage version - no API call
    const updatedEvents = events.map((event) => {
      if (event.id !== eventId) return event;
      
      const updatedInvitees = event.invitees.map((inv) =>
        inv.email === inviteeEmail ? { ...inv, status } : inv
      );
      
      return { ...event, invitees: updatedInvitees };
    });
    
    setEvents(updatedEvents);
    localStorage.setItem('booker_events', JSON.stringify(updatedEvents));
    console.log('✅ Invitee status updated locally');
    
    /* Original API version - commented out for local testing
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
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === eventId ? data.event : event
        )
      );
    } catch (error) {
      console.error('Error updating invitee status:', error);
      alert('An error occurred while updating the status.');
    }
    */
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
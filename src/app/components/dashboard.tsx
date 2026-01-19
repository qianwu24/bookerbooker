import { useState, useEffect } from 'react';
import { Calendar, LogOut, Plus, User, X, Filter, Users, Settings, CheckCircle, Trash2, Phone, Loader2 } from 'lucide-react';
import { CreateEvent } from './create-event';
import { EventList } from './event-list';
import { ContactList } from './contact-list';
import { API_BASE_URL } from '../utils/supabase-client';
import { supabase } from '../utils/supabase-client';
import { BookerLogo } from './booker-logo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import type { Event, InviteeStatus, Contact } from '../types';

interface DashboardProps {
  user: { id: string; email: string; name: string; picture: string };
  accessToken: string;
  onLogout: () => void;
}

export function Dashboard({ user, accessToken, onLogout }: DashboardProps) {
  const [view, setView] = useState<'list' | 'create' | 'contacts' | 'settings'>('list');
  const [events, setEvents] = useState<Event[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeZone, setTimeZone] = useState<string>(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<'all' | 'today' | 'tomorrow' | 'week' | 'past'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [showInviteeFilter, setShowInviteeFilter] = useState(false);
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [onlyScheduled, setOnlyScheduled] = useState(false);
  const [showClearNoShowDialog, setShowClearNoShowDialog] = useState(false);
  const [clearingNoShows, setClearingNoShows] = useState(false);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userPhone, setUserPhone] = useState<string>('');
  const [userPhoneCountryCode, setUserPhoneCountryCode] = useState<string>('+1');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaveMessage, setPhoneSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const EVENTS_PER_PAGE = 10;

  // Format phone number for display: +1 (555) 123-4567
  const formatPhoneDisplay = (phone: string): string => {
    if (!phone) return '';
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Handle different lengths
    if (digits.length === 10) {
      // US number without country code: (555) 123-4567
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      // US/CA with country code: +1 (555) 123-4567
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    } else if (digits.length > 10) {
      // International: +XX (XXX) XXX-XXXX
      const countryCode = digits.slice(0, digits.length - 10);
      const rest = digits.slice(-10);
      return `+${countryCode} (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
    }
    // Fallback for short numbers
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  // Handle phone input change with formatting
  const handleUserPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Extract only digits, max 10
    const digits = input.replace(/\D/g, '').slice(0, 10);
    setUserPhone(digits);
  };

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
      timeZone: rawEvent.time_zone || rawEvent.timeZone || timeZone,
      durationMinutes: rawEvent.duration_minutes ?? rawEvent.durationMinutes ?? 60,
      spots: rawEvent.spots ?? 1,
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
    fetchUserPhone();
    testBackendConnection();

    // Refresh timezone from browser (approx IP/device derived)
    const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detectedZone) {
      setTimeZone(detectedZone);
    }
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

  const fetchEvents = async (reset = true) => {
    try {
      console.log('📥 Fetching events...', reset ? '(initial)' : '(more)');
      const freshToken = await getFreshToken();
      console.log('🔑 Using token for fetch:', freshToken.substring(0, 30) + '...');
      
      const offset = reset ? 0 : events.length;
      const response = await fetch(`${API_BASE_URL}/events?limit=${EVENTS_PER_PAGE}&offset=${offset}`, {
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
      
      if (reset) {
        setEvents(normalized);
      } else {
        setEvents(prev => [...prev, ...normalized]);
      }
      setHasMoreEvents(data.hasMore ?? false);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreEvents = async () => {
    if (loadingMore || !hasMoreEvents) return;
    setLoadingMore(true);
    await fetchEvents(false);
  };

  const fetchUserPhone = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('phone')
        .eq('id', user.id)
        .single();
      
      if (!error && data?.phone) {
        // Parse E.164 format to extract country code and local number
        const phone = data.phone as string;
        if (phone.startsWith('+1') && phone.length === 12) {
          setUserPhoneCountryCode('+1');
          setUserPhone(phone.slice(2)); // Remove +1
        } else if (phone.startsWith('+')) {
          // Try to match other country codes
          const countryCodeMatch = phone.match(/^(\+\d{1,3})/);
          if (countryCodeMatch) {
            const code = countryCodeMatch[1];
            setUserPhoneCountryCode(code);
            setUserPhone(phone.slice(code.length));
          } else {
            setUserPhone(phone.replace(/\D/g, ''));
          }
        } else {
          setUserPhone(phone.replace(/\D/g, ''));
        }
      }
    } catch (error) {
      console.error('Error fetching user phone:', error);
    }
  };

  const saveUserPhone = async () => {
    setSavingPhone(true);
    setPhoneSaveMessage(null);
    
    try {
      // Basic phone validation - allow empty or valid 10-digit format
      const cleanPhone = userPhone.replace(/\D/g, '');
      if (userPhone && cleanPhone.length !== 10) {
        setPhoneSaveMessage({ type: 'error', text: 'Please enter a valid 10-digit phone number' });
        setSavingPhone(false);
        return;
      }

      // Build full E.164 phone number
      const fullPhone = cleanPhone ? `${userPhoneCountryCode}${cleanPhone}` : null;

      const { error } = await supabase
        .from('users')
        .update({ phone: fullPhone })
        .eq('id', user.id);
      
      if (error) {
        console.error('Error saving phone:', error);
        setPhoneSaveMessage({ type: 'error', text: 'Failed to save phone number' });
      } else {
        setPhoneSaveMessage({ type: 'success', text: 'Phone number saved!' });
        setTimeout(() => setPhoneSaveMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error saving phone:', error);
      setPhoneSaveMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setSavingPhone(false);
    }
  };

  const fetchContacts = async () => {
    try {
      console.log('📒 Fetching contacts...');
      
      // Fetch contacts separately (avoid nested select that causes RLS recursion)
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('owner_id', user.id);

      if (contactsError) {
        console.error('Error fetching contacts:', contactsError.message);
        return;
      }

      // Get the contact IDs for this user
      const contactIds = (contactsData || []).map((c: any) => c.id);
      console.log('📒 Contacts fetched:', contactsData?.length, 'Contact IDs:', contactIds);

      // Fetch invite counts separately - only for this user's contacts
      const { data: invitesData, error: invitesError } = await supabase
        .from('event_invitees')
        .select('contact_id, invited_at')
        .in('contact_id', contactIds.length > 0 ? contactIds : ['00000000-0000-0000-0000-000000000000']);

      console.log('📒 Invites fetched:', invitesData?.length, 'Error:', invitesError?.message);
      console.log('📒 Invites data:', invitesData);

      if (invitesError) {
        console.error('Error fetching invites:', invitesError.message);
        // Continue without invite counts
      }

      // Build a map of contact_id -> { count, lastInvitedAt }
      const inviteMap = new Map<string, { count: number; lastInvitedAt: string | null }>();
      (invitesData || []).forEach((inv: any) => {
        const existing = inviteMap.get(inv.contact_id);
        if (existing) {
          existing.count++;
          if (inv.invited_at && (!existing.lastInvitedAt || inv.invited_at > existing.lastInvitedAt)) {
            existing.lastInvitedAt = inv.invited_at;
          }
        } else {
          inviteMap.set(inv.contact_id, { count: 1, lastInvitedAt: inv.invited_at });
        }
      });

      const mapped = (contactsData || []).map((c: any) => {
        const inviteInfo = inviteMap.get(c.id) || { count: 0, lastInvitedAt: null };
        
        return {
          id: c.id,
          email: c.email || undefined,
          name: c.name || c.email || 'Unknown',
          phone: c.phone || undefined,
          addedAt: c.created_at,
          lastInvitedAt: inviteInfo.lastInvitedAt || c.updated_at || c.created_at,
          eventCount: inviteInfo.count,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        };
      });

      // Sort by eventCount (descending), then by name
      mapped.sort((a, b) => {
        if (b.eventCount !== a.eventCount) {
          return b.eventCount - a.eventCount;
        }
        return a.name.localeCompare(b.name);
      });

      setContacts(mapped);
    } catch (error) {
      console.error('Unexpected error fetching contacts:', error);
    }
  };

  // Update contacts based on invitees in an event
  const updateContactsFromEvent = async (eventData: Omit<Event, 'id' | 'organizer' | 'createdAt'>) => {
    try {
      // Contacts are now created/updated on the backend when creating events
      // This function is a fallback for local contact updates
      
      for (const invitee of eventData.invitees) {
        const hasEmail = invitee.email && invitee.email.trim().length > 0;
        const hasPhone = invitee.phone && invitee.phone.trim().length > 0;
        
        if (!hasEmail && !hasPhone) continue;
        
        const record = {
          owner_id: user.id,
          email: hasEmail ? invitee.email!.trim() : null,
          name: invitee.name,
          phone: hasPhone ? invitee.phone!.trim() : null,
        };

        // Try to find existing contact by email or phone
        let existingContact = null;
        
        if (hasEmail) {
          const { data } = await supabase
            .from('contacts')
            .select()
            .eq('owner_id', user.id)
            .eq('email', invitee.email!.trim())
            .single();
          existingContact = data;
        }
        
        if (!existingContact && hasPhone) {
          const { data } = await supabase
            .from('contacts')
            .select()
            .eq('owner_id', user.id)
            .eq('phone', invitee.phone!.trim())
            .single();
          existingContact = data;
        }
        
        if (existingContact) {
          // Update existing
          await supabase
            .from('contacts')
            .update({ name: invitee.name, phone: record.phone, email: record.email })
            .eq('id', existingContact.id);
        } else {
          // Insert new
          const { error } = await supabase
            .from('contacts')
            .insert(record);
          if (error) {
            console.error('Error inserting contact:', error.message);
          }
        }
      }

      await fetchContacts();
    } catch (error) {
      console.error('Unexpected error updating contacts:', error);
    }
  };

  // Delete a contact
  const handleDeleteContact = (contactId: string) => {
    const performDelete = async () => {
      try {
        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('id', contactId)
          .eq('owner_id', user.id);

        if (error) {
          console.error('Error deleting contact:', error.message);
          alert('Failed to delete contact.');
          return;
        }

        setContacts((prev) => prev.filter((c) => c.id !== contactId));
        console.log('✅ Contact deleted:', contactId);
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

  // Get no-show events (past events with no confirmed attendees)
  const getNoShowEvents = () => {
    const now = new Date();
    return events.filter((event) => {
      // Combine date and time for accurate comparison
      const eventDateTime = new Date(`${event.date}T${event.time || '23:59'}`);
      // Event is in the past (must be fully past, not just date)
      if (eventDateTime >= now) return false;
      // No accepted invitees
      const hasAccepted = event.invitees?.some(
        (inv) => inv.status === 'accepted'
      );
      return !hasAccepted;
    });
  };

  // Clear no-show events
  const handleClearNoShowEvents = async () => {
    const noShowEvents = getNoShowEvents();
    if (noShowEvents.length === 0) {
      alert('No past events without confirmed attendees found.');
      setShowClearNoShowDialog(false);
      return;
    }

    setClearingNoShows(true);
    try {
      const freshToken = await getFreshToken();
      let deletedCount = 0;
      
      for (const event of noShowEvents) {
        const response = await fetch(`${API_BASE_URL}/events/${event.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${freshToken}`,
          },
        });
        
        if (response.ok) {
          deletedCount++;
        } else {
          console.error(`Failed to delete event ${event.id}`);
        }
      }

      // Refresh events list
      await fetchEvents();
      alert(`Successfully deleted ${deletedCount} no-show event${deletedCount !== 1 ? 's' : ''}.`);
    } catch (error) {
      console.error('Error clearing no-show events:', error);
      alert('An error occurred while clearing no-show events.');
    } finally {
      setClearingNoShows(false);
      setShowClearNoShowDialog(false);
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
    const inviteeMap = new Map<string, { identifier: string; email?: string; phone?: string; name: string }>();
    
    events.forEach(event => {
      event.invitees.forEach(invitee => {
        // Use email or phone as identifier
        const identifier = invitee.email || invitee.phone || '';
        if (identifier && !inviteeMap.has(identifier)) {
          inviteeMap.set(identifier, {
            identifier,
            email: invitee.email,
            phone: invitee.phone,
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

  const isEventScheduled = (event: Event) =>
    event.invitees.some(invitee => invitee.status === 'accepted');

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
        event.invitees.some(invitee => {
          const identifier = invitee.email || invitee.phone || '';
          return selectedInvitees.includes(identifier);
        })
      );
    }

    if (onlyScheduled) {
      eventsToFilter = eventsToFilter.filter(isEventScheduled);
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
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Phone Number Setup Banner */}
      {!userPhone && !loading && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-amber-600" />
                <p className="text-sm text-amber-800">
                  <strong>Set up your phone number</strong> to receive SMS notifications when invitees respond to your events.
                </p>
              </div>
              <button
                onClick={() => setView('settings')}
                className="px-4 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
              >
                Go to Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setView('list')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <BookerLogo className="w-8 h-8 text-indigo-600" />
              <h1 className="text-indigo-600">Booker</h1>
            </button>

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
                onClick={() => setView('settings')}
                className={`p-2 rounded-lg transition-colors ${
                  view === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
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
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-4 min-w-max">
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
        {view === 'list' && (
          <div className="mb-6">
            {/* Quick Date Filters with Date Range Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Filters</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Invitee Filter Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowInviteeFilter(!showInviteeFilter)}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-sm sm:text-base"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Filter by</span> Invitee
                    {selectedInvitees.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                        {selectedInvitees.length}
                      </span>
                    )}
                  </button>

                  {/* Invitee Filter Dropdown */}
                  {showInviteeFilter && (
                    <>
                      {/* Mobile backdrop */}
                      <div 
                        className="fixed inset-0 bg-black/20 z-40 sm:hidden"
                        onClick={() => setShowInviteeFilter(false)}
                      />
                      <div className="fixed inset-x-4 bottom-4 sm:absolute sm:inset-auto sm:right-0 sm:bottom-auto sm:top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 w-auto sm:w-96 max-h-[70vh] sm:max-h-96 overflow-hidden z-50">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
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
                                key={invitee.identifier}
                                onClick={() => toggleInviteeSelection(invitee.identifier)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${ selectedInvitees.includes(invitee.identifier)
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                    selectedInvitees.includes(invitee.identifier)
                                      ? 'border-indigo-600 bg-indigo-600'
                                      : 'border-gray-300'
                                  }`}>
                                    {selectedInvitees.includes(invitee.identifier) && (
                                      <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M5 13l4 4L19 7"></path>
                                      </svg>
                                    )}
                                  </div>
                                  <div className="text-left">
                                    <p className="text-sm font-medium text-gray-900">
                                      {invitee.name}
                                    </p>
                                    <p className="text-xs text-gray-500">{invitee.email || (invitee.phone ? formatPhoneDisplay(invitee.phone) : '')}</p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4 flex gap-3">
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
                    </>
                  )}
                </div>

                {/* Scheduled Filter Toggle */}
                <button
                  onClick={() => setOnlyScheduled((prev) => !prev)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 border rounded-lg transition-colors text-sm sm:text-base ${
                    onlyScheduled
                      ? 'bg-green-50 border-green-300 text-green-700 shadow-inner'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Scheduled</span><span className="sm:hidden">Sched.</span> only
                  {onlyScheduled && (
                    <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">On</span>
                  )}
                </button>

                {/* Date Range Filter Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-sm sm:text-base"
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">Date</span> Range
                    {(startDate || endDate) && (
                      <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                        Active
                      </span>
                    )}
                  </button>

                  {/* Date Range Picker Dropdown */}
                  {showDateRangePicker && (
                    <>
                      {/* Mobile backdrop */}
                      <div 
                        className="fixed inset-0 bg-black/20 z-40 sm:hidden"
                        onClick={() => setShowDateRangePicker(false)}
                      />
                      <div className="fixed inset-x-4 bottom-4 sm:absolute sm:inset-auto sm:right-0 sm:bottom-auto sm:top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 w-auto sm:w-80 p-4 sm:p-6 z-50">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
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
                    </>
                  )}
                </div>

                {/* Clear Past Events Button - only show if there are unconfirmed past events */}
                {getNoShowEvents().length > 0 && (
                  <button
                    onClick={() => setShowClearNoShowDialog(true)}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors text-sm sm:text-base"
                    title="Delete past events with no confirmed attendees"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear Past</span><span className="sm:hidden">Clear</span>
                    <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                      {getNoShowEvents().length}
                    </span>
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              <button
                onClick={() => {
                  setSelectedQuickFilter('all');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-3 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm sm:text-base ${
                  selectedQuickFilter === 'all' && !startDate && !endDate
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                All ({events.length})
              </button>
              <button
                onClick={() => {
                  setSelectedQuickFilter('today');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-3 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm sm:text-base ${
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
                className={`px-3 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm sm:text-base ${
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
                className={`px-3 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm sm:text-base ${
                  selectedQuickFilter === 'week' && !startDate && !endDate
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                Week ({countEventsByFilter().week})
              </button>
              <button
                onClick={() => {
                  setSelectedQuickFilter('past');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-3 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm sm:text-base ${
                  selectedQuickFilter === 'past' && !startDate && !endDate
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                Past ({countEventsByFilter().past})
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
            hasMore={hasMoreEvents}
            loadingMore={loadingMore}
            onLoadMore={loadMoreEvents}
          />
        ) : view === 'create' ? (
          <CreateEvent
            currentUser={user}
            contacts={contacts}
            timeZone={timeZone}
            onCreateEvent={handleCreateEvent}
            onCancel={() => setView('list')}
          />
        ) : view === 'contacts' ? (
          <ContactList
            contacts={contacts}
            onDeleteContact={handleDeleteContact}
          />
        ) : (
          <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
                <p className="text-sm text-gray-600">Manage your account and defaults.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Profile</p>
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-600">{user.email}</p>
              </div>

              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Default Invite Mode</p>
                <p className="text-sm text-gray-900">First-Come-First-Serve</p>
                <p className="text-xs text-gray-600">Priority mode is coming soon.</p>
              </div>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-sm font-semibold text-gray-900 mb-2">Timezone</p>
              <p className="text-xs text-gray-600 mb-3">Detected from your device/IP. Adjust if needed.</p>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
                {!['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Singapore','Asia/Tokyo','Australia/Sydney'].includes(timeZone) && (
                  <option value={timeZone}>{timeZone}</option>
                )}
              </select>
            </div>

            {/* Phone Number for SMS Notifications */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-indigo-600" />
                <p className="text-sm font-semibold text-gray-900">Phone Number (SMS)</p>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Add your phone number to receive SMS notifications as an event organizer.
              </p>
              <div className="flex gap-2">
                <select
                  value={userPhoneCountryCode}
                  onChange={(e) => setUserPhoneCountryCode(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white text-gray-700 min-w-[80px]"
                >
                  <option value="+1">CA +1</option>
                  <option value="+1">US +1</option>
                  <option value="+44">UK +44</option>
                  <option value="+86">CN +86</option>
                  <option value="+91">IN +91</option>
                  <option value="+81">JP +81</option>
                  <option value="+82">KR +82</option>
                  <option value="+61">AU +61</option>
                  <option value="+33">FR +33</option>
                  <option value="+49">DE +49</option>
                </select>
                <input
                  type="tel"
                  value={formatPhoneDisplay(userPhone)}
                  onChange={handleUserPhoneChange}
                  placeholder="(555) 123-4567"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={saveUserPhone}
                  disabled={savingPhone}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savingPhone ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
              {phoneSaveMessage && (
                <p className={`mt-2 text-xs ${phoneSaveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {phoneSaveMessage.text}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setView('list')}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Back to events
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Clear Past Events Confirmation Dialog */}
      <AlertDialog open={showClearNoShowDialog} onOpenChange={setShowClearNoShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Past Events?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{getNoShowEvents().length}</strong> past event{getNoShowEvents().length !== 1 ? 's' : ''} where no one accepted the invitation.
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingNoShows}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearNoShowEvents}
              disabled={clearingNoShows}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {clearingNoShows ? 'Deleting...' : 'Delete Events'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
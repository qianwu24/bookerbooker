import { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, Plus, X, ArrowUp, ArrowDown, Users, Zap, UserPlus, AlertCircle, ChevronDown, Phone } from 'lucide-react';
import type { Event, Invitee, InviteMode, Contact } from '../types';

interface CreateEventProps {
  currentUser: { email: string; name: string };
  contacts: Contact[];
  timeZone?: string;
  onCreateEvent: (event: Omit<Event, 'id' | 'organizer' | 'createdAt'>) => void;
  onCancel: () => void;
}

export function CreateEvent({
  currentUser,
  contacts,
  timeZone,
  onCreateEvent,
  onCancel,
}: CreateEventProps) {
  const locationKey = `booker_recent_locations_${currentUser.email}`;
  const [title, setTitle] = useState('Tennis Match');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [titleEmoji, setTitleEmoji] = useState('🎾');
  const [locationHistory, setLocationHistory] = useState<string[]>([]);
  const [showRecentLocations, setShowRecentLocations] = useState(false);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [newInviteeEmail, setNewInviteeEmail] = useState('');
  const [newInviteeName, setNewInviteeName] = useState('');
  const [newInviteePhone, setNewInviteePhone] = useState('');
  const [inviteMode, setInviteMode] = useState<InviteMode>('first-come-first-serve');
  const [autoPromoteInterval, setAutoPromoteInterval] = useState<number>(30); // Default 30 minutes
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [duplicateAlert, setDuplicateAlert] = useState<string | null>(null);

  // Load cached locations on mount
  useEffect(() => {
    const readKey = (key: string) => {
      const raw = localStorage.getItem(key);
      if (!raw) return [] as string[];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        console.error('Failed to parse cached locations', err);
        return [];
      }
    };

    // Migrate any legacy shared locations once
    const legacy = readKey('booker_recent_locations');
    const userScoped = readKey(locationKey);
    const merged = [...legacy, ...userScoped].filter(Boolean);
    const unique = Array.from(new Set(merged)).slice(0, 5);
    setLocationHistory(unique);
    localStorage.setItem(locationKey, JSON.stringify(unique));
  }, []);

  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Date/time validation helper
  const isDateTimeInFuture = (dateStr: string, timeStr: string): boolean => {
    if (!dateStr || !timeStr) return false;
    const candidate = new Date(`${dateStr}T${timeStr}`);
    if (Number.isNaN(candidate.getTime())) return false;
    return candidate.getTime() >= Date.now();
  };

  // Persist recent locations (max 5, unique)
  const rememberLocation = (loc: string) => {
    const clean = loc.trim();
    if (!clean) return;
    const next = [clean, ...locationHistory.filter((l) => l !== clean)].slice(0, 5);
    setLocationHistory(next);
    localStorage.setItem(locationKey, JSON.stringify(next));
    setShowRecentLocations(false);
  };

  // Add invitee from contact
  const handleAddFromContact = (contact: Contact) => {
    // Check for duplicate email
    if (invitees.some(inv => inv.email?.toLowerCase() === contact.email.toLowerCase())) {
      setDuplicateAlert(contact.email);
      // Auto-dismiss after 3 seconds
      setTimeout(() => setDuplicateAlert(null), 3000);
      return;
    }

    const newInvitee: Invitee = {
      email: contact.email,
      name: contact.name,
      phone: contact.phone,
      priority: invitees.length,
      status: inviteMode === 'first-come-first-serve' ? 'invited' : (invitees.length === 0 ? 'invited' : 'pending'),
    };
    setInvitees([...invitees, newInvitee]);
  };

  // Get available contacts (not already added as invitees)
  const availableContacts = contacts.filter(
    contact => !invitees.some(inv => inv.email?.toLowerCase() === contact.email.toLowerCase())
  );

  const handleAddInvitee = () => {
    // Clear previous errors
    const newErrors = { ...errors };
    delete newErrors.inviteeEmail;
    delete newErrors.inviteeName;
    delete newErrors.inviteePhone;
    
    // Validate name
    if (!newInviteeName || newInviteeName.trim().length === 0) {
      setErrors({ ...newErrors, inviteeName: 'Name is required' });
      return;
    }
    
    // Validate that at least email or phone is provided
    const hasEmail = newInviteeEmail && newInviteeEmail.trim().length > 0;
    const hasPhone = newInviteePhone && newInviteePhone.trim().length > 0;
    
    if (!hasEmail && !hasPhone) {
      setErrors({ ...newErrors, inviteeEmail: 'Either email or phone is required' });
      return;
    }
    
    // Validate email format if provided
    if (hasEmail && !isValidEmail(newInviteeEmail.trim())) {
      setErrors({ ...newErrors, inviteeEmail: 'Please enter a valid email address' });
      return;
    }
    
    // Check for duplicate (by email or phone)
    const emailToCheck = hasEmail ? newInviteeEmail.trim().toLowerCase() : null;
    const phoneToCheck = hasPhone ? newInviteePhone.trim() : null;
    
    const isDuplicate = invitees.some(inv => {
      if (emailToCheck && inv.email?.toLowerCase() === emailToCheck) return true;
      if (phoneToCheck && inv.phone === phoneToCheck) return true;
      return false;
    });
    
    if (isDuplicate) {
      setErrors({ ...newErrors, inviteeEmail: 'This contact has already been added' });
      return;
    }

    const newInvitee: Invitee = {
      email: hasEmail ? newInviteeEmail.trim() : undefined,
      name: newInviteeName.trim(),
      phone: hasPhone ? newInviteePhone.trim() : undefined,
      priority: invitees.length,
      // In first-come-first-serve mode, everyone is invited immediately
      status: inviteMode === 'first-come-first-serve' ? 'invited' : (invitees.length === 0 ? 'invited' : 'pending'),
    };
    setInvitees([...invitees, newInvitee]);
    setNewInviteeEmail('');
    setNewInviteeName('');
    setNewInviteePhone('');
    setErrors(newErrors); // Clear invitee errors
  };

  const handleRemoveInvitee = (index: number) => {
    const updated = invitees.filter((_, i) => i !== index);
    // Recalculate priorities
    const recalculated = updated.map((inv, i) => ({
      ...inv,
      priority: i,
      status: i === 0 ? 'invited' : inv.status === 'invited' ? 'pending' : inv.status,
    }));
    setInvitees(recalculated);
  };

  const handleMovePriority = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === invitees.length - 1)
    ) {
      return;
    }

    const newInvitees = [...invitees];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newInvitees[index], newInvitees[swapIndex]] = [
      newInvitees[swapIndex],
      newInvitees[index],
    ];

    // Recalculate priorities and status
    const recalculated = newInvitees.map((inv, i) => ({
      ...inv,
      priority: i,
      status: i === 0 ? 'invited' : inv.status === 'invited' ? 'pending' : inv.status,
    }));

    setInvitees(recalculated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    const validationErrors: { [key: string]: string } = {};
    
    if (!title || title.trim().length === 0) {
      validationErrors.title = 'Event title is required';
    }
    
    if (!date) {
      validationErrors.date = 'Event date is required';
    }
    
    if (!time) {
      validationErrors.time = 'Event time is required';
    }

    if (date && time && !isDateTimeInFuture(date, time)) {
      validationErrors.time = 'Event must be in the future (date/time)';
    }
    
    if (invitees.length === 0) {
      validationErrors.invitees = 'Add at least one invitee';
    }

    if (!durationMinutes || durationMinutes <= 0) {
      validationErrors.durationMinutes = 'Duration must be greater than 0 minutes';
    }
    
    if (inviteMode === 'priority') {
      if (!autoPromoteInterval) {
        validationErrors.autoPromoteInterval = 'Auto-promote interval is required';
      } else if (autoPromoteInterval < 5) {
        validationErrors.autoPromoteInterval = 'Minimum interval is 5 minutes';
      } else if (autoPromoteInterval > 360) {
        validationErrors.autoPromoteInterval = 'Maximum interval is 360 minutes (6 hours)';
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Scroll to top to show errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const trimmedLocation = location.trim();
    const event: Omit<Event, 'id' | 'organizer' | 'createdAt'> = {
      title: titleEmoji ? `${titleEmoji} ${title.trim()}` : title.trim(),
      description,
      date,
      time,
      location: trimmedLocation,
      timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      durationMinutes,
      invitees,
      inviteMode,
      autoPromoteInterval: inviteMode === 'priority' ? autoPromoteInterval : undefined,
      sendOrganizerCalendarInvite: true,
      sendInviteesCalendarInvite: true,
      notifyByPhone: false,
    };

    rememberLocation(trimmedLocation);

    onCreateEvent(event);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="mb-6">Create New Event</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Details */}
          <div>
            <label htmlFor="title" className="block text-sm mb-2">
              Event Title *
            </label>
            <div className="flex gap-2">
              <select
                aria-label="Title emoji"
                value={titleEmoji}
                onChange={(e) => setTitleEmoji(e.target.value)}
                className="w-14 px-2 py-2 text-lg text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
              >
                <option value="🎾">🎾</option>
                <option value="📅">📅</option>
                <option value="🎉">🎉</option>
                <option value="🤝">🤝</option>
                <option value="🧠">🧠</option>
                <option value="📞">📞</option>
                <option value="☕">☕</option>
                <option value="">None</option>
              </select>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Team Meeting"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                required
              />
            </div>
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add event details..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm mb-2">
                Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  required
                />
                {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="time" className="block text-sm mb-2">
                Time *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  required
                />
                {errors.time && <p className="text-red-500 text-sm mt-1">{errors.time}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm mb-2">
                Duration *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  id="duration"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none bg-white"
                  required
                >
                  {[30, 45, 60, 90, 120, 180].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes === 60 ? '1 hour' : `${minutes} minutes`}
                    </option>
                  ))}
                </select>
                {errors.durationMinutes && (
                  <p className="text-red-500 text-sm mt-1">{errors.durationMinutes}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm mb-2">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Conference Room A"
                className="w-full pl-10 pr-11 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
              {locationHistory.length > 0 && (
                <button
                  type="button"
                  aria-label="Show recent locations"
                  onClick={() => setShowRecentLocations((open) => !open)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500"
                >
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </button>
              )}

              {showRecentLocations && locationHistory.length > 0 && (
                <div className="absolute z-10 mt-2 w-full max-h-48 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                  {locationHistory.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        setLocation(loc);
                        setShowRecentLocations(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-indigo-50"
                    >
                      {loc}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowRecentLocations(false)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Invite Mode Selector */}
          <div>
            <label className="block text-sm mb-3">
              Invitation Type *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Priority-Based Option (disabled, coming soon) */}
              <button
                type="button"
                disabled
                className="p-4 rounded-xl border-2 transition-all text-left border-gray-200 bg-white opacity-60 cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gray-200">
                    <Users className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1 text-gray-900">
                      🎯 Priority-Based
                    </h4>
                    <p className="text-sm text-gray-600">
                      Coming soon: invite people in ranked order with auto-promote on declines.
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    Coming soon
                  </span>
                </div>
              </button>

              {/* First-Come-First-Serve Option */}
              <button
                type="button"
                onClick={() => {
                  setInviteMode('first-come-first-serve');
                  // Set all invitees to invited status
                  setInvitees(invitees.map(inv => ({
                    ...inv,
                    status: 'invited'
                  })));
                }}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  inviteMode === 'first-come-first-serve'
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    inviteMode === 'first-come-first-serve' ? 'bg-purple-600' : 'bg-gray-200'
                  }`}>
                    <Zap className={`w-5 h-5 ${
                      inviteMode === 'first-come-first-serve' ? 'text-white' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold mb-1 ${
                      inviteMode === 'first-come-first-serve' ? 'text-purple-900' : 'text-gray-900'
                    }`}>
                      ⚡ First-Come-First-Serve
                    </h4>
                    <p className="text-sm text-gray-600">
                      Invite everyone at once. The first person to accept gets the spot.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Auto-Promote Interval - only show in priority mode */}
          {inviteMode === 'priority' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <Clock className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div className="flex-1">
                  <label htmlFor="autoPromoteInterval" className="block text-sm font-semibold text-indigo-900 mb-1">
                    Auto-Promote Timer ⏱️
                  </label>
                  <p className="text-sm text-gray-700 mb-3">
                    If someone doesn't respond within this time, automatically invite the next person in line.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      id="autoPromoteInterval"
                      type="number"
                      min="5"
                      max="360"
                      step="5"
                      value={autoPromoteInterval}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (value > 360) {
                          setAutoPromoteInterval(360);
                        } else if (value < 5) {
                          setAutoPromoteInterval(5);
                        } else {
                          setAutoPromoteInterval(value);
                        }
                      }}
                      className="w-24 px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                    <span className="text-sm text-gray-700">minutes (max 360)</span>
                    <div className="flex gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => setAutoPromoteInterval(15)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          autoPromoteInterval === 15
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-indigo-100'
                        }`}
                      >
                        15m
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoPromoteInterval(30)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          autoPromoteInterval === 30
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-indigo-100'
                        }`}
                      >
                        30m
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoPromoteInterval(60)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          autoPromoteInterval === 60
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-indigo-100'
                        }`}
                      >
                        1h
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoPromoteInterval(120)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          autoPromoteInterval === 120
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-indigo-100'
                        }`}
                      >
                        2h
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {errors.autoPromoteInterval && <p className="text-red-500 text-sm mt-1">{errors.autoPromoteInterval}</p>}
            </div>
          )}

          {/* Invitees */}
          <div>
            <h3 className="mb-4">
              {inviteMode === 'priority' ? 'Priority Invitees *' : 'Invitees *'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {inviteMode === 'priority'
                ? 'Add invitees in order of priority. The first person will be invited immediately. If they decline, the next person will be invited.'
                : 'Add all the people you want to invite. Everyone will receive the invitation at the same time.'}
            </p>

            {/* Add Invitee Form */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={newInviteeName}
                  onChange={(e) => setNewInviteeName(e.target.value)}
                  placeholder="Name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInvitee();
                    }
                  }}
                />
                {errors.inviteeName && <p className="text-red-500 text-sm mt-1">{errors.inviteeName}</p>}
              </div>
              <div className="flex-1">
                <input
                  type="email"
                  value={newInviteeEmail}
                  onChange={(e) => setNewInviteeEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInvitee();
                    }
                  }}
                />
                {errors.inviteeEmail && <p className="text-red-500 text-sm mt-1">{errors.inviteeEmail}</p>}
              </div>
              <div className="flex-1">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={newInviteePhone}
                    onChange={(e) => setNewInviteePhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddInvitee();
                      }
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddInvitee}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 whitespace-nowrap self-start"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Contact Picker */}
            {availableContacts.length > 0 && (
              <div className="mb-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
                <button
                  type="button"
                  onClick={() => setShowContactPicker(!showContactPicker)}
                  className="w-full px-4 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between shadow-sm border border-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-600" />
                    <span className="font-medium">Select from Contacts</span>
                    <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                      {availableContacts.length} available
                    </span>
                  </div>
                  <span className="text-gray-400">{showContactPicker ? '▼' : '▶'}</span>
                </button>
                
                {showContactPicker && (
                  <div className="mt-3 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-inner">
                    {availableContacts.map(contact => (
                      <button
                        key={contact.email}
                        type="button"
                        onClick={() => handleAddFromContact(contact)}
                        className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-b-0 flex items-center gap-3 group"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold">
                            {contact.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">
                            {contact.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                        </div>
                        <Plus className="w-5 h-5 text-gray-400 group-hover:text-indigo-600" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Invitee List */}
            {invitees.length > 0 && (
              <div className="space-y-2">
                {invitees.map((invitee, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    {/* Priority controls - only show in priority mode */}
                    {inviteMode === 'priority' && (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleMovePriority(index, 'up')}
                          disabled={index === 0}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMovePriority(index, 'down')}
                          disabled={index === invitees.length - 1}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Priority number - only show in priority mode */}
                    {inviteMode === 'priority' && (
                      <div className="flex items-center justify-center min-w-[2rem] h-8 bg-indigo-600 text-white rounded-full text-sm">
                        {index + 1}
                      </div>
                    )}

                    {/* All Invited indicator - only show in first-come-first-serve mode */}
                    {inviteMode === 'first-come-first-serve' && (
                      <div className="flex items-center justify-center w-2 h-2 bg-purple-600 rounded-full"></div>
                    )}

                    <div className="flex-1">
                      <p className="text-sm">{invitee.name}</p>
                      <p className="text-xs text-gray-500">{invitee.email || invitee.phone}</p>
                      {invitee.email && invitee.phone && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {invitee.phone}
                        </p>
                      )}
                    </div>

                    {/* Status badge - only show in priority mode for first invitee */}
                    {inviteMode === 'priority' && index === 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Will be invited first
                      </span>
                    )}

                    {/* All Invited badge - show for all in first-come-first-serve mode */}
                    {inviteMode === 'first-come-first-serve' && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                        Will be invited
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveInvitee(index)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Remove invitee"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {errors.invitees && <p className="text-red-500 text-sm mt-1">{errors.invitees}</p>}
            {duplicateAlert && (
              <p className="text-red-500 text-sm mt-1">
                Email {duplicateAlert} is already added.
              </p>
            )}
          </div>

          {/* SMS Notification Options (hidden for MVP) */}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { Calendar, Clock, MapPin, Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import type { Event, Invitee } from '../types';

interface CreateEventProps {
  currentUser: { email: string; name: string };
  onCreateEvent: (event: Omit<Event, 'id' | 'organizer' | 'createdAt'>) => void;
  onCancel: () => void;
}

export function CreateEvent({
  currentUser,
  onCreateEvent,
  onCancel,
}: CreateEventProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [newInviteeEmail, setNewInviteeEmail] = useState('');
  const [newInviteeName, setNewInviteeName] = useState('');

  const handleAddInvitee = () => {
    if (newInviteeEmail && newInviteeName) {
      const newInvitee: Invitee = {
        email: newInviteeEmail.trim(),
        name: newInviteeName.trim(),
        priority: invitees.length,
        status: invitees.length === 0 ? 'invited' : 'pending', // First invitee gets invited immediately
      };
      setInvitees([...invitees, newInvitee]);
      setNewInviteeEmail('');
      setNewInviteeName('');
    }
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

    if (!title || !date || !time || invitees.length === 0) {
      alert('Please fill in all required fields and add at least one invitee');
      return;
    }

    const event: Omit<Event, 'id' | 'organizer' | 'createdAt'> = {
      title,
      description,
      date,
      time,
      location,
      invitees,
    };

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Invitees */}
          <div>
            <h3 className="mb-4">Priority Invitees *</h3>
            <p className="text-sm text-gray-600 mb-4">
              Add invitees in order of priority. The first person will be invited
              immediately. If they decline, the next person will be invited.
            </p>

            {/* Add Invitee Form */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="text"
                value={newInviteeName}
                onChange={(e) => setNewInviteeName(e.target.value)}
                placeholder="Name"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddInvitee();
                  }
                }}
              />
              <input
                type="email"
                value={newInviteeEmail}
                onChange={(e) => setNewInviteeEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddInvitee();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddInvitee}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Invitee List */}
            {invitees.length > 0 && (
              <div className="space-y-2">
                {invitees.map((invitee, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
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

                    <div className="flex items-center justify-center min-w-[2rem] h-8 bg-indigo-600 text-white rounded-full text-sm">
                      {index + 1}
                    </div>

                    <div className="flex-1">
                      <p className="text-sm">{invitee.name}</p>
                      <p className="text-xs text-gray-500">{invitee.email}</p>
                    </div>

                    {index === 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Will be invited first
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
          </div>

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
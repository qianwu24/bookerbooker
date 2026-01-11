import { User, Mail, Calendar, Trash2, Search, Phone } from 'lucide-react';
import { useState } from 'react';
import type { Contact } from '../types';

interface ContactListProps {
  contacts: Contact[];
  onDeleteContact: (email: string) => void;
}

export function ContactList({ contacts, onDeleteContact }: ContactListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mb-6">
          <User className="w-12 h-12 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Contacts Yet</h2>
        <p className="text-gray-600 text-center max-w-md">
          Your contact list will automatically populate when you invite people to events. Start creating events to build your network!
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with Search */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Contact List</h2>
            <p className="text-sm text-gray-600 mt-1">
              {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} saved
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Contact Cards */}
      <div className="space-y-3">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No contacts match your search.</p>
          </div>
        ) : (
          filteredContacts
            .sort((a, b) => b.lastInvitedAt.localeCompare(a.lastInvitedAt))
            .map((contact) => (
              <div
                key={contact.email}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-lg">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {contact.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </div>

                      {/* Phone Number */}
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          <span>{contact.phone}</span>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Invited to <span className="font-semibold text-indigo-600">{contact.eventCount}</span> {contact.eventCount === 1 ? 'event' : 'events'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">•</span>
                          <span>Last invited: {formatDate(contact.lastInvitedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${contact.name} from contacts?`)) {
                        onDeleteContact(contact.email);
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove from contacts"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
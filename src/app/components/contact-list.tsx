import { User, Mail, Calendar, Trash2, Search, Phone, Plus, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { Contact } from '../types';

interface ContactListProps {
  contacts: Contact[];
  onDeleteContact: (contactId: string) => void;
  onAddContact?: (contact: { name: string; email?: string; phone?: string }) => Promise<boolean>;
}

export function ContactList({ contacts, onDeleteContact, onAddContact }: ContactListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '' });
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const filteredContacts = contacts.filter(
    (contact) =>
      (contact.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.phone || '').includes(searchQuery)
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format phone number for display: +1 (555) 123-4567
  const formatPhoneDisplay = (phone: string): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    } else if (digits.length > 10) {
      const countryCode = digits.slice(0, digits.length - 10);
      const rest = digits.slice(-10);
      return `+${countryCode} (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
    }
    return phone;
  };

  // Format phone input as user types: (555) 123-4567
  const formatPhoneInput = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  // Handle phone input change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setNewContact({ ...newContact, phone: formatted });
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim()) {
      setAddError('Name is required');
      return;
    }
    if (!newContact.phone.trim()) {
      setAddError('Phone number is required');
      return;
    }
    
    setIsAdding(true);
    setAddError('');
    
    try {
      // Combine country code with phone digits
      const phoneDigits = newContact.phone.replace(/\D/g, '');
      const fullPhone = `${phoneCountryCode}${phoneDigits}`;
      
      const success = await onAddContact?.({
        name: newContact.name.trim(),
        email: newContact.email.trim() || undefined,
        phone: fullPhone,
      });
      
      if (success) {
        setNewContact({ name: '', email: '', phone: '' });
        setPhoneCountryCode('+1');
        setShowAddForm(false);
      }
    } catch (error) {
      setAddError('Failed to add contact');
    } finally {
      setIsAdding(false);
    }
  };

  // Inline Add Contact Form JSX (not a component to avoid focus loss on re-render)
  const addContactFormJSX = (
    <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Add New Contact</h3>
        <button
          onClick={() => {
            setShowAddForm(false);
            setNewContact({ name: '', email: '', phone: '' });
            setPhoneCountryCode('+1');
            setAddError('');
          }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            value={newContact.name}
            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
            placeholder="John Doe"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={newContact.email}
            onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
            placeholder="john@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
          <div className="flex gap-2">
            <select
              value={phoneCountryCode}
              onChange={(e) => setPhoneCountryCode(e.target.value)}
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
              value={newContact.phone}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              required
            />
          </div>
        </div>
        
        {addError && (
          <p className="text-sm text-red-600">{addError}</p>
        )}
        
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleAddContact}
            disabled={isAdding}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isAdding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Contact
              </>
            )}
          </button>
          <button
            onClick={() => {
              setShowAddForm(false);
              setNewContact({ name: '', email: '', phone: '' });
              setPhoneCountryCode('+1');
              setAddError('');
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  if (contacts.length === 0 && !showAddForm) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mb-6">
            <User className="w-12 h-12 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Contacts Yet</h2>
          <p className="text-gray-600 text-center max-w-md mb-6">
            Your contact list will automatically populate when you invite people to events, or you can add contacts manually.
          </p>
          {onAddContact && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Your First Contact
            </button>
          )}
        </div>
        {showAddForm && addContactFormJSX}
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
          {onAddContact && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          )}
        </div>

        {/* Add Contact Form */}
        {showAddForm && addContactFormJSX}

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
            .sort((a, b) => (b.lastInvitedAt || '').localeCompare(a.lastInvitedAt || ''))
            .map((contact) => (
              <div
                key={contact.id}
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
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}

                      {/* Phone Number */}
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          <span>{formatPhoneDisplay(contact.phone)}</span>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Invited to <span className="font-semibold text-indigo-600">{contact.eventCount ?? 0}</span> {(contact.eventCount ?? 0) === 1 ? 'event' : 'events'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">•</span>
                          <span>Last invited: {formatDate(contact.lastInvitedAt ?? contact.updatedAt ?? contact.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${contact.name} from contacts?`)) {
                        onDeleteContact(contact.id);
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
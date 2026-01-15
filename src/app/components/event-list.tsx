import { useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { EventCard } from './event-card';
import { calculateEventStatuses } from '../../lib/event-status';
import type { Event, InviteeStatus } from '../types';

interface EventListProps {
  events: Event[];
  currentUser: { email: string; name: string };
  onUpdateInviteeStatus: (
    eventId: string,
    inviteeEmail: string,
    status: InviteeStatus
  ) => void;
  onCancelEvent: (eventId: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export function EventList({
  events,
  currentUser,
  onUpdateInviteeStatus,
  onCancelEvent,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: EventListProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Intersection Observer callback for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasMore && !loadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore]);

  useEffect(() => {
    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(handleObserver, {
      rootMargin: '100px', // Trigger slightly before reaching the bottom
    });

    // Observe the sentinel element
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div>
      {sortedEvents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">
            No events yet. Create your first event!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedEvents.map((event) => {
            const { confirmationStatus, timeStatus } = calculateEventStatuses(event);
            return (
              <EventCard
                key={event.id}
                event={event}
                currentUser={currentUser}
                onUpdateInviteeStatus={onUpdateInviteeStatus}
                onCancelEvent={onCancelEvent}
                confirmationStatus={confirmationStatus}
                timeStatus={timeStatus}
              />
            );
          })}
          
          {/* Sentinel element for infinite scroll */}
          <div ref={loadMoreRef} className="h-1" />
          
          {/* Loading indicator */}
          {loadingMore && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="ml-2 text-gray-500">Loading more events...</span>
            </div>
          )}
          
          {/* End of list indicator */}
          {!hasMore && sortedEvents.length > 0 && (
            <div className="text-center py-4 text-gray-400 text-sm">
              No more events
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Global history atom — append-only, capped at 200, feeds the bottom ticker
// (last 20) and the personal dashboard.

import { atom, computed } from 'nanostores';
import type { HistoryEvent, TimelineEventType } from '../lib/types';

export const HISTORY_CAP = 200;
export const TICKER_DISPLAY = 20;

/** Append-only global event log. Capped at HISTORY_CAP (most recent kept). */
export const globalHistory = atom<HistoryEvent[]>([]);

/** Last 20 events for the bottom ticker (most recent first). */
export const tickerEvents = computed(globalHistory, (h) => {
  return h.slice(Math.max(0, h.length - TICKER_DISPLAY)).reverse();
});

/** Hydrate from persistence. */
export function hydrateHistory(events: HistoryEvent[]): void {
  globalHistory.set(events.slice(-HISTORY_CAP));
}

/** Snapshot for persistence. */
export function snapshotHistory(): HistoryEvent[] {
  return globalHistory.get();
}

/** Append an event, evicting the oldest if over cap. Returns the appended event. */
export function appendEvent(e: HistoryEvent): HistoryEvent {
  const next = [...globalHistory.get(), e];
  if (next.length > HISTORY_CAP) next.shift();
  globalHistory.set(next);
  return e;
}

/** Build a HistoryEvent with a fresh id/timestamp. */
export function makeEvent(
  type: TimelineEventType,
  payload: { countryId?: string; userId: string; message: string; id?: string; timestamp?: number },
): HistoryEvent {
  return {
    id: payload.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2)),
    type,
    countryId: payload.countryId,
    userId: payload.userId,
    message: payload.message,
    timestamp: payload.timestamp ?? Date.now(),
  };
}
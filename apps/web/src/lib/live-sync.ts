// Live API sync — connects the front to the backend's public feed.
//
// 1) SSE /worldbid/activity: server activity events (bid_placed, bid_paid,
//    bid_outbid, bid_expired) stream into the `activity` atom that the
//    LiveActivity island renders. Reconciles into LegacyActivityEntry shape.
// 2) Spots re-sync on each message: server ownership truth refreshes the
//    bids/countries atoms (same path as the boot-time syncFromServer).
//
// Reconnecting EventSource: the browser retries automatically; we also
// re-sync spots after every message. No-ops when the API URL is unset.

import { isServerApiEnabled } from './api-http';
import { syncFromServer } from './server-sync';
import { activity } from '../stores/worldbid';
import type { LegacyActivityEntry } from './seed';

interface ServerActivityEvent {
  id: string;
  type: 'bid_placed' | 'bid_paid' | 'bid_outbid' | 'bid_expired';
  countryId: string | null;
  alias: string;
  amount: number | null;
  message: string | null;
  createdAt: string;
}

const MAX_ACTIVITY = 60;

function toLegacy(e: ServerActivityEvent): LegacyActivityEntry {
  return {
    id: e.id,
    username: e.alias,
    iso2: e.countryId ?? '',
    amount: e.amount != null ? Number(e.amount) : 0,
    avatarColor: '#3B82F6',
    timestamp: new Date(e.createdAt).getTime(),
  };
}

/** Open the SSE feed and keep the legacy activity atom fresh. Returns close(). */
export function connectActivityFeed(): () => void {
  if (!isServerApiEnabled() || typeof window === 'undefined') return () => {};

  const es = new EventSource(
    (import.meta.env.PUBLIC_WORLDBID_API_URL as string) + '/activity-stream',
  );

  es.onmessage = (ev: MessageEvent) => {
    try {
      const rows = JSON.parse(ev.data as string) as ServerActivityEvent[];
      if (!Array.isArray(rows)) return;
      activity.set(
        rows
          .filter((e) => e.countryId)
          .map(toLegacy)
          .slice(0, MAX_ACTIVITY),
      );
      // Ownership may have changed server-side — refresh spot truth cheaply.
      void syncFromServer();
    } catch {
      /* malformed frame — skip */
    }
  };

  es.onerror = () => {
    // EventSource auto-reconnects; nothing to do.
  };

  return () => es.close();
}
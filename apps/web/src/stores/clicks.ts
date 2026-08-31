// Click tracking atoms — debounced per user per country (3s), per-URL counts.

import { atom, computed } from 'nanostores';
import type { ClickEvent } from '../lib/types';

/** All recorded clicks (for geo breakdown + personal dashboard). */
export const clickEvents = atom<ClickEvent[]>([]);

/** Last-click timestamp per (userId+iso2) key, for the 3s debounce. */
export const lastClickTs = atom<Record<string, number>>({});

/** Total clicks per country, derived from clickEvents. Recomputes on append. */
export const countryTotalClicks = computed(clickEvents, (events) => {
  const map: Record<string, number> = {};
  for (const e of events) {
    map[e.countryId] = (map[e.countryId] || 0) + 1;
  }
  return map;
});

export const CLICK_DEBOUNCE_MS = 3000;

/** Hydrate clicks from persistence (carried via country.totalClicks only —
 *  raw click events are NOT persisted to keep localStorage small). */
export function hydrateClicks(countryTotals: Record<string, number>): void {
  // Reconstruct a minimal clickEvents list so countryTotalClicks computes.
  // We don't persist raw events; totals are persisted on the country record.
  const events: ClickEvent[] = [];
  for (const [iso2, n] of Object.entries(countryTotals)) {
    for (let i = 0; i < n; i++) {
      events.push({ id: 'restored-' + iso2 + '-' + i, countryId: iso2, url: '', origin: { country: 'Unknown', region: 'Global' }, userId: '', timestamp: 0 });
    }
  }
  clickEvents.set(events);
  lastClickTs.set({});
}

/** Snapshot total clicks per country for persistence onto the country record. */
export function snapshotCountryClicks(): Record<string, number> {
  return countryTotalClicks.get();
}
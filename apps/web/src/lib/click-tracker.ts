// Click tracker — the click-tracking capability.
//
// Debounced per user per country (3s). Geolocation is OPTIONAL and fails open
// to { country: 'Unknown', region: 'Global' } when navigator.geolocation is
// unavailable or denied. Increments country.totalClicks + websiteClicks[url]
// and appends a `click` HistoryEvent.
//
// The tracker is the SINGLE write path for clicks: islands + the globe script
// call recordClick(), never the atoms directly.

import type { ClickEvent, ClickOrigin, NewClickInput } from './types';
import { clickEvents, lastClickTs, CLICK_DEBOUNCE_MS } from '../stores/clicks';
import { countries, bids } from '../stores/bids';
import { appendEvent, makeEvent } from '../stores/history';

export type ClickResult = { ok: true; event: ClickEvent } | { ok: false; error: 'debounced' | 'unknown-country' };

/** Debounce key: per user + per country. */
function debounceKey(userId: string, countryId: string): string {
  return userId + '|' + countryId;
}

/** Record a click, enforcing the 3s per-user/per-country debounce. */
export function recordClick(input: NewClickInput): ClickResult {
  const c = countries.get()[input.countryId];
  if (!c) return { ok: false, error: 'unknown-country' };

  const now = Date.now();
  const key = debounceKey(input.userId, input.countryId);
  const lastMap = lastClickTs.get();
  const last = lastMap[key] ?? 0;
  // `last === 0` means "never clicked" — allow (otherwise a mocked or early
  // wall-clock would falsely debounce the first ever click).
  if (last > 0 && now - last < CLICK_DEBOUNCE_MS) {
    return { ok: false, error: 'debounced' };
  }

  // Resolve origin — fail open if geolocation is unavailable.
  const origin: ClickOrigin = input.origin ?? { country: 'Unknown', region: 'Global' };

  const event: ClickEvent = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'click-' + now + '-' + Math.random().toString(36).slice(2),
    countryId: input.countryId,
    url: input.url,
    origin,
    userId: input.userId,
    timestamp: now,
  };

  // Append to clickEvents (drives countryTotalClicks computed) + update
  // lastClickTs (debounce state) + patch the country's totalClicks +
  // websiteClicks[url] (persisted on the country record).
  clickEvents.set([...clickEvents.get(), event]);
  lastClickTs.set({ ...lastClickTs.get(), [key]: now });

  const prev = countries.get()[input.countryId];
  const websiteClicks = { ...prev.websiteClicks, [input.url]: (prev.websiteClicks[input.url] || 0) + 1 };
  countries.set({
    ...countries.get(),
    [input.countryId]: { ...prev, totalClicks: prev.totalClicks + 1, websiteClicks },
  });

  appendEvent(makeEvent('click', {
    countryId: input.countryId,
    userId: input.userId,
    message: 'Click on ' + input.countryId + ' from ' + origin.country + (origin.region && origin.region !== 'Global' ? ' / ' + origin.region : ''),
  }));

  return { ok: true, event };
}

/** Resolve geolocation asynchronously; fail open to Unknown/Global. */
export function resolveOrigin(): Promise<ClickOrigin> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ country: 'Unknown', region: 'Global' });
      return;
    }
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      resolve({ country: 'Unknown', region: 'Global' });
    };
    navigator.geolocation.getCurrentPosition(
      () => {
        // We don't reverse-geocode in the mock — fail open to keep it simple.
        if (settled) return;
        settled = true;
        resolve({ country: 'Unknown', region: 'Global' });
      },
      fail,
      { timeout: 4000, maximumAge: 60_000 },
    );
    // Safety timeout in case the geolocation prompt never resolves.
    setTimeout(fail, 5000);
  });
}
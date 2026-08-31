import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordClick, resolveOrigin } from '../click-tracker';
import { clickEvents, lastClickTs, hydrateClicks } from '../../stores/clicks';
import { countries, bids, hydrateBidsCountries } from '../../stores/bids';
import { globalHistory, hydrateHistory } from '../../stores/history';
import { seedCountries } from '../../lib/seed';
import type { NewClickInput } from '../../lib/types';

beforeEach(() => {
  hydrateBidsCountries(seedCountries());
  hydrateHistory([]);
  clickEvents.set([]);
  lastClickTs.set({});
  // ensure AR is occupied by u1 so clicks attribute to u1
  if (countries.get()['AR'].activeBidId) {
    const bidId = countries.get()['AR'].activeBidId!;
    const b = bids.get()[bidId];
    bids.set({ ...bids.get(), [bidId]: { ...b, userId: 'u1' } });
  }
});

function mkClick(countryId: string, url: string, userId = 'u1', ts?: number): NewClickInput {
  return { countryId, url, userId, origin: { country: 'Unknown', region: 'Global' }, ...(ts !== undefined ? { timestamp: ts } : {}) };
}

describe('recordClick — 3s debounce', () => {
  it('records the first click', () => {
    const r = recordClick(mkClick('AR', 'https://x'));
    expect(r.ok).toBe(true);
  });

  it('debounces a second click < 3s on same country+user', () => {
    const t0 = 1000;
    // patch Date.now for determinism
    const realNow = Date.now;
    Date.now = () => t0;
    try {
      const r1 = recordClick(mkClick('AR', 'https://x'));
      expect(r1.ok).toBe(true);
      const r2 = recordClick(mkClick('AR', 'https://x'));
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.error).toBe('debounced');
    } finally {
      Date.now = realNow;
    }
  });

  it('allows a second click >= 3s later', () => {
    let t = 1000;
    const realNow = Date.now;
    Date.now = () => t;
    try {
      const r1 = recordClick(mkClick('AR', 'https://x'));
      expect(r1.ok).toBe(true);
      t = 1000 + 3001;
      const r2 = recordClick(mkClick('AR', 'https://x'));
      expect(r2.ok).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it('different countries are not debounced against each other', () => {
    let t = 1000;
    const realNow = Date.now;
    Date.now = () => t;
    try {
      const r1 = recordClick(mkClick('AR', 'https://x'));
      const r2 = recordClick(mkClick('BR', 'https://x'));
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it('rejects unknown country', () => {
    const r = recordClick(mkClick('QQ', 'https://x'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('unknown-country');
  });
});

describe('recordClick — side effects', () => {
  it('increments country.totalClicks + websiteClicks[url]', () => {
    const before = countries.get()['AR'].totalClicks;
    recordClick(mkClick('AR', 'https://x.com'));
    expect(countries.get()['AR'].totalClicks).toBe(before + 1);
    expect(countries.get()['AR'].websiteClicks['https://x.com']).toBe(1);
    recordClick(mkClick('AR', 'https://x.com'));
    expect(countries.get()['AR'].websiteClicks['https://x.com']).toBeGreaterThanOrEqual(1);
  });

  it('appends a click HistoryEvent', () => {
    hydrateHistory([]);
    recordClick(mkClick('AR', 'https://x'));
    const clickEvents = globalHistory.get().filter((h) => h.type === 'click');
    expect(clickEvents.length).toBe(1);
  });
});

describe('resolveOrigin — geolocation fail-open', () => {
  it('resolves to Unknown/Global when geolocation is unavailable', async () => {
    const orig = (globalThis as any).navigator;
    (globalThis as any).navigator = { geolocation: undefined };
    try {
      const o = await resolveOrigin();
      expect(o.country).toBe('Unknown');
      expect(o.region).toBe('Global');
    } finally {
      (globalThis as any).navigator = orig;
    }
  });

  it('resolves to Unknown/Global when geolocation denies', async () => {
    const orig = (globalThis as any).navigator;
    (globalThis as any).navigator = {
      geolocation: {
        getCurrentPosition: (_s: unknown, err: (e: unknown) => void) => err(new Error('denied')),
      },
    };
    try {
      const o = await resolveOrigin();
      expect(o.country).toBe('Unknown');
    } finally {
      (globalThis as any).navigator = orig;
    }
  });
});
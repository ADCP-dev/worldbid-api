import { describe, it, expect, beforeEach } from 'vitest';
import { createLocalStorageApi, minBidFor } from '../api-mock';
import { countries, bids, hydrateBidsCountries } from '../../stores/bids';
import { userSession, setSession } from '../../stores/session';
import { globalHistory, hydrateHistory } from '../../stores/history';
import { clickEvents, lastClickTs } from '../../stores/clicks';
import { seedCountries } from '../../lib/seed';
import type { NewBidInput, NewClickInput, User } from '../../lib/types';

const api = createLocalStorageApi();

beforeEach(() => {
  localStorage.clear();
  hydrateBidsCountries(seedCountries());
  hydrateHistory([]);
  clickEvents.set([]);
  lastClickTs.set({});
  setSession(null);
});

function mkBid(countryId: string, amount: number, userId = 'u1', alias = 'Alice'): NewBidInput {
  return { countryId, userId, alias, email: 'a@x', url: 'https://x', logoUrl: '', pitch: 'hi', amount, accentColor: '#3B82F6' };
}

describe('api.postBid', () => {
  it('201 on a valid claim (vacant)', async () => {
    const ar = countries.get()['AR'];
    countries.set({ ...countries.get(), AR: { ...ar, activeBidId: null, bidHistory: [] } });
    const r = await api.postBid(mkBid('AR', 2.5));
    expect(r.status).toBe(201);
    if ('body' in r) expect(r.body.amount).toBe(2.5);
  });

  it('409 on outbid below current + 0.50 (spec scenario)', async () => {
    // DE seed = $45; outbid with $45.25 (< 45.50) -> 409
    const r = await api.postBid(mkBid('DE', 45.25));
    expect(r.status).toBe(409);
    if ('error' in r) expect(r.error).toMatch(/outbid/i);
  });

  it('400 on developer slot (IB)', async () => {
    const r = await api.postBid(mkBid('IB', 1000));
    expect(r.status).toBe(400);
  });

  it('re-evaluates achievements for the bidding user when session matches', async () => {
    const u: User = { id: 'u1', alias: 'Alice', email: 'a@x', accentColor: '#3B82F6', ownedCountries: [], achievements: [], totalClicks: 0, totalInvested: 0, createdAt: 1 };
    setSession(u);
    const ar = countries.get()['AR'];
    countries.set({ ...countries.get(), AR: { ...ar, activeBidId: null, bidHistory: [] } });
    const r = await api.postBid(mkBid('AR', 2.5, 'u1', 'Alice'));
    expect(r.status).toBe(201);
    const a = userSession.get()?.achievements ?? [];
    expect(a.find((x) => x.id === 'first_blood')?.unlockedAt).toBeGreaterThan(0);
  });
});

describe('api.getBid', () => {
  it('200 + Bid for an occupied country', async () => {
    const r = await api.getBid('US');
    expect(r.status).toBe(200);
    if ('body' in r) expect(r.body.countryId).toBe('US');
  });

  it('404 for a vacant country (spec scenario)', async () => {
    countries.set({ ...countries.get(), ZZ: { iso2: 'ZZ', name: 'Z', continent: 'AF', developer: false, activeBidId: null, totalClicks: 0, websiteClicks: {}, bidHistory: [] } });
    const r = await api.getBid('ZZ');
    expect(r.status).toBe(404);
  });
});

describe('api.getCountries', () => {
  it('200 + list, ?continent= filters', async () => {
    const r = await api.getCountries({ continent: 'EU' });
    expect(r.status).toBe(200);
    if ('body' in r) {
      expect(r.body.length).toBeGreaterThan(0);
      for (const c of r.body) expect(c.continent).toBe('EU');
    }
  });

  it('?status=claimed returns only countries with activeBidId', async () => {
    const r = await api.getCountries({ status: 'claimed' });
    if ('body' in r) {
      for (const c of r.body) expect(c.activeBidId).not.toBeNull();
    }
  });

  it('?status=vacant returns only countries without activeBidId', async () => {
    countries.set({ ...countries.get(), ZZ: { iso2: 'ZZ', name: 'Z', continent: 'AF', developer: false, activeBidId: null, totalClicks: 0, websiteClicks: {}, bidHistory: [] } });
    const r = await api.getCountries({ status: 'vacant' });
    if ('body' in r) {
      for (const c of r.body) expect(c.activeBidId).toBeNull();
      expect(r.body.map((c) => c.iso2)).toContain('ZZ');
    }
  });
});

describe('api.postClick', () => {
  it('429 on debounce (spec scenario)', async () => {
    let t = 1000;
    const realNow = Date.now;
    Date.now = () => t;
    try {
      const r1 = await api.postClick({ countryId: 'AR', url: 'https://x', userId: 'u1' });
      expect(r1.status).toBe(201);
      t = 1001;
      const r2 = await api.postClick({ countryId: 'AR', url: 'https://x', userId: 'u1' });
      expect(r2.status).toBe(429);
    } finally {
      Date.now = realNow;
    }
  });

  it('400 on unknown country', async () => {
    const r = await api.postClick({ countryId: 'QQ', url: 'https://x', userId: 'u1' });
    expect(r.status).toBe(400);
  });

  it('201 + ClickEvent on valid click', async () => {
    const r = await api.postClick({ countryId: 'AR', url: 'https://x', userId: 'u1' });
    expect(r.status).toBe(201);
    if ('body' in r) expect(r.body.countryId).toBe('AR');
  });
});

describe('api.getAchievements', () => {
  it('200 + achievement list for a seed user', async () => {
    const seedUserId = Object.values(bids.get())[0].userId;
    const r = await api.getAchievements(seedUserId);
    expect(r.status).toBe(200);
    if ('body' in r) expect(r.body.length).toBe(10);
  });

  it('404 for an unknown user', async () => {
    const r = await api.getAchievements('nonexistent');
    expect(r.status).toBe(404);
  });
});

describe('api.getUser', () => {
  it('200 + stub for a seed user (resolved via seed bid)', async () => {
    const seedUserId = Object.values(bids.get())[0].userId;
    const r = await api.getUser(seedUserId);
    expect(r.status).toBe(200);
  });

  it('404 for an unknown user', async () => {
    const r = await api.getUser('nonexistent');
    expect(r.status).toBe(404);
  });
});

describe('minBidFor re-export', () => {
  it('returns the engine minimum', () => {
    expect(typeof minBidFor('AR')).toBe('number');
  });
});
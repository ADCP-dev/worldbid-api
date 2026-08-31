import { describe, it, expect, beforeEach } from 'vitest';
import { loadAll, saveSession, saveCountries, saveHistory, K_COUNTRIES_DB, K_HISTORY, K_SESSION, cleanupOldKeys } from '../persistence';
import { seedCountries } from '../seed';
import type { CountriesDb, HistoryEvent, User } from '../types';

beforeEach(() => {
  localStorage.clear();
});

describe('persistence — non-destructive migration + idempotent guard', () => {
  it('seeds on first load when all keys empty and creates a guest session', () => {
    const { db, history, session } = loadAll();
    expect(session).not.toBeNull();
    expect(session?.alias).toBe('Guest');
    // 15 seeded countries + the vacant synthetic PLANE spot
    expect(Object.keys(db.countries).length).toBe(16);
    expect(db.countries['IB'].developer).toBe(true);
    expect(db.countries['PLANE'].activeBidId).toBeNull();
    expect(history.length).toBe(0);
    // seed persisted to localStorage
    expect(localStorage.getItem(K_COUNTRIES_DB)).not.toBeNull();
  });

  it('seed range spans $2.50-$150 inclusive', () => {
    const { db } = loadAll();
    const seededIsos = Object.values(db.countries).filter((c) => c.activeBidId).map((c) => c.iso2);
    const amounts = seededIsos.map((iso) => db.bids[db.countries[iso].activeBidId!].amount);
    expect(seededIsos.length).toBe(15);
    expect(Math.min(...amounts)).toBe(2.5);
    expect(Math.max(...amounts)).toBe(150);
  });

  it('IB developer slot is NOT user-claimable and has SOM·OS alias', () => {
    const { db } = loadAll();
    const ib = db.countries['IB'];
    expect(ib.developer).toBe(true);
    expect(db.bids[ib.activeBidId!].alias).toBe('SOM·OS');
  });

  it('migrates old 5 flat keys into the new 3-key shape without clearing old keys', () => {
    // Seed old keys
    localStorage.setItem('worldbid_bids', JSON.stringify([
      { id: 'old-1', iso2: 'US', username: 'Alice', email: 'a@x.com', websiteUrl: 'https://x.com', description: 'hi', amount: 10, avatarColor: '#3B82F6', timestamp: 1000 },
      { id: 'old-2', iso2: 'US', username: 'Bob', email: 'b@x.com', websiteUrl: 'https://y.com', description: 'yo', amount: 20, avatarColor: '#10B981', timestamp: 2000 },
    ]));
    localStorage.setItem('worldbid_clicks', JSON.stringify({ US: 7 }));
    localStorage.setItem('worldbid_activity', JSON.stringify([
      { id: 'a1', username: 'Alice', iso2: 'US', amount: 10, avatarColor: '#3B82F6', timestamp: 1000 },
    ]));

    const { db, history } = loadAll();
    // Old bids migrated; last bid wins as active (vitalicio)
    expect(db.countries['US']).toBeDefined();
    expect(db.countries['US'].activeBidId).toBe('old-2');
    expect(db.countries['US'].bidHistory).toEqual(['old-1', 'old-2']);
    expect(db.countries['US'].totalClicks).toBe(7);
    expect(db.bids['old-1'].alias).toBe('Alice');
    expect(history.length).toBe(1);
    expect(history[0].type).toBe('bid');
    // CRITICAL: old keys are NOT cleared (non-destructive)
    expect(localStorage.getItem('worldbid_bids')).not.toBeNull();
    expect(localStorage.getItem('worldbid_clicks')).not.toBeNull();
  });

  it('migration is idempotent — does not re-run once worldbid_countries_db exists', () => {
    localStorage.setItem('worldbid_bids', JSON.stringify([
      { id: 'old-1', iso2: 'US', username: 'Alice', amount: 10, timestamp: 1000 },
    ]));
    const first = loadAll();
    expect(first.db.bids['old-1']).toBeDefined();
    // Mutate persisted db to a sentinel and reload — migration must NOT overwrite
    const sentinel: CountriesDb = { countries: { ZZ: { iso2: 'ZZ', name: 'Z', continent: 'AF', developer: false, activeBidId: null, totalClicks: 0, websiteClicks: {}, bidHistory: [] } }, bids: {} };
    saveCountries(sentinel);
    const second = loadAll();
    expect(second.db.countries['ZZ']).toBeDefined();
    expect(second.db.bids['old-1']).toBeUndefined();
  });

  it('saveSession / saveHistory round-trip', () => {
    const u: User = {
      id: 'u1', alias: 'Alice', email: 'a@x.com', accentColor: '#3B82F6',
      ownedCountries: ['AR'], achievements: [], totalClicks: 0, totalInvested: 2.5, createdAt: 1,
    };
    saveSession(u);
    const evs: HistoryEvent[] = [{ id: 'e1', type: 'bid', countryId: 'AR', userId: 'u1', message: 'hi', timestamp: 1 }];
    saveHistory(evs);
    const { session, history } = loadAll();
    expect(session?.alias).toBe('Alice');
    expect(history.length).toBe(1);
  });

  it('saveSession(null) removes the session key', () => {
    saveSession({ id: 'u', alias: 'x', email: 'x@x', accentColor: '#000', ownedCountries: [], achievements: [], totalClicks: 0, totalInvested: 0, createdAt: 1 });
    expect(localStorage.getItem(K_SESSION)).not.toBeNull();
    saveSession(null);
    expect(localStorage.getItem(K_SESSION)).toBeNull();
  });

  it('history is capped at 200 on save', () => {
    const evs: HistoryEvent[] = Array.from({ length: 250 }, (_, i) => ({ id: 'e' + i, type: 'click', userId: 'u', message: 'm', timestamp: i }));
    saveHistory(evs);
    const stored = JSON.parse(localStorage.getItem(K_HISTORY) || '[]') as HistoryEvent[];
    expect(stored.length).toBe(200);
    // most recent 200 kept (timestamps 50..249)
    expect(stored[0].timestamp).toBe(50);
    expect(stored[199].timestamp).toBe(249);
  });

  it('cleanupOldKeys removes the 5 old keys', () => {
    localStorage.setItem('worldbid_bids', '[]');
    localStorage.setItem('worldbid_selected', 'US');
    localStorage.setItem('worldbid_pov', '{}');
    localStorage.setItem('worldbid_clicks', '{}');
    localStorage.setItem('worldbid_activity', '[]');
    cleanupOldKeys();
    expect(localStorage.getItem('worldbid_bids')).toBeNull();
    expect(localStorage.getItem('worldbid_selected')).toBeNull();
    expect(localStorage.getItem('worldbid_pov')).toBeNull();
    expect(localStorage.getItem('worldbid_clicks')).toBeNull();
    expect(localStorage.getItem('worldbid_activity')).toBeNull();
  });

  it('seedCountries() returns 15 countries + vacant PLANE with stable structure', () => {
    const a = seedCountries();
    const b = seedCountries();
    // 15 seeded countries + the synthetic PLANE spot
    expect(Object.keys(a.countries).length).toBe(16);
    expect(a.countries['PLANE'].activeBidId).toBeNull();
    expect(Object.keys(a.countries).sort()).toEqual(Object.keys(b.countries).sort());
    // structural equality ignoring volatile placedAt timestamps
    for (const iso2 of Object.keys(a.countries)) {
      expect(a.countries[iso2].iso2).toBe(b.countries[iso2].iso2);
      expect(a.countries[iso2].developer).toBe(b.countries[iso2].developer);
      if (!a.countries[iso2].activeBidId || !b.countries[iso2].activeBidId) continue;
      expect(a.bids[a.countries[iso2].activeBidId!].amount).toBe(b.bids[b.countries[iso2].activeBidId!].amount);
    }
  });

  it('a PLANE bid placed via placePlaneBid survives a loadAll() reload', async () => {
    // hydrate the atoms via the barrel loadAll (seeds countries incl. PLANE)
    const { loadAll: hydrateAll } = await import('../../stores/worldbid');
    hydrateAll();
    // place a $20 plane bid through the engine
    const { placePlaneBid } = await import('../bid-engine');
    const result = placePlaneBid({
      countryId: 'PLANE',
      userId: 'test-user',
      alias: 'PlaneOwner',
      email: '',
      url: 'https://planeowner.dev',
      logoUrl: '',
      pitch: 'Flying high',
      amount: 20,
      accentColor: '#3B82F6',
    });
    expect(result.ok).toBe(true);
    // persist through the atoms snapshot
    const { saveCountries, K_COUNTRIES_DB } = await import('../persistence');
    const { snapshotDb } = await import('../../stores/bids');
    saveCountries(snapshotDb());
    expect(localStorage.getItem(K_COUNTRIES_DB)).not.toBeNull();
    // reload
    const reloaded = loadAll();
    const plane = reloaded.db.countries['PLANE'];
    expect(plane).toBeDefined();
    expect(plane.activeBidId).not.toBeNull();
    const bid = reloaded.db.bids[plane.activeBidId!];
    expect(bid.amount).toBe(20);
    expect(bid.alias).toBe('PlaneOwner');
  });
});
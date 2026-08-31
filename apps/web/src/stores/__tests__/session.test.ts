import { describe, it, expect, beforeEach } from 'vitest';
import { userSession, achievements, ownedCountries, hydrateSession, setSession } from '../session';
import { bids, countries, writeBid, hydrateBidsCountries } from '../bids';
import { seedCountries } from '../../lib/seed';
import type { User } from '../../lib/types';

beforeEach(() => {
  hydrateBidsCountries(seedCountries());
  userSession.set(null);
  achievements.set([]);
});

const u1: User = {
  id: 'u1', alias: 'Alice', email: 'a@x', accentColor: '#3B82F6',
  ownedCountries: [], achievements: [], totalClicks: 0, totalInvested: 0, createdAt: 1,
};

describe('session — ownedCountries recomputes on outbid write-through', () => {
  it('ownedCountries returns countries where active bid belongs to userId', () => {
    // Place a fresh bid as u1 on AR (currently AR has a seed bid by seed-user-AR)
    writeBid({ id: 'b-u1', countryId: 'AR', userId: 'u1', alias: 'Alice', email: 'a@x', url: '', logoUrl: '', pitch: '', amount: 50, accentColor: '#000', placedAt: 1 }, countries.get()['AR'].activeBidId);
    expect(ownedCountries.get()('u1')).toContain('AR');
  });

  it('outbid dethrones: ownedCountries updates after write-through', () => {
    writeBid({ id: 'b-u1', countryId: 'AR', userId: 'u1', alias: 'Alice', email: 'a@x', url: '', logoUrl: '', pitch: '', amount: 50, accentColor: '#000', placedAt: 1 }, countries.get()['AR'].activeBidId);
    expect(ownedCountries.get()('u1')).toContain('AR');
    // u2 outbids
    writeBid({ id: 'b-u2', countryId: 'AR', userId: 'u2', alias: 'Bob', email: 'b@x', url: '', logoUrl: '', pitch: '', amount: 100, accentColor: '#000', placedAt: 2 }, 'b-u1');
    expect(ownedCountries.get()('u1')).not.toContain('AR');
    expect(ownedCountries.get()('u2')).toContain('AR');
    void bids;
  });

  it('hydrateSession + setSession round-trip', () => {
    hydrateSession(u1);
    expect(userSession.get()?.alias).toBe('Alice');
    expect(achievements.get()).toEqual([]);
    setSession({ ...u1, alias: 'Alicia' });
    expect(userSession.get()?.alias).toBe('Alicia');
    setSession(null);
    expect(userSession.get()).toBeNull();
    expect(achievements.get()).toEqual([]);
  });
});
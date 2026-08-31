import { describe, it, expect, beforeEach } from 'vitest';
import { bids, countries, writeBid, activeBidForResolved, heatColorForCountry, topBidsFor, hydrateBidsCountries } from '../bids';
import { seedCountries } from '../../lib/seed';

beforeEach(() => {
  const db = seedCountries();
  hydrateBidsCountries(db);
});

describe('writeBid — outbid write-through invariant', () => {
  it('appends a new bid and sets it as active (claim vacant)', () => {
    // Make AR vacant first
    const ar = countries.get()['AR'];
    countries.set({ ...countries.get(), AR: { ...ar, activeBidId: null, bidHistory: [] } });
    const newBid = { id: 'b1', countryId: 'AR', userId: 'u1', alias: 'Alice', email: 'a@x', url: 'https://x', logoUrl: '', pitch: 'hi', amount: 2.5, accentColor: '#3B82F6', placedAt: 1000 };
    writeBid(newBid, null);
    expect(countries.get()['AR'].activeBidId).toBe('b1');
    expect(countries.get()['AR'].bidHistory).toEqual(['b1']);
    expect(bids.get()['b1']).toBeDefined();
  });

  it('outbid dethrones: activeBidId swaps, old bid stays in bidHistory (top-3)', () => {
    const us = countries.get()['US'];
    const oldBidId = us.activeBidId!;
    const newBid = { id: 'b-outbid', countryId: 'US', userId: 'u2', alias: 'Bob', email: 'b@x', url: 'https://y', logoUrl: '', pitch: 'yo', amount: 200, accentColor: '#10B981', placedAt: 2000 };
    writeBid(newBid, oldBidId);
    expect(countries.get()['US'].activeBidId).toBe('b-outbid');
    expect(countries.get()['US'].bidHistory).toContain(oldBidId);
    expect(countries.get()['US'].bidHistory).toContain('b-outbid');
  });

  it('derived stores auto-re-derive after write-through (no stale cache)', () => {
    const us = countries.get()['US'];
    const oldBidId = us.activeBidId!;
    const oldAmount = bids.get()[oldBidId].amount;
    const oldTier = heatColorForCountry.get()('US').tier;
    // Outbid to a much higher amount
    writeBid({ id: 'b-hi', countryId: 'US', userId: 'u2', alias: 'Bob', email: 'b@x', url: '', logoUrl: '', pitch: '', amount: 600, accentColor: '#000', placedAt: 3000 }, oldBidId);
    expect(activeBidForResolved.get()('US')?.amount).toBe(600);
    expect(heatColorForCountry.get()('US').tier).toBe('L4');
    expect(oldTier).not.toBe('L4'); // sanity: it changed
    void oldAmount;
  });

  it('topBidsFor returns top 3 by amount desc after outbid', () => {
    const us = countries.get()['US'];
    const oldBidId = us.activeBidId!;
    writeBid({ id: 'b-hi', countryId: 'US', userId: 'u2', alias: 'Bob', email: 'b@x', url: '', logoUrl: '', pitch: '', amount: 5000, accentColor: '#000', placedAt: 4000 }, oldBidId);
    const top = topBidsFor.get()('US');
    expect(top.length).toBeGreaterThanOrEqual(2);
    expect(top[0].amount).toBe(5000);
    // descending
    for (let i = 1; i < top.length; i++) expect(top[i - 1].amount).toBeGreaterThanOrEqual(top[i].amount);
  });

  it('activeBidFor returns null for vacant country', () => {
    countries.set({ ...countries.get(), ZZ: { iso2: 'ZZ', name: 'Z', continent: 'AF', developer: false, activeBidId: null, totalClicks: 0, websiteClicks: {}, bidHistory: [] } });
    expect(activeBidForResolved.get()('ZZ')).toBeNull();
  });

  it('writeBid on unknown country is a no-op (defensive)', () => {
    const before = { ...bids.get() };
    writeBid({ id: 'b-unknown', countryId: 'QQ', userId: 'u', alias: 'x', email: 'x@x', url: '', logoUrl: '', pitch: '', amount: 5, accentColor: '#000', placedAt: 1 }, null);
    expect(bids.get()).toEqual(before);
  });
});
import { describe, it, expect, beforeEach } from 'vitest';
import { placeBid, activeBidFor, minBidFor, round2 } from '../bid-engine';
import { bids, countries, hydrateBidsCountries } from '../../stores/bids';
import { globalHistory, hydrateHistory } from '../../stores/history';
import { seedCountries } from '../../lib/seed';
import { MIN_STAKE } from '../../lib/heatmap';
import { minIncrementForCountry } from '../economy';
import type { NewBidInput } from '../../lib/types';

beforeEach(() => {
  hydrateBidsCountries(seedCountries());
  hydrateHistory([]);
});

function mkBid(countryId: string, amount: number, userId = 'u1', alias = 'Alice'): NewBidInput {
  return { countryId, userId, alias, email: 'a@x', url: 'https://x', logoUrl: '', pitch: 'hi', amount, accentColor: '#3B82F6' };
}

describe('placeBid — claim vacant', () => {
  it('claims a vacant country at MIN_STAKE ($2.50)', () => {
    // Make AR vacant
    const ar = countries.get()['AR'];
    countries.set({ ...countries.get(), AR: { ...ar, activeBidId: null, bidHistory: [] } });
    const r = placeBid(mkBid('AR', 2.5));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bid.amount).toBe(2.5);
      expect(activeBidFor('AR')?.id).toBe(r.bid.id);
    }
  });

  it('rejects below MIN_STAKE on vacant', () => {
    const ar = countries.get()['AR'];
    countries.set({ ...countries.get(), AR: { ...ar, activeBidId: null, bidHistory: [] } });
    const r = placeBid(mkBid('AR', 2.0));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/minimum/i);
  });

  it('rejects bid on developer slot (IB)', () => {
    const r = placeBid(mkBid('IB', 100));
    expect(r.ok).toBe(false);
  });

  it('rejects bid on unknown country', () => {
    const r = placeBid(mkBid('QQ', 100));
    expect(r.ok).toBe(false);
  });
});

describe('placeBid — outbid occupied', () => {
  it('rejects equal amount', () => {
    // US seed bid is $120
    const cur = activeBidFor('US')!.amount;
    const r = placeBid(mkBid('US', cur));
    expect(r.ok).toBe(false);
  });

  it('rejects below the tiered minimum', () => {
    const cur = activeBidFor('US')!.amount;
    const r = placeBid(mkBid('US', cur + 0.25));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/outbid/i);
  });

  it('accepts the tiered minimum (US $120 -> $132 at +10%)', () => {
    const cur = activeBidFor('US')!.amount;
    expect(cur).toBe(120);
    expect(minIncrementForCountry(cur)).toBe(132);
    const r = placeBid(mkBid('US', cur + 12));
    expect(r.ok).toBe(true);
  });

  it('outbid dethrones prior owner and appends outbid event (clicks preserved)', () => {
    // Make US vacant, claim as Alice with 50 clicks ($2.50 min), then Bob
    // outbids at the tiered minimum ($2.50 * 1.20 = $3.00).
    const us = countries.get()['US'];
    countries.set({ ...countries.get(), US: { ...us, activeBidId: null, bidHistory: [], totalClicks: 50 } });
    const r1 = placeBid(mkBid('US', 10, 'alice', 'Alice'));
    expect(r1.ok).toBe(true);
    // clicks before outbid = 50
    expect(countries.get()['US'].totalClicks).toBe(50);
    const r2 = placeBid(mkBid('US', 12, 'bob', 'Bob'));
    expect(r2.ok).toBe(true);
    // active owner is now Bob
    expect(activeBidFor('US')?.userId).toBe('bob');
    // clicks preserved (not transferred)
    expect(countries.get()['US'].totalClicks).toBe(50);
    // outbid event appended
    const outbidEvents = globalHistory.get().filter((h) => h.type === 'outbid');
    expect(outbidEvents.length).toBe(1);
    expect(outbidEvents[0].userId).toBe('bob');
  });

  it('claim vacant appends a bid event (not outbid)', () => {
    hydrateHistory([]);
    const ar = countries.get()['AR'];
    countries.set({ ...countries.get(), AR: { ...ar, activeBidId: null, bidHistory: [] } });
    placeBid(mkBid('AR', 2.5));
    const bidEvents = globalHistory.get().filter((h) => h.type === 'bid');
    expect(bidEvents.length).toBe(1);
  });
});

describe('minBidFor', () => {
  it('vacant -> MIN_STAKE ($2.50)', () => {
    const ar = countries.get()['AR'];
    countries.set({ ...countries.get(), AR: { ...ar, activeBidId: null, bidHistory: [] } });
    expect(minBidFor('AR')).toBe(MIN_STAKE);
  });
  it('occupied -> tiered minimum (US $120 -> $132 at +10%)', () => {
    const cur = activeBidFor('US')!.amount;
    expect(minBidFor('US')).toBe(132);
    expect(minBidFor('US')).toBe(round2(minIncrementForCountry(cur)));
  });
});

describe('activeBidFor', () => {
  it('returns null for vacant', () => {
    countries.set({ ...countries.get(), ZZ: { iso2: 'ZZ', name: 'Z', continent: 'AF', developer: false, activeBidId: null, totalClicks: 0, websiteClicks: {}, bidHistory: [] } });
    expect(activeBidFor('ZZ')).toBeNull();
  });
  it('returns the active Bid for occupied', () => {
    const a = activeBidFor('US');
    expect(a).not.toBeNull();
    expect(a?.countryId).toBe('US');
  });
});
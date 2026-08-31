import { describe, it, expect, beforeEach } from 'vitest';
import { personalDashboard, globalStats } from '../stats';
import { countries, bids, hydrateBidsCountries, writeBid } from '../../stores/bids';
import { clickEvents, hydrateClicks } from '../../stores/clicks';
import { globalHistory, hydrateHistory, appendEvent, makeEvent } from '../../stores/history';
import { seedCountries } from '../../lib/seed';
import type { ClickEvent, HistoryEvent } from '../../lib/types';

beforeEach(() => {
  hydrateBidsCountries(seedCountries());
  hydrateHistory([]);
  clickEvents.set([]);
});

function claim(userId: string, iso2: string, amount: number): void {
  const prev = countries.get()[iso2]?.activeBidId ?? null;
  writeBid({ id: 'b-' + iso2 + '-' + userId, countryId: iso2, userId, alias: userId, email: 'x@x', url: '', logoUrl: '', pitch: '', amount, accentColor: '#000', placedAt: Date.now() }, prev);
}

describe('globalStats — top5 ordering + claimedCount', () => {
  it('claimedCount counts countries with an activeBidId', () => {
    const s = globalStats();
    expect(s.claimedCount).toBe(15); // seed has all 15 claimed
    expect(s.totalCountries).toBe(196);
  });

  it('top5ByCapital orders descending by capital', () => {
    // Clear all seed active bids so only our 3 users appear.
    const cs = countries.get();
    for (const iso2 of Object.keys(cs)) {
      cs[iso2] = { ...cs[iso2], activeBidId: null, bidHistory: [] };
    }
    countries.set(cs);
    claim('uA', 'AR', 200);
    claim('uB', 'BR', 50);
    claim('uC', 'MX', 1000);
    const s = globalStats();
    const caps = s.top5ByCapital.map((t) => t.userId);
    expect(caps[0]).toBe('uC'); // 1000
    expect(caps[1]).toBe('uA'); // 200
    expect(caps[2]).toBe('uB'); // 50
  });

  it('top5ByTerritories orders descending by count', () => {
    claim('uA', 'AR', 5);
    claim('uA', 'BR', 6);
    claim('uA', 'MX', 7);
    claim('uB', 'IT', 50);
    const s = globalStats();
    expect(s.top5ByTerritories[0].userId).toBe('uA');
    expect(s.top5ByTerritories[0].count).toBeGreaterThanOrEqual(3);
  });

  it('totalInvested = sum of ACTIVE bid amounts (vitalicio, one per country)', () => {
    const s1 = globalStats();
    // outbid AR to a higher amount; old AR bid no longer counts
    claim('uA', 'AR', 999);
    const s2 = globalStats();
    // delta = 999 - (old AR active amount which was 2.50)
    expect(s2.totalInvested - s1.totalInvested).toBeCloseTo(999 - 2.5, 1);
  });
});

describe('personalDashboard', () => {
  it('totalClicks = clicks received across owned properties; geoBreakdown by origin', () => {
    claim('u1', 'AR', 5);
    claim('u1', 'BR', 6);
    // Simulate visitors from US (10) and ES (5) clicking on AR/BR
    const evs: ClickEvent[] = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: 'us-' + i, countryId: 'AR', url: 'https://x', origin: { country: 'US', region: 'Global' }, userId: 'u1', timestamp: i })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: 'es-' + i, countryId: 'BR', url: 'https://x', origin: { country: 'ES', region: 'Global' }, userId: 'u1', timestamp: i })),
    ];
    clickEvents.set(evs);
    const d = personalDashboard('u1');
    expect(d.totalClicks).toBe(15);
    expect(d.geoBreakdown['US']).toBe(10);
    expect(d.geoBreakdown['ES']).toBe(5);
  });

  it('timeline filters events where userId matches', () => {
    claim('u1', 'AR', 5);
    appendEvent(makeEvent('bid', { countryId: 'AR', userId: 'u1', message: 'u1 claimed AR' }));
    appendEvent(makeEvent('bid', { countryId: 'BR', userId: 'u2', message: 'u2 claimed BR' }));
    const d = personalDashboard('u1');
    expect(d.timeline.length).toBe(1);
    expect(d.timeline[0].userId).toBe('u1');
  });

  it('returns empty for a user with no owned countries', () => {
    const d = personalDashboard('nobody');
    expect(d.totalClicks).toBe(0);
    expect(Object.keys(d.geoBreakdown).length).toBe(0);
  });
});
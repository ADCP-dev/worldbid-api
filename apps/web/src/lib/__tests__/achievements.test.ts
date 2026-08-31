import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateAchievements, newlyUnlocked, buildContext } from '../achievements';
import { countries, bids, hydrateBidsCountries, writeBid } from '../../stores/bids';
import { globalHistory, hydrateHistory, appendEvent, makeEvent } from '../../stores/history';
import { seedCountries } from '../../lib/seed';
import type { Achievement, User } from '../../lib/types';

beforeEach(() => {
  hydrateBidsCountries(seedCountries());
  hydrateHistory([]);
});

const emptyUser: User = {
  id: 'u1', alias: 'Alice', email: 'a@x', accentColor: '#3B82F6',
  ownedCountries: [], achievements: [], totalClicks: 0, totalInvested: 0, createdAt: 1,
};

function claim(userId: string, iso2: string, amount: number): void {
  const prev = countries.get()[iso2]?.activeBidId ?? null;
  writeBid({ id: 'b-' + iso2 + '-' + userId, countryId: iso2, userId, alias: userId, email: 'x@x', url: '', logoUrl: '', pitch: '', amount, accentColor: '#000', placedAt: Date.now() }, prev);
}

describe('evaluateAchievements — first_blood', () => {
  it('unlocks first_blood on first claim (progress 1, idempotent)', () => {
    claim('u1', 'AR', 5);
    const a = evaluateAchievements('u1', []);
    const fb = a.find((x) => x.id === 'first_blood')!;
    expect(fb.unlockedAt).toBeGreaterThan(0);
    expect(fb.progress).toBe(1);
    // idempotent: re-eval keeps same unlockedAt
    const a2 = evaluateAchievements('u1', a);
    expect(a2.find((x) => x.id === 'first_blood')!.unlockedAt).toBe(fb.unlockedAt);
  });

  it('first_blood not unlocked with 0 owned', () => {
    const a = evaluateAchievements('u1', []);
    const fb = a.find((x) => x.id === 'first_blood')!;
    expect(fb.unlockedAt).toBe(0);
    expect(fb.progress).toBe(0);
  });
});

describe('evaluateAchievements — continent_master', () => {
  it('requires 3 countries on the SAME continent', () => {
    // Claim 2 in EU + 1 in AS -> NOT unlocked
    claim('u1', 'DE', 5); // EU
    claim('u1', 'FR', 6); // EU
    claim('u1', 'JP', 100); // AS (JP seed is $110, outbid to $200)
    const a = evaluateAchievements('u1', []);
    expect(a.find((x) => x.id === 'continent_master')!.unlockedAt).toBe(0);
    // Claim a 3rd in EU -> unlocked
    claim('u1', 'IT', 50); // EU
    const a2 = evaluateAchievements('u1', a);
    expect(a2.find((x) => x.id === 'continent_master')!.unlockedAt).toBeGreaterThan(0);
  });
});

describe('evaluateAchievements — wealthy / millionaire', () => {
  it('wealthy unlocks at >= $100 invested', () => {
    claim('u1', 'AR', 100);
    const a = evaluateAchievements('u1', []);
    expect(a.find((x) => x.id === 'wealthy')!.unlockedAt).toBeGreaterThan(0);
    expect(a.find((x) => x.id === 'millionaire')!.unlockedAt).toBe(0);
  });
  it('millionaire unlocks at >= $1000 invested', () => {
    claim('u1', 'AR', 1000);
    const a = evaluateAchievements('u1', []);
    expect(a.find((x) => x.id === 'millionaire')!.unlockedAt).toBeGreaterThan(0);
  });
});

describe('evaluateAchievements — disputed_territory', () => {
  it('unlocks when user has performed an outbid', () => {
    // u2 outbids u1 on AR
    claim('u1', 'AR', 5);
    claim('u2', 'AR', 10);
    appendEvent(makeEvent('outbid', { countryId: 'AR', userId: 'u2', message: 'u2 outbid u1' }));
    const a = evaluateAchievements('u2', []);
    expect(a.find((x) => x.id === 'disputed_territory')!.unlockedAt).toBeGreaterThan(0);
  });
  it('does NOT unlock for the user who was outbid', () => {
    claim('u1', 'AR', 5);
    claim('u2', 'AR', 10);
    appendEvent(makeEvent('outbid', { countryId: 'AR', userId: 'u2', message: 'u2 outbid u1' }));
    const a = evaluateAchievements('u1', []);
    expect(a.find((x) => x.id === 'disputed_territory')!.unlockedAt).toBe(0);
  });
});

describe('evaluateAchievements — click_master / click_king', () => {
  it('click_master unlocks when totalClicks > 100', () => {
    claim('u1', 'AR', 5);
    const ar = countries.get()['AR'];
    countries.set({ ...countries.get(), AR: { ...ar, totalClicks: 101 } });
    const a = evaluateAchievements('u1', []);
    expect(a.find((x) => x.id === 'click_master')!.unlockedAt).toBeGreaterThan(0);
    expect(a.find((x) => x.id === 'click_king')!.unlockedAt).toBe(0);
  });
  it('click_king unlocks when totalClicks > 500', () => {
    claim('u1', 'AR', 5);
    const ar = countries.get()['AR'];
    countries.set({ ...countries.get(), AR: { ...ar, totalClicks: 501 } });
    const a = evaluateAchievements('u1', []);
    expect(a.find((x) => x.id === 'click_king')!.unlockedAt).toBeGreaterThan(0);
  });
});

describe('evaluateAchievements — survivor / legend (consecutive days at #1)', () => {
  it('survivor not unlocked when streak < 7 days', () => {
    claim('u1', 'AR', 5);
    const a = evaluateAchievements('u1', []);
    expect(a.find((x) => x.id === 'survivor')!.unlockedAt).toBe(0);
  });
  it('survivor unlocks when streak >= 7 days', () => {
    // Place a bid 8 days ago
    writeBid({ id: 'b-old', countryId: 'AR', userId: 'u1', alias: 'Alice', email: 'x@x', url: '', logoUrl: '', pitch: '', amount: 5, accentColor: '#000', placedAt: Date.now() - 8 * 24 * 3600 * 1000 }, countries.get()['AR'].activeBidId);
    const a = evaluateAchievements('u1', []);
    expect(a.find((x) => x.id === 'survivor')!.unlockedAt).toBeGreaterThan(0);
  });
  it('survivor resets on #1 loss (outbid swaps activeBidId away from user)', () => {
    writeBid({ id: 'b-old', countryId: 'AR', userId: 'u1', alias: 'Alice', email: 'x@x', url: '', logoUrl: '', pitch: '', amount: 5, accentColor: '#000', placedAt: Date.now() - 10 * 24 * 3600 * 1000 }, countries.get()['AR'].activeBidId);
    const a1 = evaluateAchievements('u1', []);
    expect(a1.find((x) => x.id === 'survivor')!.unlockedAt).toBeGreaterThan(0);
    // u2 outbids -> u1 no longer owns AR -> streak resets
    writeBid({ id: 'b-u2', countryId: 'AR', userId: 'u2', alias: 'Bob', email: 'x@x', url: '', logoUrl: '', pitch: '', amount: 50, accentColor: '#000', placedAt: Date.now() }, 'b-old');
    // u1 has 0 owned now — survivor unlockedAt should be 0 on fresh eval
    const a2 = evaluateAchievements('u1', []);
    expect(a2.find((x) => x.id === 'survivor')!.unlockedAt).toBe(0);
  });
});

describe('newlyUnlocked', () => {
  it('returns ids unlocked in next but not in old', () => {
    const old: Achievement[] = [{ id: 'first_blood', unlockedAt: 1000, progress: 1 }];
    const next: Achievement[] = [
      { id: 'first_blood', unlockedAt: 1000, progress: 1 },
      { id: 'wealthy', unlockedAt: 2000, progress: 1 },
    ];
    expect(newlyUnlocked(old, next)).toEqual(['wealthy']);
  });
});

describe('buildContext', () => {
  it('returns owned + perContinent + totals', () => {
    claim('u1', 'AR', 5);
    const ctx = buildContext('u1');
    expect(ctx.owned).toContain('AR');
    expect(ctx.perContinent['SA']).toBeGreaterThanOrEqual(1);
  });
});
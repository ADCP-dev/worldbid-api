// Seed data for the WorldBid countries_db.
//
// Exports `seedCountries()` returning the new { countries, bids } shape used
// by `worldbid_countries_db`. 15 countries span the $2.50-$150 heat range
// across L1-L4, plus IB (Islas Baleares) as the developer slot
// (`developer: true`, active bid = SOM·OS, NOT user-claimable).
//
// Legacy `seedBids()` / `seedActivity()` / color helpers remain as compat
// shims so the old `worldbid.ts` barrel keeps the globe rendering until the
// store-split phase rewires Globe.astro. New code MUST call `seedCountries()`.

import type { Bid, Country, CountriesDb, ContinentCode } from './types';

// ---------------------------------------------------------------------------
// 15-country seed (new shape)
// ---------------------------------------------------------------------------

interface SeedRow {
  iso2: string;
  name: string;
  continent: ContinentCode;
  developer?: boolean;
  alias: string;
  url: string;
  pitch: string;
  amount: number; // USD, must span $2.50-$150 inclusive
  accentColor: string;
}

const SEED_ROWS: SeedRow[] = [
  // IB — developer slot, permanent, NOT claimable by users.
  {
    iso2: 'IB',
    name: 'Islas Baleares',
    continent: 'EU',
    developer: true,
    alias: 'SOM·OS',
    url: 'https://som-os.dev',
    pitch: 'El sistema operativo de tu negocio. Apps a medida con IA — desde Mallorca.',
    amount: 150, // developer slot sits at the top of the seed range
    accentColor: '#8b5cf6',
  },
  { iso2: 'US', name: 'United States of America', continent: 'NA', alias: 'Nimbus Labs', url: 'https://nimbuslabs.io', pitch: 'Cloud-native dev tools for the next generation.', amount: 120, accentColor: '#3B82F6' },
  { iso2: 'GB', name: 'United Kingdom', continent: 'EU', alias: "Queen's Code", url: 'https://queenscode.uk', pitch: 'British software craftsmanship, done properly.', amount: 95, accentColor: '#10B981' },
  { iso2: 'JP', name: 'Japan', continent: 'AS', alias: 'Sakura Systems', url: 'https://sakurasystems.jp', pitch: 'Minimal productivity apps, quietly powerful.', amount: 110, accentColor: '#3B82F6' },
  { iso2: 'DE', name: 'Germany', continent: 'EU', alias: 'Bauhaus Bytes', url: 'https://bauhausbytes.de', pitch: 'Design-first engineering from Berlin.', amount: 45, accentColor: '#10B981' },
  { iso2: 'FR', name: 'France', continent: 'EU', alias: 'Cafe Code', url: 'https://cafecode.fr', pitch: 'Tools for the modern artisan.', amount: 25, accentColor: '#F59E0B' },
  { iso2: 'BR', name: 'Brazil', continent: 'SA', alias: 'Carnival Cloud', url: 'https://carnivalcloud.com.br', pitch: 'Festive SaaS for everyone.', amount: 9, accentColor: '#EF4444' },
  { iso2: 'IN', name: 'India', continent: 'AS', alias: 'Curry Compiler', url: 'https://currycompiler.in', pitch: 'Spicy fast build tools.', amount: 70, accentColor: '#3B82F6' },
  { iso2: 'CA', name: 'Canada', continent: 'NA', alias: 'Maple Metrics', url: 'https://maplemetrics.ca', pitch: 'Analytics with a Canadian touch.', amount: 6, accentColor: '#10B981' },
  { iso2: 'AU', name: 'Australia', continent: 'OC', alias: 'Reef Runtime', url: 'https://reefruntime.au', pitch: 'Edge compute down under.', amount: 150, accentColor: '#F59E0B' },
  { iso2: 'IT', name: 'Italy', continent: 'EU', alias: 'Pasta Pipeline', url: 'https://pastapipeline.it', pitch: 'CI/CD, al dente.', amount: 35, accentColor: '#EF4444' },
  { iso2: 'KR', name: 'South Korea', continent: 'AS', alias: 'K-Pop Kernel', url: 'https://kpopkernel.kr', pitch: 'High-performance runtime with style.', amount: 95, accentColor: '#3B82F6' },
  { iso2: 'ES', name: 'Spain', continent: 'EU', alias: 'Sol Stack', url: 'https://solstack.es', pitch: 'Sunny-side-up full-stack kits.', amount: 18, accentColor: '#10B981' },
  { iso2: 'MX', name: 'Mexico', continent: 'NA', alias: 'Aztec API', url: 'https://aztecapi.mx', pitch: 'Ancient reliability, modern endpoints.', amount: 12, accentColor: '#F59E0B' },
  { iso2: 'AR', name: 'Argentina', continent: 'SA', alias: 'Mate Metrics', url: 'https://matemetrics.ar', pitch: 'Data dashboards with a southern accent.', amount: 2.5, accentColor: '#10B981' },
];

/**
 * Build the initial 15-country countries_db seed.
 *
 * Returns Country records keyed by iso2 plus a side-index of the active Bid
 * records (so the platform needs only 3 localStorage keys total). IB carries
 * `developer: true`; its active bid is the SOM·OS developer slot.
 */
export function seedCountries(): CountriesDb {
  const countries: Record<string, Country> = {};
  const bids: Record<string, Bid> = {};
  const now = Date.now();
  SEED_ROWS.forEach((row, i) => {
    const bidId = 'seed-bid-' + row.iso2;
    const bid: Bid = {
      id: bidId,
      countryId: row.iso2,
      userId: 'seed-user-' + row.iso2,
      alias: row.alias,
      email: row.alias.toLowerCase().replace(/[^a-z]/g, '') + '@example.com',
      url: row.url,
      logoUrl: '',
      pitch: row.pitch,
      amount: row.amount,
      accentColor: row.accentColor,
      placedAt: now - (SEED_ROWS.length - i) * 3600 * 1000,
    };
    bids[bidId] = bid;
    countries[row.iso2] = {
      iso2: row.iso2,
      name: row.name,
      continent: row.continent,
      developer: !!row.developer,
      activeBidId: bidId,
      totalClicks: 0,
      websiteClicks: {},
      bidHistory: [bidId],
    };
  });
  // Synthetic global plane-banner spot: vacant at seed, claimed via the
  // engine's placePlaneBid() path. Filtered out of all country-only surfaces
  // (globe polygons, top-10, "countries live") by iso2 === 'PLANE'.
  countries.PLANE = {
    iso2: 'PLANE',
    name: 'Global plane banner',
    continent: 'GL',
    developer: false,
    activeBidId: null,
    totalClicks: 0,
    websiteClicks: {},
    bidHistory: [],
  };
  return { countries, bids };
}

// ---------------------------------------------------------------------------
// Legacy compat shims (used by the old worldbid.ts barrel until Phase 3)
// ---------------------------------------------------------------------------

/** Old flat Bid shape kept for the pre-split barrel only. New code uses types.Bid. */
export interface LegacyBid {
  id: string;
  iso2: string;
  username: string;
  email: string;
  websiteUrl?: string;
  faviconUrl?: string;
  description: string;
  amount: number;
  avatarColor: string;
  timestamp: number;
}

/** Old activity entry shape kept for the pre-split barrel only. */
export interface LegacyActivityEntry {
  id: string;
  username: string;
  iso2: string;
  amount: number;
  avatarColor: string;
  timestamp: number;
}

/** Legacy flat-bid seed for the old barrel. Deprecated — prefer seedCountries(). */
export function seedBids(): LegacyBid[] {
  const now = Date.now();
  return SEED_ROWS.map((b, i) => ({
    id: 'seed-' + i,
    iso2: b.iso2,
    username: b.alias,
    email: b.alias.toLowerCase().replace(/[^a-z]/g, '') + '@example.com',
    websiteUrl: b.url,
    faviconUrl: '',
    description: b.pitch,
    amount: b.amount,
    avatarColor: b.accentColor,
    timestamp: now - (i + 1) * 3600 * 1000,
  }));
}

/** Legacy activity seed for the old barrel. Deprecated. */
export function seedActivity(): LegacyActivityEntry[] {
  const now = Date.now();
  const out: LegacyActivityEntry[] = [];
  const names = SEED_ROWS.map((r) => r.alias);
  for (let i = 0; i < 10; i++) {
    const r = SEED_ROWS[i % SEED_ROWS.length];
    out.push({
      id: 'seed-act-' + i,
      username: names[i % names.length],
      iso2: r.iso2,
      amount: Math.floor(20 + Math.random() * 400),
      avatarColor: r.accentColor,
      timestamp: now - (i * 7 + 3) * 60 * 1000,
    });
  }
  return out;
}

// --- small color helpers (also used by the modal for avatar default) ---
export function randomColor(): string {
  const h = Math.floor(Math.random() * 360);
  return hslHex(h, 65, 55);
}

export function hslHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const v = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * v).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}
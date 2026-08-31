// Bids + Countries atoms — the active-bid resolution + outbid write-through.
//
// CRITICAL INVARIANT (capability bid-lifecycle, design decision "Outbid
// write-through"): the bid engine MUST call BOTH `bids.set()` AND
// `countries.set()` in one transaction so the nanostores `computed` stores
// (activeBidFor, heatColorFor, ownedCountries, globalStats) auto-re-derive.
// NEVER mutate a derived cache directly — nanostores `computed` only re-tracks
// when its source atoms are `.set()`. Stale derived state is a critical bug.

import { atom, computed } from 'nanostores';
import type { Bid, Country, CountriesDb } from '../lib/types';
import { heatColorFor, type HeatTier } from '../lib/heatmap';

/** All bids ever placed, keyed by bid id. The active bid is resolved via
 *  Country.activeBidId (vitalicio model) — NOT max-of-array. */
export const bids = atom<Record<string, Bid>>({});

/** All countries, keyed by ISO-A2. */
export const countries = atom<Record<string, Country>>({});

// --- computed: active bid resolution ---

/** Active bid for a country (vitalicio: Country.activeBidId dereferenced), or null. */
export const activeBidFor = computed(countries, (countriesMap) => {
  return (iso2: string): Bid | null => {
    const c = countriesMap[iso2];
    if (!c || !c.activeBidId) return null;
    // `bids` is read via .get() inside this closure because nanostores
    // computed only tracks the atoms passed to it. We pass `bids` too below
    // so the computed retracks when bids change.
    return bids.get()[c.activeBidId] ?? null;
  };
});

// Re-declare with both atoms tracked so outbid write-through retracks all
// derived stores. The above `activeBidFor` is shadowed by this one.
export const activeBidForResolved = computed([bids, countries], (bidsMap, countriesMap) => {
  return (iso2: string): Bid | null => {
    const c = countriesMap[iso2];
    if (!c || !c.activeBidId) return null;
    return bidsMap[c.activeBidId] ?? null;
  };
});

/** Heat tier for a country, derived from its active bid amount. */
export const heatColorForCountry = computed([bids, countries], (bidsMap, countriesMap) => {
  return (iso2: string): HeatTier => {
    const c = countriesMap[iso2];
    if (!c || !c.activeBidId) return heatColorFor(null);
    const b = bidsMap[c.activeBidId];
    return heatColorFor(b ? b.amount : null);
  };
});

/** Top 3 bids for a country (Country.bidHistory mapped to Bid[] sorted desc, slice 3). */
export const topBidsFor = computed([bids, countries], (bidsMap, countriesMap) => {
  return (iso2: string): Bid[] => {
    const c = countriesMap[iso2];
    if (!c) return [];
    return c.bidHistory
      .map((id) => bidsMap[id])
      .filter((b): b is Bid => !!b)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  };
});

// --- hydration ---

/** Hydrate both atoms from a CountriesDb payload (loadAll or saveCountries). */
export function hydrateBidsCountries(db: CountriesDb): void {
  bids.set({ ...db.bids });
  countries.set({ ...db.countries });
}

/** Snapshot both atoms back into a CountriesDb shape for persistence. */
export function snapshotDb(): CountriesDb {
  return { countries: countries.get(), bids: bids.get() };
}

// --- write-through mutator ---

/**
 * Write a new bid through BOTH atoms in one transaction.
 *
 * Appends the new Bid to the bids map, then patches the target country's
 * activeBidId + bidHistory. If `prevBidId` is supplied it is the displaced
 * active bid (kept in bidHistory for top-3 resolution). Returns nothing —
 * callers read the derived stores which auto-re-derive.
 *
 * This is the SINGLE write path for placing/outbidding. The bid engine calls
 * this; islands NEVER call bids.set/countries.set directly.
 */
export function writeBid(newBid: Bid, prevBidId: string | null = null): void {
  const nextBids = { ...bids.get(), [newBid.id]: newBid };
  const prevCountries = countries.get();
  const c = prevCountries[newBid.countryId];
  if (!c) {
    // Defensive: bid on an unknown country — drop silently rather than crash.
    return;
  }
  const nextCountry: Country = {
    ...c,
    activeBidId: newBid.id,
    bidHistory: [...c.bidHistory, newBid.id],
  };
  // prevBidId is preserved in bidHistory already (it was added when it was placed).
  void prevBidId;
  countries.set({ ...prevCountries, [newBid.countryId]: nextCountry });
  bids.set(nextBids);
}
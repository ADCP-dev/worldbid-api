// WorldBid store barrel — backward-compat re-exports.
//
// The store has been SPLIT into focused modules (bids, session, history,
// clicks, ui, globe). This file re-exports them AND provides legacy compat
// shims (`bids` as an array, `activity`, `addBid`, `countryStakes`, `stats`,
// `topStakersFor`, `stakeFor`, `saveAll`, `loadAll`) so the pre-split Globe.astro
// + Sidebar/StatsPanel/ActivityFeed/BidModal islands keep importing
// `../stores/worldbid` unchanged until the rewiring phases port them to the
// new surface.
//
// NEW code MUST import from the focused stores directly (../stores/bids,
// ../stores/session, ../stores/history, ../stores/clicks, ../stores/ui).

import { atom, computed } from 'nanostores';
import {
  bids as bidsMap,
  countries,
  writeBid,
  hydrateBidsCountries,
  snapshotDb,
  activeBidForResolved,
} from './bids';
import { userSession, achievements, hydrateSession, snapshotSession, setSession } from './session';
import { globalHistory, hydrateHistory, snapshotHistory, appendEvent, makeEvent } from './history';
import { clickEvents, hydrateClicks, snapshotCountryClicks } from './clicks';
import {
  selectedIso2,
  hoveredIso2,
  pov,
  modalOpen,
  dayBandOverride,
  selectCountry,
  setHovered,
  setPov,
  setModalOpen,
  type POV,
} from './ui';
import { loadAll as loadAllPersistence, saveSession, saveCountries, saveHistory } from '../lib/persistence';
import { type LegacyBid, type LegacyActivityEntry } from '../lib/seed';
import type { Bid as SpecBid, Country, CountriesDb, HistoryEvent, User } from '../lib/types';

// --- re-export the new atoms/fns for new code ---
export {
  bidsMap,
  countries,
  writeBid,
  hydrateBidsCountries,
  snapshotDb,
  activeBidForResolved,
  userSession,
  achievements,
  hydrateSession,
  snapshotSession,
  setSession,
  globalHistory,
  hydrateHistory,
  snapshotHistory,
  appendEvent,
  makeEvent,
  clickEvents,
  hydrateClicks,
  snapshotCountryClicks,
  selectedIso2,
  hoveredIso2,
  pov,
  modalOpen,
  dayBandOverride,
  selectCountry,
  setHovered,
  setPov,
  setModalOpen,
};
export type { POV, Country, CountriesDb, HistoryEvent, User };
// `Bid` from this barrel is the LEGACY flat shape (username/websiteUrl) so the
// pre-split Sidebar/StatsPanel/ActivityFeed/BidModal keep type-checking. New
// code imports the spec-exact Bid from `../lib/types`.
export type { LegacyBid as Bid };
export type { LegacyActivityEntry as ActivityEntry };

// --- LEGACY compat shims (kept so the pre-split globe + islands keep working) ---
//
// `bids` was an array of flat LegacyBid; the new `bidsMap` is Record<id,Bid>.
// We expose a derived array view so the old `bids.get()` consumers (Sidebar,
// StatsPanel, ActivityFeed, BidModal, Globe.astro) keep rendering.

/** Legacy `bids` atom — an array view of the new bidsMap, for old consumers. */
export const bids = atom<LegacyBid[]>([]);

/** Legacy `clicks` atom — Record<iso2,count>, mirrors countryTotalClicks. */
export const clicks = atom<Record<string, number>>({});

/** Legacy `activity` atom — array of ActivityEntry, mirrors globalHistory (bid/outbid only). */
export const activity = atom<LegacyActivityEntry[]>([]);

/** Legacy `countryStakes` computed — { iso2: totalStaked }. The old MVP summed
 *  ALL bids; the vitalicio model resolves a single active bid, so this now
 *  reflects the active bid amount per country (correct semantics for heat). */
export const countryStakes = computed([bidsMap, countries], (bidsMap, countriesMap) => {
  const map: Record<string, number> = {};
  for (const c of Object.values(countriesMap)) {
    if (!c.activeBidId || c.iso2 === 'PLANE') continue;
    const b = bidsMap[c.activeBidId];
    if (b) map[c.iso2] = b.amount;
  }
  return map;
});

/** Legacy `stats` computed — global stats aggregate for the old StatsPanel. */
export const stats = computed([bidsMap, countries, clicks], (bidsMap, countriesMap, clickMap) => {
  const claimed = Object.values(countriesMap).filter((c) => c.activeBidId && c.iso2 !== 'PLANE').length;
  const total = Object.values(bidsMap).reduce((s, b) => s + b.amount, 0);
  const COUNTRY_COUNT = 196;
  const avg = total / COUNTRY_COUNT;
  const byStake = Object.entries(countryStakes.get())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([iso2, amount]) => ({ iso2, amount }));
  const byClick = Object.entries(clickMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([iso2, count]) => ({ iso2, count }));
  return { claimed, total, avg, topByStake: byStake, topByClicks: byClick, countryCount: COUNTRY_COUNT };
});

/** Legacy `topStakersFor(iso2)` — top 3 bids by amount, mapped to LegacyBid shape. */
export function topStakersFor(iso2: string): LegacyBid[] {
  const c = countries.get()[iso2];
  if (!c) return [];
  return c.bidHistory
    .map((id) => bidsMap.get()[id])
    .filter((b): b is SpecBid => !!b)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map((b) => ({
      id: b.id,
      iso2: b.countryId,
      username: b.alias,
      email: b.email,
      websiteUrl: b.url,
      faviconUrl: b.logoUrl,
      description: b.pitch,
      amount: b.amount,
      avatarColor: b.accentColor,
      timestamp: b.placedAt,
    }));
}

/** Legacy `stakeFor(iso2)` — active bid amount or 0. */
export function stakeFor(iso2: string): number {
  return countryStakes.get()[iso2] || 0;
}

/** Legacy `addBid(input)` — ported to the new writeBid + appendEvent path so
 *  outbid write-through is honored even when the old BidModal calls it. */
export function addBid(input: Omit<LegacyBid, 'id' | 'timestamp'>): void {
  const newBid: SpecBid = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'bid-' + Date.now(),
    countryId: input.iso2,
    userId: input.username, // legacy path: alias doubles as userId
    alias: input.username,
    email: input.email,
    url: input.websiteUrl || '',
    logoUrl: input.faviconUrl || '',
    pitch: input.description,
    amount: input.amount,
    accentColor: input.avatarColor,
    placedAt: Date.now(),
  };
  const c = countries.get()[input.iso2];
  const prev = c?.activeBidId ?? null;
  writeBid(newBid, prev);
  // append a bid history event
  appendEvent(makeEvent('bid', { countryId: input.iso2, userId: newBid.userId, message: newBid.alias + ' staked $' + newBid.amount + ' on ' + input.iso2 }));
  // mirror to legacy activity atom
  const entry: LegacyActivityEntry = {
    id: 'act-' + newBid.id,
    username: newBid.alias,
    iso2: newBid.countryId,
    amount: newBid.amount,
    avatarColor: newBid.accentColor,
    timestamp: newBid.placedAt,
  };
  activity.set([entry, ...activity.get()].slice(0, 60));
  // mirror to legacy bids array
  bids.set([...bids.get(), { ...input, id: newBid.id, timestamp: newBid.placedAt }]);
  saveAll();
}

/** Legacy `saveAll()` — persist the new 3-key shape from the focused stores. */
export function saveAll(): void {
  saveCountries(snapshotDb());
  saveHistory(snapshotHistory());
  saveSession(snapshotSession());
}

/** Legacy `loadAll()` — hydrate all focused stores + legacy mirror atoms. */
export function loadAll(): void {
  const { session, db, history } = loadAllPersistence();
  hydrateBidsCountries(db);
  hydrateHistory(history);
  hydrateSession(session);
  // hydrate legacy mirror atoms so old islands render
  const legacyBids: LegacyBid[] = Object.values(db.bids).map((b) => ({
    id: b.id,
    iso2: b.countryId,
    username: b.alias,
    email: b.email,
    websiteUrl: b.url,
    faviconUrl: b.logoUrl,
    description: b.pitch,
    amount: b.amount,
    avatarColor: b.accentColor,
    timestamp: b.placedAt,
  }));
  bids.set(legacyBids);
  const clicksMap: Record<string, number> = {};
  for (const c of Object.values(db.countries)) clicksMap[c.iso2] = c.totalClicks;
  clicks.set(clicksMap);
  hydrateClicks(clicksMap);
  const legacyActivity: LegacyActivityEntry[] = history
    .filter((h) => h.type === 'bid' || h.type === 'outbid')
    .slice(-60)
    .reverse()
    .map((h) => ({
      id: h.id,
      username: h.userId,
      iso2: h.countryId || '',
      amount: 0,
      avatarColor: '#3B82F6',
      timestamp: h.timestamp,
    }));
  activity.set(legacyActivity);
}
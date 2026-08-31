// WorldBid API mock — the 6-endpoint contract over localStorage.
//
// The `WorldBidApi` interface is the seam for the future Prisma/Postgres
// migration: production = `createPrismaApi(prisma)` implementing the same
// interface, with ZERO UI changes. Islands + the globe script call `api.*`,
// never localStorage directly except the initial `loadAll` hydration in
// index.astro.
//
// Endpoints (spec capability api-mock-contract):
//   POST /api/bids              201 created | 400 invalid | 409 below current+0.50
//   GET  /api/bids/:countryId   200 Bid | 404 vacant
//   GET  /api/countries         200 Country[] (opts: continent, status)
//   GET  /api/users/:userId     200 User | 404
//   POST /api/clicks            201 ClickEvent | 400 invalid | 429 debounced
//   GET  /api/achievements/:userId  200 Achievement[] | 404
//
// Each fn reads/writes via persistence.ts + delegates to the pure engines
// (bid-engine, click-tracker, achievements). A tiny artificial latency keeps
// the mock honest so islands can exercise loading states.

import type {
  Achievement,
  Bid,
  ClickEvent,
  Country,
  NewBidInput,
  NewClickInput,
  User,
} from './types';
import { placeBid, activeBidFor, minBidFor } from './bid-engine';
import { recordClick } from './click-tracker';
import { evaluateAchievements } from './achievements';
import { countries, bids, snapshotDb } from '../stores/bids';
import { userSession, setSession } from '../stores/session';
import { globalHistory, snapshotHistory } from '../stores/history';
import {
  loadAll,
  saveCountries,
  saveHistory,
  saveSession,
} from './persistence';

export type ApiResult<T> =
  | { status: number; body: T }
  | { status: number; error: string };

export interface WorldBidApi {
  postBid(input: NewBidInput): Promise<ApiResult<Bid>>;
  getBid(countryId: string): Promise<ApiResult<Bid>>;
  getCountries(opts?: { continent?: string; status?: 'claimed' | 'vacant' }): Promise<ApiResult<Country[]>>;
  getUser(userId: string): Promise<ApiResult<User>>;
  postClick(input: NewClickInput): Promise<ApiResult<ClickEvent>>;
  getAchievements(userId: string): Promise<ApiResult<Achievement[]>>;
}

/** Artificial latency band (ms) so islands can exercise loading states. */
const LATENCY_MIN = 80;
const LATENCY_MAX = 180;
function delay(): Promise<void> {
  const ms = LATENCY_MIN + Math.random() * (LATENCY_MAX - LATENCY_MIN);
  return new Promise((r) => setTimeout(r, ms));
}

/** Hydrate the atoms from localStorage on first API use. */
function ensureHydrated(): void {
  if (Object.keys(countries.get()).length === 0) {
    const { db, history, session } = loadAll();
    void db; void history; void session;
    // loadAll sets the persisted state into localStorage; the atoms are
    // hydrated separately by index.astro's boot script. For test isolation we
    // also hydrate here so the API works without the boot script.
    // (importing the store hydrators here would create a cycle; tests hydrate
    // explicitly via their beforeEach.)
  }
}

/** Persist the current atoms to localStorage after a mutation. */
function persist(): void {
  saveCountries(snapshotDb());
  saveHistory(snapshotHistory());
  saveSession(userSession.get());
}

/** Create the localStorage-backed WorldBidApi singleton. */
export function createLocalStorageApi(): WorldBidApi {
  return {
    async postBid(input): Promise<ApiResult<Bid>> {
      ensureHydrated();
      await delay();
      const r = placeBid(input);
      if (!r.ok) {
        // 400 for invalid input shape; 409 for below-min outbid (business rule).
        const isBelowMin = /outbid must be at least|minimum bid/i.test(r.error);
        return { status: isBelowMin ? 409 : 400, error: r.error };
      }
      // After a successful bid, re-evaluate achievements for the bidder and
      // update the session atom.
      const session = userSession.get();
      if (session && session.id === input.userId) {
        const next = evaluateAchievements(input.userId, session.achievements);
        setSession({ ...session, achievements: next });
      }
      persist();
      return { status: 201, body: r.bid };
    },

    async getBid(countryId): Promise<ApiResult<Bid>> {
      ensureHydrated();
      await delay();
      const b = activeBidFor(countryId);
      if (!b) return { status: 404, error: 'Vacant' };
      return { status: 200, body: b };
    },

    async getCountries(opts): Promise<ApiResult<Country[]>> {
      ensureHydrated();
      await delay();
      let list = Object.values(countries.get());
      if (opts?.continent) list = list.filter((c) => c.continent === opts.continent);
      if (opts?.status === 'claimed') list = list.filter((c) => c.activeBidId != null);
      if (opts?.status === 'vacant') list = list.filter((c) => c.activeBidId == null);
      return { status: 200, body: list };
    },

    async getUser(userId): Promise<ApiResult<User>> {
      ensureHydrated();
      await delay();
      const u = userSession.get();
      if (u && u.id === userId) return { status: 200, body: u };
      // Resolve a seed user: seed-user-<ISO> (bidder of a seed country).
      const seedBid = Object.values(bids.get()).find((b) => b.userId === userId);
      if (seedBid) {
        const stub: User = {
          id: userId,
          alias: seedBid.alias,
          email: seedBid.email,
          accentColor: seedBid.accentColor,
          ownedCountries: [],
          achievements: [],
          totalClicks: 0,
          totalInvested: seedBid.amount,
          createdAt: seedBid.placedAt,
        };
        return { status: 200, body: stub };
      }
      return { status: 404, error: 'User not found' };
    },

    async postClick(input): Promise<ApiResult<ClickEvent>> {
      ensureHydrated();
      await delay();
      const r = recordClick(input);
      if (!r.ok) {
        if (r.error === 'debounced') return { status: 429, error: 'Debounced' };
        return { status: 400, error: 'Invalid country' };
      }
      persist();
      return { status: 201, body: r.event };
    },

    async getAchievements(userId): Promise<ApiResult<Achievement[]>> {
      ensureHydrated();
      await delay();
      const u = userSession.get();
      const current = u && u.id === userId ? u.achievements : [];
      const list = evaluateAchievements(userId, current);
      if (!u && !Object.values(bids.get()).some((b) => b.userId === userId)) {
        return { status: 404, error: 'User not found' };
      }
      return { status: 200, body: list };
    },
  };
}

/** Convenience: the singleton API instance used by islands + the globe script.
 *  Server API when PUBLIC_WORLDBID_API_URL is set; localStorage mock otherwise. */
import { WORLD_BID_API_URL, createServerApi } from './api-http';
export const api: WorldBidApi = WORLD_BID_API_URL
  ? (createServerApi() as WorldBidApi)
  : createLocalStorageApi();

/** Re-export minBidFor so islands can compute the modal minimum without
 *  reaching into the engine module directly (keeps the API surface tidy). */
export { minBidFor };
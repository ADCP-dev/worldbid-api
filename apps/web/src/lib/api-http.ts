// WorldBid HTTP API client — talks to the NestJS backend (worldbid-api).
//
// Implements the same WorldBidApi seam as the localStorage mock so islands
// need ZERO changes. The backend base URL comes from PUBLIC_WORLDBID_API_URL
// (build-time env, Astro/Vite style). The localStorage mock remains the
// fallback (offline dev / unit tests) — selection happens in api-mock.ts.
//
// Backend contract (Foundation fork, /api/v1/worldbid):
//   GET  /spots            -> { spots: [{ iso2, name, developer, activeBid }] }
//   POST /bids             -> 201 { bidId, checkoutUrl } (JWT required)
//   GET  /top              -> { rows: [{ iso2, name, url, alias, amount }] }
//   GET  /stats            -> { claimedCount, totalCountries, totalInvested }
//
// Ownership truth lives on the server: a placed bid is PENDING until the
// Stripe webhook settles it. The front keeps optimistic UI via its local
// stores and re-syncs from /spots responses.

import type {
  Achievement,
  Bid,
  ClickEvent,
  Country,
  NewBidInput,
  NewClickInput,
  User,
} from './types';
import type { ApiResult, WorldBidApi } from './api-mock';

export const WORLD_BID_API_URL: string =
  (import.meta.env.PUBLIC_WORLDBID_API_URL as string | undefined) || '';

export function isServerApiEnabled(): boolean {
  return WORLD_BID_API_URL.length > 0;
}

const JWT_KEY = 'worldbid_jwt';

export function authToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(JWT_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem(JWT_KEY, token);
  else localStorage.removeItem(JWT_KEY);
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(WORLD_BID_API_URL + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      let error = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        error =
          typeof body?.message === 'string'
            ? body.message
            : Array.isArray(body?.message)
              ? body.message.join('. ')
              : body?.error || error;
      } catch {
        /* keep default */
      }
      return { status: res.status, error };
    }
    return { status: res.status, body: (await res.json()) as T };
  } catch (err: any) {
    return { status: 502, error: 'API unreachable: ' + (err?.message || err) };
  }
}

interface ServerSpotActiveBid {
  id: string;
  alias: string;
  url: string;
  pitch: string | null;
  amount: number;
  accentColor: string;
}

interface ServerSpot {
  iso2: string;
  name: string;
  developer: boolean;
  activeBid: ServerSpotActiveBid | null;
}

interface ServerSpotsResponse {
  spots: ServerSpot[];
}

function spotToCountry(s: ServerSpot): Country {
  return {
    iso2: s.iso2,
    name: s.name,
    developer: s.developer,
    // Backend does not send continent yet — UI does not filter by it server-side.
    continent: undefined as unknown as Country['continent'],
    activeBidId: s.activeBid?.id ?? null,
    totalClicks: 0,
    websiteClicks: {},
    bidHistory: [],
  } as unknown as Country;
}

function activeBidToBid(spot: ServerSpot): Bid {
  const b = spot.activeBid as ServerSpotActiveBid;
  return {
    id: b.id,
    countryId: spot.iso2,
    userId: '',
    alias: b.alias,
    email: null,
    url: b.url,
    logoUrl: '',
    pitch: b.pitch,
    amount: b.amount,
    accentColor: b.accentColor,
    placedAt: 0,
  };
}

/** HTTP-backed implementation of the WorldBidApi seam. */
export function createServerApi(): WorldBidApi {
  return {
    async postBid(input: NewBidInput): Promise<ApiResult<Bid>> {
      const token = authToken();
      if (!token) {
        return { status: 401, error: 'Login required to bid.' };
      }
      const res = await jsonFetch<{ bidId: string; checkoutUrl: string | null; status: string }>(
        '/bids',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            countryId: input.countryId,
            alias: input.alias,
            email: input.email || undefined,
            url: input.url,
            pitch: input.pitch || undefined,
            amount: input.amount,
            accentColor: input.accentColor,
          }),
        },
      );
      if (res.status === 201 && res.body?.bidId) {
        // Optimistic local shape; server truth arrives via /spots after settle.
        return {
          status: 201,
          body: { ...(input as object), id: res.body.bidId, placedAt: Date.now() } as unknown as Bid,
        };
      }
      return res as ApiResult<Bid>;
    },

    async getBid(countryId: string): Promise<ApiResult<Bid>> {
      const res = await jsonFetch<ServerSpotsResponse>('/spots');
      if (res.status !== 200 || !res.body) {
        return { status: res.status, error: res.error } as ApiResult<Bid>;
      }
      const spot = res.body.spots.find(
        (s) => s.iso2.toUpperCase() === countryId.toUpperCase(),
      );
      if (!spot?.activeBid) return { status: 404, error: 'Vacant' };
      return { status: 200, body: activeBidToBid(spot) };
    },

    async getCountries(opts?: {
      continent?: string;
      status?: 'claimed' | 'vacant';
    }): Promise<ApiResult<Country[]>> {
      const res = await jsonFetch<ServerSpotsResponse>('/spots');
      if (res.status !== 200 || !res.body) {
        return { status: res.status, error: res.error } as ApiResult<Country[]>;
      }
      let out = res.body.spots.map(spotToCountry);
      if (opts?.continent)
        out = out.filter((c) => (c as any).continent === opts.continent);
      if (opts?.status === 'claimed')
        out = out.filter((c) => c.activeBidId != null);
      if (opts?.status === 'vacant')
        out = out.filter((c) => c.activeBidId == null);
      return { status: 200, body: out as unknown as Country[] };
    },

    async getUser(userId: string): Promise<ApiResult<User>> {
      // Server user profile lives behind the backend's own auth; the front
      // session atom is authoritative locally. Mirror the mock's 404 path.
      void userId;
      return { status: 404, error: 'User not found' };
    },

    async postClick(_input: NewClickInput): Promise<ApiResult<ClickEvent>> {
      // Click analytics remain front-local for now.
      return { status: 501, error: 'Click tracking is local-only for now.' };
    },

    async getAchievements(_userId: string): Promise<ApiResult<Achievement[]>> {
      return { status: 200, body: [] };
    },
  };
}
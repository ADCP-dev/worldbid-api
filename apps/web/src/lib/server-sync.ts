// Server hydration — pulls the authoritative spot state from the backend
// and writes it into the front's nanostores so every island (globe colors,
// World Order, Live Activity, Country Card) renders server truth.
//
// Strategy:
//   1. Local-first boot: loadAll() runs FIRST (instant UI, seeded fallback).
//   2. Server sync: fetch /spots, map onto the atoms the same way local
//      persistence does. Server spots REPLACE localStorage entries for the
//      same iso2 — server state wins because it owns payments.
//   3. PLANE/IB land in the same countries map with their server flags.
//
// Called from index.astro's boot script after loadAll().
// Silently no-ops when PUBLIC_WORLDBID_API_URL is not set (offline mode).

import { isServerApiEnabled } from './api-http';
import { bids as bidsMap, countries } from '../stores/bids';
import type { Bid, Country } from './types';

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

/**
 * Fetch server spots and merge into the local atoms. Returns the number of
 * spots synced (0 when offline or on fetch failure — callers stay local).
 */
export async function syncFromServer(): Promise<number> {
  if (!isServerApiEnabled()) return 0;

  let spots: ServerSpot[];
  try {
    const res = await fetch(
      (import.meta.env.PUBLIC_WORLDBID_API_URL as string) + '/spots',
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return 0;
    const body = (await res.json()) as { spots: ServerSpot[] };
    spots = body.spots ?? [];
  } catch {
    return 0; // offline / CORS — stay on local state
  }

  const nextCountries: Record<string, Country> = { ...countries.get() };
  const nextBids: Record<string, Bid> = { ...bidsMap.get() };

  for (const s of spots) {
    const prev = nextCountries[s.iso2];
    const currentBid = prev?.activeBidId ? nextBids[prev.activeBidId] : null;
    const serverBidId = s.activeBid?.id ?? null;

    // Spot metadata merge (developer flag, name) + ownership pointer.
    nextCountries[s.iso2] = {
      ...(prev ?? {
        iso2: s.iso2,
        continent: undefined as unknown as Country['continent'],
        totalClicks: 0,
        websiteClicks: {},
        bidHistory: [],
      }),
      iso2: s.iso2,
      name: s.name,
      developer: s.developer,
      activeBidId: serverBidId,
    };

    if (s.activeBid && serverBidId) {
      const local = nextBids[serverBidId];
      // Inject/refresh the server bid record unless the local copy is identical.
      if (!local || local.amount !== s.activeBid.amount || local.status !== 'paid') {
        nextBids[serverBidId] = {
          id: serverBidId,
          countryId: s.iso2,
          userId: local?.userId ?? '',
          alias: s.activeBid.alias,
          email: local?.email ?? null,
          url: s.activeBid.url,
          logoUrl: local?.logoUrl ?? '',
          pitch: s.activeBid.pitch,
          amount: s.activeBid.amount,
          accentColor: s.activeBid.accentColor,
          placedAt: local?.placedAt ?? Date.now(),
        } as Bid;
        // Outbid event: local pointer pointed elsewhere and the server moved on.
        if (prev?.activeBidId && prev.activeBidId !== serverBidId && currentBid) {
          appendEvent(
            makeEvent('outbid', {
              countryId: s.iso2,
              userId: 'server',
              message: `${s.activeBid.alias} outbid ${currentBid.alias} on ${s.iso2} ($${s.activeBid.amount})`,
            }),
          );
        }
      }
    }
  }

  countries.set(nextCountries);
  bidsMap.set(nextBids);
  return spots.length;
}
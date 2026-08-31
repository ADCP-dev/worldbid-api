// Bid engine — the bid-lifecycle capability (claim, outbid, min amount).
//
// Pure functions over the bids + countries atoms. The bid engine is the SINGLE
// write path: it calls writeBid() (which enforces the outbid write-through
// invariant) and appendEvent() (which logs the timeline event). Islands + the
// globe script call the engine, never the atoms directly.
//
// Rules (spec capability bid-lifecycle):
//   vacant  -> new bid must be >= MIN_STAKE ($2.50)
//   occupied -> new bid must be strictly greater than current AND >= the
//               tiered minimum (minIncrementForCountry)
//   equal/lower -> rejected
//   outbid -> prior owner loses control, outbid HistoryEvent appended, prior
//             clicks stay attributed to the prior owner (NOT transferred).
//
// `minBidFor(iso2)` returns the minimum allowed bid: $2.50 vacant, otherwise
// the tiered minimum computed by the economy module.

import type { Bid, NewBidInput } from './types';
import { bids, countries, writeBid } from '../stores/bids';
import { appendEvent, makeEvent } from '../stores/history';
import { MIN_STAKE } from './heatmap';
import { PLANE_SPOT_ID, minBidForKind } from './economy';

export type BidResult = { ok: true; bid: Bid } | { ok: false; error: string };

/** Active bid for a country (vitalicio: Country.activeBidId dereferenced), or null. */
export function activeBidFor(iso2: string): Bid | null {
  const c = countries.get()[iso2];
  if (!c || !c.activeBidId) return null;
  return bids.get()[c.activeBidId] ?? null;
}

/** Minimum allowed bid for a country: $2.50 vacant, tiered minimum occupied. */
export function minBidFor(iso2: string): number {
  const active = activeBidFor(iso2);
  return minBidForKind('country', active ? active.amount : null);
}

/** Place a bid (claim vacant or outbid occupied). Returns the result + the Bid. */
export function placeBid(input: NewBidInput): BidResult {
  const c = countries.get()[input.countryId];
  if (!c) return { ok: false, error: 'Unknown country.' };
  if (c.developer) return { ok: false, error: 'Developer slot — not claimable.' };
  const active = activeBidFor(input.countryId);
  const min = minBidFor(input.countryId);

  if (!active) {
    // vacant: must be >= MIN_STAKE
    if (!Number.isFinite(input.amount) || input.amount < MIN_STAKE) {
      return { ok: false, error: 'Minimum bid is $' + MIN_STAKE.toFixed(2) + '.' };
    }
  } else {
//   occupied: must be strictly greater AND >= the tiered minimum
    if (!Number.isFinite(input.amount) || input.amount < min) {
      return { ok: false, error: 'Outbid must be at least $' + min.toFixed(2) + ' (tiered minimum over the current bid).' };
    }
    if (input.amount <= active.amount) {
      return { ok: false, error: 'Outbid must be strictly higher than the current bid.' };
    }
  }

  const newBid: Bid = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'bid-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    countryId: input.countryId,
    userId: input.userId,
    alias: input.alias,
    email: input.email,
    url: input.url,
    logoUrl: input.logoUrl,
    pitch: input.pitch,
    amount: round2(input.amount),
    accentColor: input.accentColor,
    placedAt: Date.now(),
  };

  const prevBidId = active?.id ?? null;
  writeBid(newBid, prevBidId);

  // Append the timeline event (bid for a claim, outbid for a dethrone).
  // Prior clicks remain attributed to the prior owner — we do NOT touch
  // clickEvents or country.totalClicks here.
  if (active) {
    appendEvent(makeEvent('outbid', {
      countryId: input.countryId,
      userId: newBid.userId,
      message: newBid.alias + ' outbid ' + active.alias + ' on ' + input.countryId + ' ($' + newBid.amount.toFixed(2) + ')',
    }));
  } else {
    appendEvent(makeEvent('bid', {
      countryId: input.countryId,
      userId: newBid.userId,
      message: newBid.alias + ' claimed ' + input.countryId + ' ($' + newBid.amount.toFixed(2) + ')',
    }));
  }

  return { ok: true, bid: newBid };
}

/**
 * Place a bid on the global plane spot (countryId 'PLANE'). Same lifecycle as
 * placeBid: validated against the plane tier ladder, written through writeBid()
 * + appendEvent(). The PLANE pseudo-country must exist in the countries atom.
 */
export function placePlaneBid(input: NewBidInput): BidResult {
  const c = countries.get()[PLANE_SPOT_ID];
  if (!c) return { ok: false, error: 'Unknown country.' };
  if (c.developer) return { ok: false, error: 'Developer slot — not claimable.' };
  const active = activeBidFor(PLANE_SPOT_ID);
  const min = minBidForKind('plane', active ? active.amount : null);

  if (!active) {
    if (!Number.isFinite(input.amount) || input.amount < min) {
      return { ok: false, error: 'Minimum bid is $' + min.toFixed(2) + '.' };
    }
  } else {
    if (!Number.isFinite(input.amount) || input.amount < min) {
      return { ok: false, error: 'Outbid must be at least $' + min.toFixed(2) + ' (tiered minimum over the current bid).' };
    }
    if (input.amount <= active.amount) {
      return { ok: false, error: 'Outbid must be strictly higher than the current bid.' };
    }
  }

  const newBid: Bid = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'bid-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    countryId: PLANE_SPOT_ID,
    userId: input.userId,
    alias: input.alias,
    email: input.email,
    url: input.url,
    logoUrl: input.logoUrl,
    pitch: input.pitch,
    amount: round2(input.amount),
    accentColor: input.accentColor,
    placedAt: Date.now(),
  };

  const prevBidId = active?.id ?? null;
  writeBid(newBid, prevBidId);

  if (active) {
    appendEvent(makeEvent('outbid', {
      countryId: PLANE_SPOT_ID,
      userId: newBid.userId,
      message: newBid.alias + ' outbid ' + active.alias + ' on the plane banner ($' + newBid.amount.toFixed(2) + ')',
    }));
  } else {
    appendEvent(makeEvent('bid', {
      countryId: PLANE_SPOT_ID,
      userId: newBid.userId,
      message: newBid.alias + ' seized the global plane banner ($' + newBid.amount.toFixed(2) + ')',
    }));
  }

  return { ok: true, bid: newBid };
}

/** Round to 2 decimal places (USD). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
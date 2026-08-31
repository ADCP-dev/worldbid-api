// Stats aggregation — personal dashboard + global platform stats
// (capability stats-aggregation).
//
// Pure functions over the live atoms. `personalDashboard(userId)` returns the
// per-user view (total clicks across owned properties, geo breakdown by origin
// country, personal timeline feed). `globalStats()` returns the platform-wide
// aggregates (claimed x/196, total invested, top5 by clicks, top5 by capital,
// top5 by territories).

import type { GlobalPlatformStats, HistoryEvent } from './types';
import { countries, bids } from '../stores/bids';
import { clickEvents } from '../stores/clicks';
import { globalHistory } from '../stores/history';

export interface PersonalDashboard {
  totalClicks: number; // clicks received across owned properties
  geoBreakdown: Record<string, number>; // origin country -> click count
  timeline: HistoryEvent[]; // events where userId matches
}

/** Per-user dashboard aggregations. */
export function personalDashboard(userId: string): PersonalDashboard {
  const cMap = countries.get();
  const ownedIso2 = Object.values(cMap).filter((c) => {
    if (!c.activeBidId) return false;
    const b = bids.get()[c.activeBidId];
    return b && b.userId === userId;
  }).map((c) => c.iso2);

  const ownedSet = new Set(ownedIso2);
  let totalClicks = 0;
  const geoBreakdown: Record<string, number> = {};
  for (const ev of clickEvents.get()) {
    if (!ownedSet.has(ev.countryId)) continue;
    totalClicks += 1;
    const k = ev.origin.country || 'Unknown';
    geoBreakdown[k] = (geoBreakdown[k] || 0) + 1;
  }

  const timeline = globalHistory.get().filter((h) => h.userId === userId);

  return { totalClicks, geoBreakdown, timeline };
}

/** Global platform stats (claimed x/196, total invested, top5s). */
export function globalStats(): GlobalPlatformStats {
  const cMap = countries.get();
  const bMap = bids.get();
  const TOTAL_COUNTRIES = 196; // 195 sovereign + IB developer slot

  const claimed = Object.values(cMap).filter((c) => c.activeBidId && c.iso2 !== 'PLANE').length;

  // total invested = sum of ACTIVE bid amounts (vitalicio: one active bid per country)
  let totalInvested = 0;
  const capitalByUser: Record<string, number> = {};
  const territoriesByUser: Record<string, number> = {};
  // territory counting: the PLANE spot is owned, never a "territory"
  for (const c of Object.values(cMap)) {
    if (!c.activeBidId || c.iso2 === 'PLANE') continue;
    const b = bMap[c.activeBidId];
    if (!b) continue;
    totalInvested += b.amount;
    capitalByUser[b.userId] = (capitalByUser[b.userId] || 0) + b.amount;
    territoriesByUser[b.userId] = (territoriesByUser[b.userId] || 0) + 1;
  }
  // PLANE bid counts toward total invested + owner capital, but not territories
  const planeCountry = cMap.PLANE;
  if (planeCountry?.activeBidId) {
    const planeBid = bMap[planeCountry.activeBidId];
    if (planeBid) {
      totalInvested += planeBid.amount;
      capitalByUser[planeBid.userId] = (capitalByUser[planeBid.userId] || 0) + planeBid.amount;
    }
  }

  const clicksByCountry: Record<string, number> = {};
  for (const c of Object.values(cMap)) {
    clicksByCountry[c.iso2] = c.totalClicks;
  }

  const top5ByClicks = Object.entries(clicksByCountry)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([countryId, clicks]) => ({ countryId, clicks }));

  const top5ByCapital = Object.entries(capitalByUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, capital]) => ({ userId, capital }));

  const top5ByTerritories = Object.entries(territoriesByUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, count]) => ({ userId, count }));

  return {
    claimedCount: claimed,
    totalCountries: TOTAL_COUNTRIES,
    totalInvested,
    top5ByClicks,
    top5ByCapital,
    top5ByTerritories,
  };
}
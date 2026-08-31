// HeaderStats — compact global stats chip pinned to the top-right.
//
// Two data sources, one truth order:
//   1. Server mode (PUBLIC_WORLDBID_API_URL set): claimed/invested come from
//      GET /worldbid/stats (server-stats atom, refreshed by live-sync).
//   2. Offline fallback: legacy globalStats() over local state.

import { useStore } from '@nanostores/react';
import { useMemo } from 'react';
import { countries, bids } from '../stores/bids';
import { clickEvents } from '../stores/clicks';
import { globalStats } from '../lib/stats';
import { serverStats } from '../lib/stats-sync';

function fmtMoney(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + Math.round(n).toLocaleString();
}

export default function HeaderStats() {
  const countriesMap = useStore(countries);
  const bidsMap = useStore(bids);
  const clicks = useStore(clickEvents);
  const sServer = useStore(serverStats);

  const s = useMemo(() => {
    if (sServer) {
      return {
        claimedCount: sServer.claimedCount,
        totalCountries: sServer.totalCountries,
        totalInvested: sServer.totalInvested,
      };
    }
    return globalStats();
  }, [sServer, countriesMap, bidsMap, clicks]);

  return (
    <div id="header-stats" className="glass" data-testid="header-stats">
      <div className="hs-row">
        <span className="hs-icon" aria-hidden>{s.claimedCount >= s.totalCountries / 2 ? '🌍' : '🌎'}</span>
        <span className="hs-num">{s.claimedCount}</span>
        <span className="hs-lbl">countries live</span>
      </div>
      <div className="hs-row">
        <span className="hs-icon" aria-hidden>💰</span>
        <span className="hs-num">{fmtMoney(s.totalInvested)}</span>
        <span className="hs-lbl">in bids</span>
      </div>
    </div>
  );
}
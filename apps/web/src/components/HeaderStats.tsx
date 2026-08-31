// HeaderStats — compact global stats chip pinned to the top-right.
//
// Mirrors the worldmap.lol reference: two stacked rows with a tiny icon
// prefix. Subscribes to bids + countries + clicks via the lib/stats engine.

import { useStore } from '@nanostores/react';
import { useMemo } from 'react';
import { countries, bids } from '../stores/bids';
import { clickEvents } from '../stores/clicks';
import { globalStats } from '../lib/stats';

function fmtMoney(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + Math.round(n).toLocaleString();
}

export default function HeaderStats() {
  const countriesMap = useStore(countries);
  const bidsMap = useStore(bids);
  const clicks = useStore(clickEvents);

  const s = useMemo(() => globalStats(), [countriesMap, bidsMap, clicks]);

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

// LiveActivity — bottom-left feed of recent bids across the platform.
//
// Mirrors worldmap.lol: each row = small favicon + alias + #1 in {country}
// + relative time. Also shows a header dot ("Live") + visitor count.

import { useStore } from '@nanostores/react';
import { useEffect, useMemo, useState } from 'react';
import { activity } from '../stores/worldbid';
import { countryFeatures } from '../stores/globe';
import { countryName } from '../lib/geojson';
import { clickEvents } from '../stores/clicks';
import { globalHistory } from '../stores/history';
import { bids as bidsMap } from '../stores/bids';
import { selectCountry } from '../stores/ui';
import type { Bid } from '../lib/types';

function fmtMoney(n: number): string {
  return '$' + (n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function relTime(ts: number): string {
  const d = Date.now() - ts;
  const s = Math.floor(d / 1000);
  if (s < 30) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const dd = Math.floor(h / 24);
  return dd + 'd ago';
}

function faviconForUrl(url: string): string {
  try {
    return 'https://www.google.com/s2/favicons?sz=64&domain=' + new URL(url).hostname;
  } catch {
    return '';
  }
}

export default function LiveActivity() {
  const items = useStore(activity);
  const features = useStore(countryFeatures);
  const clicks = useStore(clickEvents);
  const history = useStore(globalHistory);
  const [, tick] = useState(0);

  // Refresh relative times every 10s so labels stay fresh.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, []);

  // Build richer activity rows by joining the activity atom with the latest
  // bid events from history. The activity atom has username/iso2/amount; we
  // look up the URL from the bids map so the favicon can render.
  const bm = useStore(bidsMap);

  const rows = useMemo(() => {
    return items
      .filter((a) => a.iso2)
      .map((a) => {
        const all = Object.values(bm) as Bid[];
        const found = all.find((x) => x.countryId === a.iso2 && x.alias === a.username);
        const url = found?.url || '';
        return { ...a, url };
      });
  }, [items, bm]);

  // Aggregate visitor count: total unique origins (capped) + unique
  // clickstreams in the last 48h. Lightweight "watching" heuristic.
  const watching = useMemo(() => {
    const last48h = Date.now() - 48 * 60 * 60 * 1000;
    const recent = clicks.filter((c) => c.timestamp >= last48h);
    return Math.max(20, recent.length + history.length);
  }, [clicks, history]);

  return (
    <div id="live-activity" className="glass" data-testid="live-activity">
      <div className="la-head">
        <span className="la-pulse" /> <span className="la-title">Live activity</span>
        <span className="la-meta">{watching} visitors online</span>
      </div>
      <ul className="la-list">
        {rows.length === 0 ? (
          <li className="la-empty">No bids yet — be the first to stake a country.</li>
        ) : rows.map((a) => (
          <li className="la-row" key={a.id} onClick={() => selectCountry(a.iso2)}>
            <img
              className="la-fav"
              src={faviconForUrl(a.url)}
              onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
              alt=""
            />
            <div className="la-body">
              <div className="la-alias" style={{ color: a.avatarColor }}>{a.username}</div>
              <div className="la-meta-line">
                <span className="la-amt">{fmtMoney(a.amount)}</span>
                <span className="la-sep">·</span>
                <span className="la-target">#1 in {countryName(a.iso2, features)}</span>
              </div>
            </div>
            <div className="la-time">{relTime(a.timestamp)}</div>
          </li>
        ))}
      </ul>
      <div className="la-foot">
        <span className="la-foot-num">{watching.toLocaleString()}</span> visitors · 48h
        <span className="la-foot-sep">·</span>
        <span className="la-foot-num">{Math.max(1, watching % 50)}</span> watching
      </div>
    </div>
  );
}

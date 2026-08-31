// WorldOrder — right-side panel that ranks the top 10 most-staked entries.
//
// Worldmap.lol pattern: a leaderboard card with the top bid (highlighted in
// gold) and rows 2-N below. On hover over a row, an OG metadata tooltip
// floats to the LEFT of the panel (via portal + position:fixed so it
// escapes any overflow ancestor).
//
// Top 3 get medal styling: gold/silver/bronze tinted background.

import { useStore } from '@nanostores/react';
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { bids, countries, activeBidForResolved } from '../stores/bids';
import { selectCountry } from '../stores/ui';
import { countryFeatures } from '../stores/globe';
import { countryName } from '../lib/geojson';
import { fetchOgMeta, getOgMeta } from '../lib/og';

function faviconFor(url: string): string {
  try {
    return 'https://www.google.com/s2/favicons?sz=64&domain=' + new URL(url).hostname;
  } catch {
    return '';
  }
}

function truncUrl(u: string, max = 26): string {
  if (!u) return '';
  try {
    const h = new URL(u).hostname.replace(/^www\./, '');
    return h.length > max ? h.slice(0, max - 1) + '…' : h;
  } catch {
    return u.slice(0, max);
  }
}

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

interface RowData {
  iso2: string;
  url: string;
  alias: string;
  amount: number;
  accentColor: string;
}

interface RowProps {
  row: RowData;
  index: number;
  features: any[];
}

function Row({ row, index, features }: RowProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; below?: boolean } | null>(null);
  const rowRef = useRef<HTMLLIElement>(null);
  const hoveredRef = useRef(false);
  const [, tick] = useState(0);
  const medal = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

  const meta = row.url ? getOgMeta(row.url) : undefined;

  const handleMouseEnter = () => {
    hoveredRef.current = true;
    setHovered(true);
    if (rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect();
      const tipWidth = 260;
      const leftSpace = rect.left;
      if (leftSpace > tipWidth + 20) {
        const left = rect.left - tipWidth - 12;
        const top = rect.top + rect.height / 2;
        setTooltipPos({ top, left });
      } else {
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - tipWidth - 8));
        const top = rect.bottom + 8;
        setTooltipPos({ top, left, below: true } as any);
      }
    }
    if (row.url && getOgMeta(row.url) === undefined) {
      fetchOgMeta(row.url);
      // Poll until the cache fills so the tooltip updates in place.
      const poll = () => {
        if (!hoveredRef.current) return;
        if (getOgMeta(row.url) !== undefined) {
          tick((n) => n + 1);
        } else {
          setTimeout(poll, 400);
        }
      };
      setTimeout(poll, 400);
    }
  };

  return (
    <li
      ref={rowRef}
      className={'wo-row' + (medal ? ' wo-' + medal : '')}
      onClick={() => selectCountry(row.iso2)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { hoveredRef.current = false; setHovered(false); }}
      data-testid={'wo-row-' + row.iso2}
      data-url={row.url}
    >
      <span className="wo-rank">{index + 1}</span>
      <img
        className="wo-fav"
        src={faviconFor(row.url)}
        onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
        alt=""
      />
      <div className="wo-info">
        <div className="wo-name">{truncUrl(row.url, 16)}</div>
        <div className="wo-meta">{countryName(row.iso2, features)}</div>
      </div>
      <div className="wo-amt">{fmtMoney(row.amount)}</div>

      {/* OG tooltip — portal to body with position:fixed so it floats
          free of the panel's overflow. */}
      {hovered && row.url && tooltipPos && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="wo-og-tooltip"
            style={{ position: 'fixed', top: tooltipPos.top, left: tooltipPos.left, transform: tooltipPos.below ? 'none' : 'translateY(-50%)', opacity: 1, pointerEvents: 'none' }}
          >
            {meta === undefined ? (
              <div className="og-loading">Loading preview…</div>
            ) : meta === null ? (
              <div className="og-loading">No preview available</div>
            ) : (
              <>
                {meta.image && <img className="og-image" src={meta.image} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                <div className="og-title">{meta.title || ''}</div>
                {meta.description && <div className="og-desc">{meta.description}</div>}
              </>
            )}
          </div>,
          document.body
        )}
    </li>
  );
}

export default function WorldOrder() {
  const bidsMap = useStore(bids);
  const countriesMap = useStore(countries);
  const features = useStore(countryFeatures);

  const rows: RowData[] = useMemo(() => {
    const out: RowData[] = [];
    for (const c of Object.values(countriesMap)) {
      if (c.developer || c.iso2 === 'PLANE') continue;
      const b = activeBidForResolved.get()(c.iso2);
      if (!b) continue;
      out.push({
        iso2: c.iso2,
        url: b.url,
        alias: b.alias,
        amount: b.amount,
        accentColor: b.accentColor,
      });
    }
    out.sort((a, b) => b.amount - a.amount);
    return out.slice(0, 10);
  }, [bidsMap, countriesMap]);

  // Pinned global-banner row (only when the PLANE spot is owned). Never ranked
  // with the countries: it sits above #1 with its own styling. Clicking it
  // opens the plane bid modal via the shared DOM event the banner uses.
  const planeBid = useMemo(() => {
    const c = countriesMap.PLANE;
    if (!c || !c.activeBidId) return null;
    return bidsMap[c.activeBidId] ?? null;
  }, [bidsMap, countriesMap]);

  function openPlaneModal() {
    window.dispatchEvent(new CustomEvent('open-plane-buy'));
  }

  return (
    <aside id="world-order" className="glass" data-testid="world-order">
      <div className="wo-head">
        <div className="wo-eyebrow">THE WORLD · LIVE</div>
        <h2 className="wo-title">🌍 World Order</h2>
        <div className="wo-sub">TOP 10 · MOST STAKED</div>
      </div>
      <ol className="wo-list">
        {planeBid && (
          <li className="wo-row wo-plane" onClick={openPlaneModal} data-testid="wo-row-PLANE" title="Global banner — owned until outbid">
            <span className="wo-rank">✈</span>
            <img
              className="wo-fav"
              src={faviconFor(planeBid.url)}
              onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
              alt=""
            />
            <div className="wo-info">
              <div className="wo-name">{truncUrl(planeBid.url, 16)}</div>
              <div className="wo-meta">Global banner</div>
            </div>
            <div className="wo-amt">{fmtMoney(planeBid.amount)}</div>
          </li>
        )}
        {rows.length === 0 ? (
          planeBid ? null : (
            <li className="wo-empty">No active bids yet. Be the first.</li>
          )
        ) : (
          rows.map((r, i) => <Row key={r.iso2} row={r} index={i} features={features} />)
        )}
      </ol>
      <div className="wo-foot">click a country to stake · rank is your total stake</div>
    </aside>
  );
}
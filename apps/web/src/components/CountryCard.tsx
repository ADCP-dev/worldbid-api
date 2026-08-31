// CountryCard — right-side panel that opens when a country is selected.
//
// worldmap.lol pattern: "claimed territory" header + a list of "seats" (one
// per active bid in the bid history) + a primary CTA at the bottom. Each
// seat shows rank (👑 / #2 / #3), favicon, name, short description, and the
// amount paid. On hover, an OG preview tooltip pops out to the LEFT of the
// panel. Each seat also shows the number of visits (clicks) that seat's URL
// has received.
//
// The IB (Islas Baleares) developer slot renders a single SOM·OS seat
// pointing to som-os.dev — the same seat layout as regular claims, but
// not user-claimable.

import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { selectedIso2, selectCountry, setModalOpen } from '../stores/ui';
import { countries, topBidsFor } from '../stores/bids';
import { countryFeatures } from '../stores/globe';
import { countryName } from '../lib/geojson';
import { MIN_STAKE } from '../lib/heatmap';
import { minBidForKind } from '../lib/economy';
import { api } from '../lib/api-mock';
import type { Bid, Country } from '../lib/types';

function faviconFor(b: { logoUrl?: string; url?: string } | null): string {
  if (!b) return '';
  if (b.logoUrl) return b.logoUrl;
  if (b.url) {
    try {
      const u = new URL(b.url);
      return 'https://unavatar.io/' + u.hostname + '?fallback=false';
    } catch {}
  }
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#3B82F6"/></svg>');
}

function fmtMoney(n: number): string {
  if (n >= 1) return '$' + Math.round(n).toLocaleString();
  return '$' + n.toFixed(2);
}

function flagEmoji(iso2: string): string {
  if (iso2 === 'IB') return '🏳️';
  return String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function seatHref(b: Bid): string {
  if (!b.url) return '#';
  return b.url + (b.url.includes('?') ? '&' : '?') + 'utm_source=worldbid';
}

// OG metadata fetch — shared module (warms the same cache used by the
// globe claim cards and WorldOrder rows).
import { fetchOgMeta, getOgMeta } from '../lib/og';

interface SeatProps {
  b: Bid;
  iso2: string;
  index: number;
  isTop: boolean;
  isDev: boolean;
  clicks: number;
}

function Seat({ b, iso2, index, isTop, isDev, clicks }: SeatProps) {
  const [hovered, setHovered] = useState(false);
  const [ogState, setOgState] = useState(0); // 0=idle, 1=loading, 2=ready
  const tooltipRef = useRef<HTMLDivElement>(null);
  const seatRef = useRef<HTMLAnchorElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; below?: boolean } | null>(null);
  const hoveredRef = useRef(false);

  const ogUrl = b.url || '';

  const handleMouseEnter = () => {
    hoveredRef.current = true;
    setHovered(true);
    // Compute fixed coordinates so the tooltip floats free of any
    // overflow:hidden / overflow-y:auto ancestor. Default: to the LEFT of
    // the seat, vertically centered. If there's no room on the left (mobile
    // or narrow viewport), position it BELOW the seat instead.
    if (seatRef.current) {
      const rect = seatRef.current.getBoundingClientRect();
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
    if (ogUrl) {
      const meta = getOgMeta(ogUrl);
      if (meta !== undefined) {
        setOgState(2);
        return;
      }
      setOgState(1);
      fetchOgMeta(ogUrl);
      // Poll until the shared cache fills. Bail if mouse left.
      const poll = () => {
        if (!hoveredRef.current) return;
        const m = getOgMeta(ogUrl);
        if (m !== undefined) {
          setOgState(2);
        } else {
          setTimeout(poll, 400);
        }
      };
      setTimeout(poll, 400);
    }
  };

  const handleMouseLeave = () => {
    hoveredRef.current = false;
    setHovered(false);
  };

  const handleClick = () => {
    if (!b.url) return;
    api.postClick({ countryId: b.countryId, url: b.url, userId: b.userId }).catch(() => {});
  };

  const meta = ogUrl ? getOgMeta(ogUrl) : null;

  return (
    <a
      ref={seatRef}
      className={'seat' + (isTop ? ' seat-top' : '')}
      href={seatHref(b)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid={'seat-' + iso2 + '-' + index}
    >
      <span className="seat-rank">{isTop ? '👑' : '#'}</span>
      <img
        className="seat-fav"
        src={faviconFor(b)}
        onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
        alt=""
        width={isTop ? 32 : 20}
        height={isTop ? 32 : 20}
      />
      <div className="seat-c">
        <span className="seat-name" title={hostnameOf(b.url)}>
          {isDev ? 'som-os.dev' : hostnameOf(b.url)}
        </span>
        <small>{b.pitch || (isDev ? 'SOM·OS — El sistema operativo de tu negocio. Apps a medida con IA — desde Mallorca.' : `${b.alias} staked ${fmtMoney(b.amount)} on this territory.`)}</small>
      </div>
      <span className="seat-paid">{isDev ? 'dev' : fmtMoney(b.amount)}</span>

      {/* Visits counter */}
      {clicks > 0 && <span className="seat-clicks" title="visits">↗ {clicks}</span>}

      {/* OG tooltip — position: fixed, rendered to body via portal so it
          floats free of any overflow:hidden / overflow-y:auto ancestor. */}
      {hovered && ogUrl && tooltipPos && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="seat-og-tooltip"
            ref={tooltipRef}
            style={{ position: 'fixed', top: tooltipPos.top, left: tooltipPos.left, transform: tooltipPos.below ? 'none' : 'translateY(-50%)' }}
          >
            {ogState === 1 && <div className="og-loading">Loading preview…</div>}
            {ogState === 2 && meta && (
              <>
                {meta.image && <img className="og-image" src={meta.image} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                <div className="og-title">{meta.title || hostnameOf(ogUrl)}</div>
                {meta.description && <div className="og-desc">{meta.description}</div>}
              </>
            )}
            {ogState === 2 && !meta && <div className="og-loading">No preview available</div>}
          </div>,
          document.body
        )}
    </a>
  );
}

export default function CountryCard() {
  const iso2 = useStore(selectedIso2);
  const countriesMap = useStore(countries);
  const features = useStore(countryFeatures);

  useEffect(() => {
    if (iso2) {
      document.body.classList.add('has-selection');
      return () => {
        document.body.classList.remove('has-selection');
      };
    }
    return undefined;
  }, [iso2]);

  if (!iso2) return null;
  const c = countriesMap[iso2] as Country | undefined;
  // Allow the panel to render even for countries that exist in the GeoJSON
  // but are not in the seed store (vacant, no bid history). We synthesize a
  // minimal Country-like object so the rest of the component logic works.
  const country: Country = c ?? {
    iso2,
    name: countryName(iso2, features),
    continent: 'EU' as const,
    developer: false,
    activeBidId: null,
    totalClicks: 0,
    websiteClicks: {},
    bidHistory: [],
  };
  const seats: Bid[] = topBidsFor.get()(iso2);
  const topBid: Bid | null = seats[0] || null;
  const ctaAmount = country.developer ? null : minBidForKind('country', topBid?.amount ?? null);
  const ctaLabel = country.developer
    ? null
    : topBid
      ? `Claim a spot — for ${fmtMoney(ctaAmount!)}`
      : `Claim this territory — for ${fmtMoney(ctaAmount!)}`;

  const region = country.developer ? 'developer slot' : topBid ? 'claimed territory' : 'vacant territory';
  const status = country.developer
    ? 'SOM·OS permanent ad slot'
    : topBid
      ? `${seats.length} bidding · #1 pays ${fmtMoney(topBid.amount)}`
      : 'no active bid · be the first';

  const clicksFor = (b: Bid): number => {
    const co = countriesMap[b.countryId];
    if (!co || !b.url) return 0;
    return co.websiteClicks[b.url] || 0;
  };

  const renderSeats = () => {
    if (country.developer) {
      const somOs = topBid;
      if (!somOs) return null;
      return (
        <div className="pn-seats">
          <Seat b={somOs} iso2={iso2} index={0} isTop={true} isDev={true} clicks={clicksFor(somOs)} />
        </div>
      );
    }
    if (seats.length === 0) {
      return (
        <div className="pn-empty">
          <p>No one has claimed this territory yet. Be the first — your startup goes live in front of every visitor to the map.</p>
        </div>
      );
    }
    return (
      <div className="pn-seats">
        {seats.map((b, i) => (
          <Seat key={b.id} b={b} iso2={iso2} index={i} isTop={i === 0} isDev={false} clicks={clicksFor(b)} />
        ))}
      </div>
    );
  };

  return (
    <aside id="country-card" className="panel glass open" aria-live="polite" data-testid="country-card" data-iso2={iso2}>
      <button className="pn-expand" aria-label="Expand" title="Expand">
        ⤢
      </button>
      <button className="pn-close" aria-label="Back" onClick={() => selectCountry(null)}>
        ✕
      </button>

      <div className="pn-head">
        <div className="pn-region">{region}</div>
        <div className="pn-name">
          {flagEmoji(iso2)} {countryName(iso2, features)}
        </div>
        <div className={'pn-status' + (topBid ? ' owned' : ' vacant')}>{status}</div>
      </div>

      <div className="pn-body">
        {renderSeats()}

        {country.developer ? (
          <a
            className="pn-cta pn-cta-dev"
            href="https://som-os.dev"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="pn-cta-dev"
          >
            Want a permanent slot like this? Talk to us ↗
          </a>
        ) : (
          <button className="pn-cta" onClick={() => setModalOpen(true)} data-testid="pn-cta">
            {ctaLabel}
          </button>
        )}

        <div className="pn-sub">rank is your total stake · top up to climb</div>
      </div>
    </aside>
  );
}
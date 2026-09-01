// BidModal island — ultra-minimal claim form (email + URL + amount only).
//
// Everything else is auto-derived at submit time:
//   - alias       = URL hostname (no www)
//   - pitch       = OG description / title fetched from microlink for the URL
//                   (falls back to the hostname when the fetch fails)
//   - accentColor = stable hash of the domain -> HSL -> hex
//   - logo        = always the Google favicon service
//
// Login gate = email-only magic-link mock (same flow as UserPanel: submit,
// brief "check your inbox" delay, session created from the email prefix).
// Country picker stays for the top-level "Claim a country" CTA when no
// country is selected. Current-king + developer-slot banners unchanged.

import { useStore } from '@nanostores/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { selectedIso2, modalOpen, setModalOpen, selectCountry } from '../stores/ui';
import { countries, activeBidForResolved } from '../stores/bids';
import { userSession, setSession } from '../stores/session';
import { countryFeatures } from '../stores/globe';
import { countryName } from '../lib/geojson';
import { MIN_STAKE } from '../lib/heatmap';
import { minIncrementForCountry } from '../lib/economy';
import { minBidFor } from '../lib/bid-engine';
import { api } from '../lib/api-mock';
import { evaluateAchievements, newlyUnlocked } from '../lib/achievements';
import { appendEvent, makeEvent } from '../stores/history';
import { randomColor, hslHex } from '../lib/seed';
import { fetchOgMeta } from '../lib/og';
import { burstConfetti, playSuccess } from '../lib/fx';
import type { User } from '../lib/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/;

function faviconFor(b: { logoUrl?: string; url?: string } | null): string {
  if (!b) return '';
  if (b.logoUrl) return b.logoUrl;
  if (b.url) return googleFavicon(b.url);
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="#3B82F6"/></svg>');
}

function googleFavicon(url: string): string {
  try {
    const u = new URL(url);
    return 'https://www.google.com/s2/favicons?sz=64&domain=' + u.hostname;
  } catch {
    return '';
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Alias = hostname without www; capitalize first letter when single word. */
function aliasFromUrl(url: string): string {
  const h = hostnameOf(url);
  if (!h) return '';
  const first = h.split('.')[0] || h;
  return /^[a-z]+$/.test(first) ? first.charAt(0).toUpperCase() + first.slice(1) : first;
}

/** Stable color from the domain — same site always gets the same accent. */
function accentFromUrl(url: string): string {
  const h = hostnameOf(url);
  if (!h) return randomColor();
  let hash = 0;
  for (let i = 0; i < h.length; i++) {
    hash = (hash * 31 + h.charCodeAt(i)) | 0;
  }
  return hslHex(Math.abs(hash) % 360, 65, 55);
}

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BidModal() {
  const iso2 = useStore(selectedIso2);
  const open = useStore(modalOpen);
  const countriesMap = useStore(countries);
  const features = useStore(countryFeatures);
  const user = useStore(userSession);

  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [amount, setAmountStr] = useState(String(MIN_STAKE));
  // Territory color — the bidder's chosen fill for the country they claim.
  const [accent, setAccent] = useState<string>(() => accentFromUrl(''));
  const [accentTouched, setAccentTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Live preview state: auto-derived alias + pitch fetched from the URL.
  const [previewPitch, setPreviewPitch] = useState('');
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Login gate (email-only magic link mock)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPhase, setLoginPhase] = useState<'idle' | 'sending' | 'sent'>('idle');

  // Country picker step: when opened with no selection (e.g. "Claim a country"
  // CTA), let the user pick a target country before showing the bid form.
  const [pickerIso2, setPickerIso2] = useState<string | null>(iso2);
  useEffect(() => {
    if (open) setPickerIso2(iso2);
  }, [open, iso2]);

  // Re-derive the auto accent when the URL changes (unless user picked one)
  useEffect(() => {
    if (!accentTouched && URL_RE.test(url.trim())) {
      setAccent(accentFromUrl(url.trim()));
    }
  }, [url, accentTouched]);

  const targetIso2 = pickerIso2 ?? iso2;
  const targetCountry = targetIso2 ? countriesMap[targetIso2] : null;
  const targetActiveBid = targetIso2 ? activeBidForResolved.get()(targetIso2) : null;
  const targetMinAmount = targetIso2 ? minBidFor(targetIso2) : MIN_STAKE;
  const targetIsDeveloper = !!targetCountry?.developer;
  const targetName = targetIso2 ? countryName(targetIso2, features) : '';
  const amountNum = parseFloat(amount) || 0;

  const activeBid = targetActiveBid;
  const country = targetCountry;
  const minAmount = targetMinAmount;
  const isDeveloper = targetIsDeveloper;

  useEffect(() => {
    if (open) {
      setEmail(user?.email ?? '');
      setUrl('');
      setAmountStr(String(minAmount));
      setErrors({});
      setApiError(null);
      setPreviewPitch('');
      setLoginEmail('');
      setLoginPhase('idle');
    }
  }, [open, targetIso2, minAmount, user?.email]);

  // Debounced pitch fetch for the live preview. Runs only while the URL is
  // valid; result cached in the shared og module so submit re-uses it.
  useEffect(() => {
    if (!open) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    const trimmed = url.trim();
    if (!URL_RE.test(trimmed)) {
      setPreviewPitch('');
      return undefined;
    }
    previewTimer.current = setTimeout(() => {
      fetchOgMeta(trimmed).then((meta) => {
        const host = hostnameOf(trimmed);
        setPreviewPitch((meta?.description || meta?.title || host).slice(0, 120));
      });
    }, 500);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [url, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen.get()) setModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;
  // IB (Islas Baleares) is the permanent developer slot — never claimable.
  // The modal must not open at all for it (or for any developer-flagged spot).
  if (targetIso2 && (targetIsDeveloper || targetIso2 === 'IB')) return null;

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email.';
    if (url.trim() && !URL_RE.test(url.trim())) e.url = 'Enter a valid URL (http(s)://).';
    if (!Number.isFinite(amountNum) || amountNum < minAmount) {
      e.amount = 'Minimum bid is ' + fmtMoney(minAmount) + '.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // Mock magic link: sending -> sent -> session created from the email prefix.
  function magicLinkLogin() {
    const trimmed = loginEmail.trim();
    if (!EMAIL_RE.test(trimmed) || loginPhase !== 'idle') return;
    setLoginPhase('sending');
    setTimeout(() => {
      setLoginPhase('sent');
      setTimeout(() => {
        const prefix = trimmed.split('@')[0];
        const alias = prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : 'User';
        const u: User = {
          id: 'usr-' + Date.now().toString(36),
          alias,
          email: trimmed,
          accentColor: randomColor(),
          ownedCountries: [],
          achievements: [],
          totalClicks: 0,
          totalInvested: 0,
          createdAt: Date.now(),
        };
        setSession(u);
      }, 800);
    }, 1500);
  }

  async function submit() {
    if (!validate() || !targetIso2 || !user) return;
    setSubmitting(true);
    setApiError(null);
    const cleanUrl = url.trim();
    const host = hostnameOf(cleanUrl);
    // Auto-derive pitch from the destination's OG meta (cached by preview).
    const meta = cleanUrl ? await fetchOgMeta(cleanUrl) : null;
    const pitch = ((meta?.description || meta?.title || host) || '').slice(0, 120);
    const derivedAlias = aliasFromUrl(cleanUrl) || user.alias;
    try {
      const r = await api.postBid({
        countryId: targetIso2,
        userId: user.id,
        alias: derivedAlias,
        email: email.trim(),
        url: cleanUrl,
        logoUrl: cleanUrl ? googleFavicon(cleanUrl) : '',
        pitch,
        amount: amountNum,
        accentColor: accent,
      });
      if (r.status === 201 && 'body' in r) {
        const next = evaluateAchievements(user.id, user.achievements);
        const newIds = newlyUnlocked(user.achievements, next);
        setSession({ ...user, achievements: next, email: email.trim() });
        for (const id of newIds) {
          appendEvent(makeEvent('achievement', { userId: user.id, message: 'Unlocked ' + id }));
        }
        try { burstConfetti(); } catch {}
        try { playSuccess(); } catch {}
        setModalOpen(false);
      } else if ('error' in r) {
        setApiError(r.error);
      }
    } catch (err) {
      setApiError('Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  const previewAlias = aliasFromUrl(url);
  const previewFavicon = url.trim() ? googleFavicon(url.trim()) : '';
  const showPreview = URL_RE.test(url.trim());

  // Vacant countries available in the picker, excluding the developer slot.
  const vacantCountries = Object.values(countriesMap).filter((c) => !c.developer && !c.activeBidId);

  return (
    <div id="bid-modal" className="open" onClick={(e) => { if ((e.target as HTMLElement).id === 'bid-modal') setModalOpen(false); }} data-testid="bid-modal">
      <div className="card glass">
        {!targetIso2 ? (
          <>
            <h2>Claim a country</h2>
            <div className="sub">{vacantCountries.length === 0 ? 'No vacant countries right now — pick any country to outbid.' : 'Pick a country to place your first bid.'}</div>
            <div className="country-picker">
              {vacantCountries.length > 0 ? (
                <div className="picker-grid">
                  {vacantCountries.map((c) => (
                    <button key={c.iso2} className="picker-item" onClick={() => { selectCountry(c.iso2); setPickerIso2(c.iso2); }} data-testid={`pick-${c.iso2}`}>
                      <span className="picker-flag">{countryName(c.iso2, features).slice(0, 2).toUpperCase()}</span>
                      <span className="picker-name">{countryName(c.iso2, features)}</span>
                      <span className="picker-meta">Min {fmtMoney(MIN_STAKE)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="picker-search">
                <label>Or search all countries</label>
                <input
                  type="text"
                  placeholder="e.g. Brazil, Japan"
                  onChange={(e) => {
                    const q = e.target.value.trim().toLowerCase();
                    if (!q) return;
                    const match = Object.values(countriesMap).find((c) => !c.developer && countryName(c.iso2, features).toLowerCase().includes(q));
                    if (match) { selectCountry(match.iso2); setPickerIso2(match.iso2); }
                  }}
                />
              </div>
            </div>
            <div className="actions">
              <button className="cancel" onClick={() => { setModalOpen(false); setPickerIso2(null); }}>Cancel</button>
            </div>
          </>
        ) : !user ? (
          // Login gate — email-only magic link mock.
          <>
            <h2>Log in to claim {targetName}</h2>
            <div className="sub">Enter your email and we'll send you a magic link. No password.</div>
            <label>Email *</label>
            <input type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} data-testid="login-email" />
            <div className="login-hint">
              {loginPhase === 'sending' ? '✉️ Sending magic link…' : loginPhase === 'sent' ? '✓ Check your inbox — link clicked' : 'Your email powers bid notifications and your personal dashboard.'}
            </div>
            <div className="actions">
              <button className="cancel" onClick={() => setModalOpen(false)}>Cancel</button>
              <button
                className="submit"
                onClick={magicLinkLogin}
                disabled={!EMAIL_RE.test(loginEmail.trim()) || loginPhase !== 'idle'}
                data-testid="login-submit"
              >
                {loginPhase === 'idle' ? '✉️ Get magic link' : loginPhase === 'sending' ? 'Sending…' : '✓ Logging in…'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{activeBid ? 'Outbid' : 'Claim'} {targetName}</h2>
            <div className="sub">
              {isDeveloper
                ? 'This is a developer slot and cannot be claimed.'
                : activeBid
                  ? `Current king: ${activeBid.alias} (${fmtMoney(activeBid.amount)}). Minimum outbid ${fmtMoney(minAmount)} (at least ${fmtMoney(minIncrementForCountry(activeBid.amount))}).`
                  : `Minimum bid ${fmtMoney(MIN_STAKE)}.`}
            </div>

            {activeBid && !isDeveloper ? (
              <div className="current-king" data-testid="current-king">
                <img className="fav" src={faviconFor(activeBid)} onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} alt="" />
                <div>
                  <div className="uname">Current king: {activeBid.alias} ({fmtMoney(activeBid.amount)})</div>
                  <div className="meta">{activeBid.url}</div>
                </div>
              </div>
            ) : null}

            {isDeveloper ? (
              <div className="actions">
                <button className="cancel" onClick={() => setModalOpen(false)}>Close</button>
              </div>
            ) : (
              <>
                <label>Email *</label>
                <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <div className="err">{errors.email || ''}</div>

                <label>Your site URL</label>
                <input type="url" placeholder="https://yoursite.com" value={url} onChange={(e) => setUrl(e.target.value)} />
                <div className="err">{errors.url || ''}</div>

                <label>Territory color</label>
                <div className="accent-row">
                  <input
                    type="color"
                    className="accent-picker"
                    value={accent}
                    onChange={(e) => { setAccentTouched(true); setAccent(e.target.value); }}
                    data-testid="accent-picker"
                    aria-label="Pick your territory color"
                  />
                  <input
                    type="text"
                    className="accent-hex"
                    value={accent}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) { setAccentTouched(true); setAccent(v); }
                      else if (/^[0-9a-fA-F]{6}$/.test(v)) { setAccentTouched(true); setAccent('#' + v); }
                    }}
                    aria-label="Territory color hex"
                  />
                  {!accentTouched && url.trim() && URL_RE.test(url.trim()) ? (
                    <span className="accent-hint">auto from domain</span>
                  ) : null}
                </div>

                <label>Bid amount (USD) *</label>
                <input type="number" min={minAmount} step="0.01" placeholder={String(minAmount)} value={amount} onChange={(e) => setAmountStr(e.target.value)} />
                <div className="err">{errors.amount || ''}</div>

                {apiError ? <div className="err">{apiError}</div> : null}

                {showPreview ? (
                  <div className="preview" data-testid="bid-preview">
                    <div className="ptitle">Live preview</div>
                    <div className="preview-banner" style={{ borderColor: accent }}>
                      {previewFavicon ? (
                        <img className="fav" src={previewFavicon} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
                      ) : null}
                      <div className="info">
                        <div className="uname">{previewAlias || hostnameOf(url)}</div>
                        <div className="desc">{previewPitch || 'Fetching site preview…'}</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="actions">
                  <button className="cancel" onClick={() => { setModalOpen(false); setPickerIso2(null); }}>Cancel</button>
                  <button className="submit" onClick={submit} disabled={submitting || amountNum < minAmount} data-testid="bid-submit">
                    {submitting ? 'Placing…' : activeBid ? 'Place outbid' : 'Claim country'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

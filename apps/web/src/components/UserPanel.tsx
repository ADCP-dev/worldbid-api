// UserPanel — icon button that opens a modal with login / personal dashboard.
//
// Logged out: icon button (👤) → modal with email input + "Get magic link"
//             → simulates send → "link clicked" → auto-login.
// Logged in: icon button (avatar) → modal with stats (countries, clicks,
//            invested) + logout.

import { useStore } from '@nanostores/react';
import { useEffect, useMemo, useState } from 'react';
import { userSession, setSession, ownedCountries } from '../stores/session';
import { countries, bids } from '../stores/bids';
import { personalDashboard } from '../lib/stats';
import { setModalOpen, selectCountry } from '../stores/ui';
import { randomColor } from '../lib/seed';
import { WORLD_BID_API_URL, setAuthToken } from '../lib/api-http';
import type { User } from '../lib/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fmtMoney(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + Math.round(n).toLocaleString();
}

function aliasFromEmail(email: string): string {
  const prefix = email.split('@')[0] || 'User';
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

export default function UserPanel() {
  const user = useStore(userSession);
  const countriesMap = useStore(countries);
  const bidsMap = useStore(bids);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent'>('idle');

  const owned = useMemo(
    () => (user ? ownedCountries.get()(user.id) : []),
    [user, countriesMap, bidsMap]
  );
  // invested from ACTIVE owned bids (server truth), not the stale session field
  const invested = useMemo(() => {
    if (!user) return 0;
    return Object.values(countriesMap).reduce((sum, c) => {
      if (!c.activeBidId || c.iso2 === 'PLANE') return sum;
      const b = bidsMap[c.activeBidId];
      if (!b || String(b.userId) !== user.id) return sum;
      return sum + Number(b.amount);
    }, 0);
  }, [countriesMap, bidsMap, user]);
  const dash = useMemo(
    () => (user ? personalDashboard(user.id) : null),
    [user, countriesMap, bidsMap]
  );

  useEffect(() => {
    if (!user) {
      setEmail('');
      setPhase('idle');
    }
  }, [user]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Server mode: register (if new) then login against the NestJS backend.
  async function sendMagicLink() {
    if (!EMAIL_RE.test(email.trim())) return;
    setError('');
    setBusy(true);
    setPhase('sending');
    try {
      const base = WORLD_BID_API_URL;
      // 1) try register — 204 (created) or 409 (exists) both proceed to login
      await fetch(base + '/auth/email/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
          firstName: aliasFromEmail(email.trim()),
          lastName: '',
        }),
      }).catch(() => undefined);
      // 2) login
      const res = await fetch(base + '/auth/email/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.token) {
        setError(typeof body?.message === 'string' ? body.message : 'Invalid email or password.');
        setPhase('idle');
        return;
      }
      setAuthToken(body.token);
      // keep the server's numeric id as string so bid.userId matching works
      const u: User = {
        id: String(body.user?.id ?? Date.now().toString(36)),
        alias: body.user?.firstName || aliasFromEmail(email.trim()),
        email: body.user?.email || email.trim(),
        accentColor: randomColor(),
        ownedCountries: [],
        achievements: [],
        totalClicks: 0,
        totalInvested: 0,
        createdAt: Date.now(),
      };
      setSession(u);
      setOpen(false);
    } catch {
      setError('Could not reach the server. Try again.');
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setAuthToken(null);
    setSession(null);
    setOpen(false);
  }

  function openClaim() {
    setOpen(false);
    selectCountry(null);
    setModalOpen(true);
  }

  return (
    <>
      {/* Icon button — always visible */}
      <button
        className="user-icon-btn glass"
        onClick={() => setOpen(true)}
        aria-label={user ? 'Your dashboard' : 'Log in'}
        title={user ? 'Your dashboard' : 'Log in'}
        data-testid="user-icon-btn"
      >
        {user ? (
          <span className="user-icon-avatar" style={{ background: user.accentColor }}>
            {user.alias.slice(0, 2).toUpperCase()}
          </span>
        ) : (
          <span className="user-icon-glyph">👤</span>
        )}
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="user-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="user-modal glass" data-testid="user-modal">
            <button className="user-modal-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>

            {!user ? (
              /* Logged out — magic link flow */
              <div className="user-modal-login">
                <h3>Join WorldBid</h3>
                <p className="user-modal-sub">Create an account or log in — bids are backed by real payments.</p>
                {phase === 'idle' ? (
                  <>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="login-email"
                    />
                    <input
                      type="password"
                      placeholder="Password (min 6 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && password.length >= 6) void sendMagicLink(); }}
                      data-testid="login-password"
                    />
                    {error ? <div className="login-hint" style={{ color: 'var(--accent)' }}>{error}</div> : null}
                    <button
                      className="user-modal-btn"
                      onClick={() => void sendMagicLink()}
                      disabled={!EMAIL_RE.test(email.trim()) || password.length < 6 || busy}
                      data-testid="login-submit"
                    >
                      {busy ? 'Connecting…' : 'Join / Log in'}
                    </button>
                  </>
                ) : phase === 'sending' ? (
                  <div className="up-magic-status" data-testid="magic-sending">
                    <span>📨 Sending link…</span>
                  </div>
                ) : (
                  <div className="up-magic-status up-magic-sent" data-testid="magic-sent">
                    <span>✓ Check your inbox — link clicked!</span>
                  </div>
                )}
              </div>
            ) : (
              /* Logged in — dashboard */
              <div className="user-modal-dash">
                <div className="user-modal-head">
                  <div className="user-icon-avatar lg" style={{ background: user.accentColor }}>
                    {user.alias.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="user-modal-alias" style={{ color: user.accentColor }}>{user.alias}</div>
                    <div className="user-modal-email">{user.email}</div>
                  </div>
                </div>
                <div className="user-modal-stats">
                  <button className="user-modal-stat" onClick={openClaim}>
                    <span className="user-modal-stat-v">{owned.length}</span>
                    <span className="user-modal-stat-l">countries</span>
                  </button>
                  <div className="user-modal-stat">
                    <span className="user-modal-stat-v">{dash?.totalClicks ?? 0}</span>
                    <span className="user-modal-stat-l">clicks</span>
                  </div>
                  <div className="user-modal-stat">
                    <span className="user-modal-stat-v">{fmtMoney(invested)}</span>
                    <span className="user-modal-stat-l">invested</span>
                  </div>
                </div>
                <button className="user-modal-logout" onClick={logout}>Log out</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
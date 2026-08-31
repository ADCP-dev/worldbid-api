// Persistence layer for the WorldBid countries_db.
//
// 3 localStorage keys:
//   worldbid_user_session    -> User JSON
//   worldbid_countries_db    -> CountriesDb JSON ({ countries, bids })
//   worldbid_global_history  -> HistoryEvent[] JSON (capped at 200)
//
// Non-destructive migration: on first load, if the new keys are absent but the
// old 5 flat keys are present (worldbid_bids / worldbid_selected / worldbid_pov
// / worldbid_clicks / worldbid_activity), they are READ and COPIED into the new
// 3-key shape. Old keys are NOT cleared — that happens in a post-verification
// cleanup so rollback preserves user data. The migration is idempotent: it
// skips entirely once `worldbid_countries_db` exists.
//
// All writes are wrapped in try/catch so quota / private-mode errors degrade
// gracefully instead of crashing the app.

import type { CountriesDb, HistoryEvent, User } from './types';
import { seedCountries } from './seed';

// --- new 3 keys ---
export const K_SESSION = 'worldbid_user_session';
export const K_COUNTRIES_DB = 'worldbid_countries_db';
export const K_HISTORY = 'worldbid_global_history';

// --- old 5 keys (read-only migration source) ---
const K_OLD_BIDS = 'worldbid_bids';
const K_OLD_SELECTED = 'worldbid_selected';
const K_OLD_POV = 'worldbid_pov';
const K_OLD_CLICKS = 'worldbid_clicks';
const K_OLD_ACTIVITY = 'worldbid_activity';

const HISTORY_CAP = 200;

/** Read + parse a JSON localStorage key; return null on any failure. */
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write JSON to localStorage; swallow quota / private-mode errors. */
function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — graceful degradation */
  }
}

/**
 * One-time, non-destructive migration from the old 5 flat keys to the new 3
 * structured keys. Reads old keys, maps them into CountriesDb + HistoryEvent[],
 * writes the new keys, and LEAVES the old keys intact. Idempotent: skips
 * entirely once `worldbid_countries_db` already exists.
 */
function migrateFromOldKeys(): void {
  if (localStorage.getItem(K_COUNTRIES_DB) != null) return;
  const oldBids = readJson<unknown[]>(K_OLD_BIDS);
  if (!oldBids || oldBids.length === 0) return; // nothing to migrate

  // Map old flat bids -> { countries, bids }.
  const db: CountriesDb = { countries: {}, bids: {} };
  const now = Date.now();
  oldBids.forEach((raw, i) => {
    const b = raw as Record<string, unknown>;
    const iso2 = String(b.iso2 ?? '');
    if (!iso2) return;
    const bidId = String(b.id ?? 'migrated-' + i);
    const userId = String(b.username ?? 'migrated-user');
    // We cannot know the continent from the old shape; default to EU and let
    // the geojson resolver patch it on load. The active bid is the LAST bid
    // placed on a given country in the old flat array (chronological append).
    db.bids[bidId] = {
      id: bidId,
      countryId: iso2,
      userId,
      alias: String(b.username ?? ''),
      email: String(b.email ?? ''),
      url: String(b.websiteUrl ?? ''),
      logoUrl: String(b.faviconUrl ?? ''),
      pitch: String(b.description ?? ''),
      amount: Number(b.amount ?? 0),
      accentColor: String(b.avatarColor ?? '#3B82F6'),
      placedAt: Number(b.timestamp ?? now),
    };
    const existing = db.countries[iso2];
    if (existing) {
      existing.bidHistory.push(bidId);
      // last bid wins as active (vitalicio: highest placedAt, old array is chronological)
      existing.activeBidId = bidId;
    } else {
      db.countries[iso2] = {
        iso2,
        name: iso2,
        continent: 'EU',
        developer: iso2 === 'IB',
        activeBidId: bidId,
        totalClicks: 0,
        websiteClicks: {},
        bidHistory: [bidId],
      };
    }
  });

  // Carry over old clicks into the matching countries.
  const oldClicks = readJson<Record<string, number>>(K_OLD_CLICKS);
  if (oldClicks) {
    for (const [iso2, count] of Object.entries(oldClicks)) {
      const c = db.countries[iso2];
      if (c) c.totalClicks = Number(count) || 0;
    }
  }

  writeJson(K_COUNTRIES_DB, db);

  // Migrate old activity entries into the global history log.
  const oldActivity = readJson<unknown[]>(K_OLD_ACTIVITY);
  if (oldActivity && oldActivity.length) {
    const events: HistoryEvent[] = oldActivity.map((raw, i) => {
      const a = raw as Record<string, unknown>;
      return {
        id: 'migrated-act-' + i,
        type: 'bid',
        countryId: String(a.iso2 ?? ''),
        userId: String(a.username ?? ''),
        message: String(a.username ?? '') + ' staked $' + Number(a.amount ?? 0),
        timestamp: Number(a.timestamp ?? now),
      };
    });
    writeJson(K_HISTORY, events.length > HISTORY_CAP ? events.slice(events.length - HISTORY_CAP) : events);
  }

  // Old keys are intentionally NOT cleared — post-verification cleanup only.
}

/** Load all 3 keys, running the one-time migration if needed, and seeding on first load. */
export function loadAll(): {
  session: User | null;
  db: CountriesDb;
  history: HistoryEvent[];
} {
  migrateFromOldKeys();
  let session = readJson<User>(K_SESSION);
  let db = readJson<CountriesDb>(K_COUNTRIES_DB);
  if (!db || !db.countries || Object.keys(db.countries).length === 0) {
    db = seedCountries();
    writeJson(K_COUNTRIES_DB, db);
  }
  // Ensure the synthetic PLANE spot exists (older persisted DBs predate it).
  // Vacant on creation; a placed PLANE bid rides the normal bid persistence.
  if (!db.countries.PLANE) {
    db.countries.PLANE = {
      iso2: 'PLANE',
      name: 'Global plane banner',
      continent: 'GL',
      developer: false,
      activeBidId: null,
      bidHistory: [],
      totalClicks: 0,
      websiteClicks: {},
    };
    writeJson(K_COUNTRIES_DB, db);
  }
  // On first load, create a default guest user so bid/click flows have a userId.
  if (!session) {
    session = createGuestUser();
    writeJson(K_SESSION, session);
  }
  const history = readJson<HistoryEvent[]>(K_HISTORY) ?? [];
  const trimmed = history.length > HISTORY_CAP ? history.slice(history.length - HISTORY_CAP) : history;
  return { session, db, history: trimmed };
}

/** Default anonymous session used when no persisted user exists. */
function createGuestUser(): User {
  return {
    id: 'guest-' + Date.now(),
    alias: 'Guest',
    email: '',
    accentColor: '#3B82F6',
    ownedCountries: [],
    achievements: [],
    totalClicks: 0,
    totalInvested: 0,
    createdAt: Date.now(),
  };
}

export function saveSession(user: User | null): void {
  // Never persist the transient guest marker: if the caller explicitly sets
  // null, clear the key. If a real user logs in later they overwrite it.
  if (user == null) {
    try { localStorage.removeItem(K_SESSION); } catch { /* ignore */ }
    return;
  }
  writeJson(K_SESSION, user);
}

export function saveCountries(db: CountriesDb): void {
  writeJson(K_COUNTRIES_DB, db);
}

export function saveHistory(history: HistoryEvent[]): void {
  // Cap at HISTORY_CAP, keeping the MOST RECENT events (oldest evicted first).
  const capped = history.length > HISTORY_CAP ? history.slice(history.length - HISTORY_CAP) : history;
  writeJson(K_HISTORY, capped);
}

/** Remove the old 5 flat keys. Call ONLY after verification confirms the new
 *  3-key shape is correct (post-merge cleanup). Safe to call multiple times. */
export function cleanupOldKeys(): void {
  for (const k of [K_OLD_BIDS, K_OLD_SELECTED, K_OLD_POV, K_OLD_CLICKS, K_OLD_ACTIVITY]) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}
// WorldBid data model — the single source of truth for all runtime types.
//
// This module exports the spec-exact TypeScript interfaces verbatim from the
// SDD spec (capability contract). Every other module (stores, engines, API
// mock, components) imports its types from here and MUST NOT re-declare them.
//
// RFC 2119: the shapes below are the binding data-model contract referenced by
// sdd-design and sdd-tasks. Changing a field name or type here is a breaking
// change to the whole platform.

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** ISO continent codes (Natural Earth CONTINENT field, normalized). */
export type ContinentCode = 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA' | 'GL';

/** Geolocated click origin. `country` is ISO-A2 or 'Unknown'; `region` is a
 *  subdivision name or 'Global' when geolocation is unavailable (fail-open). */
export interface ClickOrigin {
  country: string;
  region: string;
}

/** A single debounced visitor click on a country/website. */
export interface ClickEvent {
  id: string;
  countryId: string; // ISO-A2
  url: string; // the owner's target HTTPS URL that was visited
  origin: ClickOrigin;
  userId: string; // the country owner who received the click
  timestamp: number; // epoch ms
}

/** A vitalicio bid. One Bid per act of placing/outbidding; chronological. */
export interface Bid {
  id: string;
  countryId: string; // ISO-A2
  userId: string;
  alias: string; // bidder display name
  email: string; // contact email
  url: string; // target HTTPS URL
  logoUrl: string; // logo/favicon URL (32-256px square)
  pitch: string; // commercial pitch, max 120 chars
  amount: number; // USD, 2 decimal places
  accentColor: string; // hex color for the bidder avatar/banner accent
  placedAt: number; // epoch ms
}

/** A country record inside `worldbid_countries_db`. */
export interface Country {
  iso2: string;
  name: string;
  continent: ContinentCode;
  /** Developer-slot flag. IB (Islas Baleares) is the SOM·OS developer slot
   *  and is NOT claimable by users. Single source of truth — no iso2 string
   *  checks elsewhere. */
  developer: boolean;
  /** Active vitalicio bid id, or null when the country is vacant. */
  activeBidId: string | null;
  totalClicks: number;
  /** Per-URL click counts across this country's active owner. */
  websiteClicks: Record<string, number>;
  /** Chronological list of bid ids ever placed on this country. */
  bidHistory: string[]; // bid ids, chronological
}

/** The 10 achievement ids. */
export type AchievementId =
  | 'first_blood'
  | 'rising_star'
  | 'continent_master'
  | 'click_master'
  | 'click_king'
  | 'wealthy'
  | 'millionaire'
  | 'survivor'
  | 'legend'
  | 'disputed_territory';

/** An unlocked (or in-progress) achievement. `progress` is 0..1. */
export interface Achievement {
  id: AchievementId;
  unlockedAt: number; // epoch ms; 0 if not yet unlocked
  progress: number; // 0..1
}

/** Timeline event types persisted to `worldbid_global_history`. */
export type TimelineEventType = 'bid' | 'outbid' | 'achievement' | 'click';

/** A single entry in the append-only global history log (capped at 200). */
export interface HistoryEvent {
  id: string;
  type: TimelineEventType;
  countryId?: string; // ISO-A2 (optional — some achievements aren't country-scoped)
  userId: string;
  message: string;
  timestamp: number; // epoch ms
}

/** A user session (the single bidder/visitor persisted in localStorage). */
export interface User {
  id: string;
  alias: string;
  email: string;
  accentColor: string;
  ownedCountries: string[]; // ISO-A2 list (derived, but persisted for convenience)
  achievements: Achievement[];
  totalClicks: number; // clicks this user has received across owned countries
  totalInvested: number; // sum of this user's active bid amounts (USD)
  createdAt: number; // epoch ms
}

/** Aggregated global platform stats for the StatsPanel + leaderboards. */
export interface GlobalPlatformStats {
  claimedCount: number;
  totalCountries: number; // 195 + IB developer slot = 196
  totalInvested: number; // USD
  top5ByClicks: { countryId: string; clicks: number }[];
  top5ByCapital: { userId: string; capital: number }[];
  top5ByTerritories: { userId: string; count: number }[];
}

// ---------------------------------------------------------------------------
// API payload types (used by src/lib/api-mock.ts)
// ---------------------------------------------------------------------------

/** Payload for POST /api/bids. */
export interface NewBidInput {
  countryId: string;
  userId: string;
  alias: string;
  email: string;
  url: string;
  logoUrl: string;
  pitch: string;
  amount: number;
  accentColor: string;
}

/** Payload for POST /api/clicks. */
export interface NewClickInput {
  countryId: string;
  url: string;
  userId: string; // the country owner who receives the click
  origin?: ClickOrigin; // optional; API fills 'Unknown'/'Global' if absent
}

// ---------------------------------------------------------------------------
// localStorage shape (3 keys) — exported for type-safe persistence
// ---------------------------------------------------------------------------

/** Shape persisted under the single `worldbid_countries_db` localStorage key. */
export interface CountriesDb {
  countries: Record<string, Country>; // iso2 -> Country
  bids: Record<string, Bid>; // bid id -> Bid (side index, avoids a 4th key)
}
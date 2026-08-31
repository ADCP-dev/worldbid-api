// Achievements engine — 10-achievement evaluator (capability achievements).
//
// Pure function: `evaluateAchievements(userId)` returns the updated
// Achievement[] for that user. Unlocks are idempotent (no duplicate unlock).
// Progress is 0..1. The caller is responsible for appending an `achievement`
// HistoryEvent + persisting the session when a NEW unlock occurs.
//
// Threshold table (spec-exact):
//   first_blood         ownedCountries >= 1
//   rising_star         ownedCountries > 5
//   continent_master    >= 3 countries same continent
//   click_master        totalClicks > 100
//   click_king          totalClicks > 500
//   wealthy             totalInvested >= $100
//   millionaire         totalInvested >= $1000
//   survivor            7 consecutive days at #1 on some country
//   legend              30 consecutive days at #1 on some country
//   disputed_territory  outbid at least once
//
// `survivor`/`legend` "consecutive days at #1" are approximated from the
// active bid's placedAt vs now in days (the mock has no daily re-evaluation
// loop). When the active bid is lost (outbid), the streak resets because the
// country's activeBidId no longer points to this user's bid.

import type { Achievement, AchievementId, User } from './types';
import { countries, bids } from '../stores/bids';
import { globalHistory } from '../stores/history';
import { ownedCountries } from '../stores/session';

interface AchievementDef {
  id: AchievementId;
  progress: (ctx: EvalContext) => number; // 0..1
  unlocked: (ctx: EvalContext) => boolean;
}

interface EvalContext {
  owned: string[];
  perContinent: Record<string, number>;
  totalClicks: number; // clicks received across owned countries
  totalInvested: number;
  daysAtNo1: number; // max consecutive days at #1 across owned countries
  outbidCount: number;
}

const DEFS: AchievementDef[] = [
  {
    id: 'first_blood',
    progress: (c) => Math.min(1, c.owned.length / 1),
    unlocked: (c) => c.owned.length >= 1,
  },
  {
    id: 'rising_star',
    progress: (c) => Math.min(1, c.owned.length / 6),
    unlocked: (c) => c.owned.length > 5,
  },
  {
    id: 'continent_master',
    progress: (c) => Math.min(1, Math.max(0, ...Object.values(c.perContinent)) / 3),
    unlocked: (c) => Math.max(0, ...Object.values(c.perContinent)) >= 3,
  },
  {
    id: 'click_master',
    progress: (c) => Math.min(1, c.totalClicks / 101),
    unlocked: (c) => c.totalClicks > 100,
  },
  {
    id: 'click_king',
    progress: (c) => Math.min(1, c.totalClicks / 501),
    unlocked: (c) => c.totalClicks > 500,
  },
  {
    id: 'wealthy',
    progress: (c) => Math.min(1, c.totalInvested / 100),
    unlocked: (c) => c.totalInvested >= 100,
  },
  {
    id: 'millionaire',
    progress: (c) => Math.min(1, c.totalInvested / 1000),
    unlocked: (c) => c.totalInvested >= 1000,
  },
  {
    id: 'survivor',
    progress: (c) => Math.min(1, c.daysAtNo1 / 7),
    unlocked: (c) => c.daysAtNo1 >= 7,
  },
  {
    id: 'legend',
    progress: (c) => Math.min(1, c.daysAtNo1 / 30),
    unlocked: (c) => c.daysAtNo1 >= 30,
  },
  {
    id: 'disputed_territory',
    progress: (c) => (c.outbidCount >= 1 ? 1 : 0),
    unlocked: (c) => c.outbidCount >= 1,
  },
];

/** Build the evaluation context for a user from the live atoms. */
export function buildContext(userId: string): EvalContext {
  const owned = ownedCountries.get()(userId);
  const perContinent: Record<string, number> = {};
  let totalClicks = 0;
  let totalInvested = 0;
  let maxDays = 0;
  const now = Date.now();
  for (const iso2 of owned) {
    const c = countries.get()[iso2];
    if (!c) continue;
    perContinent[c.continent] = (perContinent[c.continent] || 0) + 1;
    totalClicks += c.totalClicks;
    if (c.activeBidId) {
      const b = bids.get()[c.activeBidId];
      if (b && b.userId === userId) {
        totalInvested += b.amount;
        const days = (now - b.placedAt) / (24 * 3600 * 1000);
        if (days > maxDays) maxDays = days;
      }
    }
  }
  // Count how many outbid events this user has performed (as the new owner).
  const outbidCount = globalHistory.get().filter(
    (h) => h.type === 'outbid' && h.userId === userId,
  ).length;

  return { owned, perContinent, totalClicks, totalInvested, daysAtNo1: Math.floor(maxDays), outbidCount };
}

/** Evaluate all 10 achievements for a user. Idempotent: existing unlocks keep
 *  their unlockedAt; new unlocks get unlockedAt = now. Progress is refreshed. */
export function evaluateAchievements(userId: string, current: Achievement[] = []): Achievement[] {
  const ctx = buildContext(userId);
  const now = Date.now();
  const byId = new Map<AchievementId, Achievement>(current.map((a) => [a.id, a]));
  const out: Achievement[] = [];
  for (const def of DEFS) {
    const prev = byId.get(def.id);
    const isUnlocked = def.unlocked(ctx);
    const progress = clamp01(def.progress(ctx));
    if (prev && prev.unlockedAt > 0) {
      // already unlocked — keep original unlock time, refresh progress (1)
      out.push({ id: def.id, unlockedAt: prev.unlockedAt, progress: 1 });
    } else if (isUnlocked) {
      out.push({ id: def.id, unlockedAt: now, progress: 1 });
    } else {
      out.push({ id: def.id, unlockedAt: 0, progress });
    }
  }
  return out;
}

/** Return the ids of achievements that were newly unlocked comparing old -> new. */
export function newlyUnlocked(old: Achievement[], next: Achievement[]): AchievementId[] {
  const oldUnlocked = new Set(old.filter((a) => a.unlockedAt > 0).map((a) => a.id));
  return next.filter((a) => a.unlockedAt > 0 && !oldUnlocked.has(a.id)).map((a) => a.id);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Convenience: evaluate + return a fresh User with updated achievements. */
export function evaluateUser(user: User): User {
  const next = evaluateAchievements(user.id, user.achievements);
  return { ...user, achievements: next };
}
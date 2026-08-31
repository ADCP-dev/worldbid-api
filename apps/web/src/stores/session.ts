// User session + achievements atoms.

import { atom, computed } from 'nanostores';
import type { Achievement, User } from '../lib/types';
import { countries, bids } from './bids';

/** The single persisted user (the local bidder/visitor). Null until login/claim. */
export const userSession = atom<User | null>(null);

/** Unlocked/in-progress achievements for the current user. */
export const achievements = atom<Achievement[]>([]);

/** Countries where the active bid belongs to `userId`. Recomputes on
 *  outbid write-through because it tracks `countries` + `bids`. */
export const ownedCountries = computed([countries, bids], (countriesMap, bidsMap) => {
  return (userId: string): string[] => {
    const out: string[] = [];
    for (const c of Object.values(countriesMap)) {
      if (!c.activeBidId) continue;
      const b = bidsMap[c.activeBidId];
      if (b && b.userId === userId) out.push(c.iso2);
    }
    return out;
  };
});

/** Hydrate the session atom from persistence. */
export function hydrateSession(user: User | null): void {
  userSession.set(user);
  achievements.set(user?.achievements ?? []);
}

/** Snapshot the current session for persistence. */
export function snapshotSession(): User | null {
  return userSession.get();
}

/** Replace the session atom (after a bid/claim/achievement update). */
export function setSession(user: User | null): void {
  userSession.set(user);
  if (user) achievements.set(user.achievements);
  else achievements.set([]);
}
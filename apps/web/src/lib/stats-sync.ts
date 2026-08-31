// Server stats store — mirrors GET /worldbid/stats into a nanostores atom.
//
// The legacy globalStats() (lib/stats.ts) computes from LOCAL state; once the
// backend is configured the header must show server truth (claimed, invested).
// Refresh cadence: on boot, on every SSE activity frame (via live-sync), and
// on an explicit interval fallback so the chip stays honest even without SSE.

import { atom } from 'nanostores';
import { isServerApiEnabled } from './api-http';

export interface ServerStats {
  claimedCount: number;
  totalCountries: number;
  totalInvested: number;
}

export const serverStats = atom<ServerStats | null>(null);

let refreshTimer: ReturnType<typeof setInterval> | null = null;

export async function refreshServerStats(): Promise<void> {
  if (!isServerApiEnabled()) return;
  try {
    const res = await fetch(
      (import.meta.env.PUBLIC_WORLDBID_API_URL as string) + '/stats',
    );
    if (!res.ok) return;
    serverStats.set((await res.json()) as ServerStats);
  } catch {
    /* offline — keep last known */
  }
}

/** Start a 30s fallback poll (idempotent). */
export function startServerStatsPolling(): void {
  if (refreshTimer || !isServerApiEnabled() || typeof window === 'undefined')
    return;
  refreshTimer = setInterval(() => void refreshServerStats(), 30_000);
}
// localStorage persistence for WorldBid state.
// Keys are namespaced `worldbid_*` and tolerate JSON parse failures (reset).

import type { Bid, ActivityEntry } from '../stores/worldbid';

const K_BIDS = 'worldbid_bids';
const K_SELECTED = 'worldbid_selected';
const K_POV = 'worldbid_pov';
const K_CLICKS = 'worldbid_clicks';
const K_ACTIVITY = 'worldbid_activity';

export interface PersistedState {
  bids: Bid[];
  selected: string | null;
  pov: { lat: number; lng: number; altitude: number };
  clicks: Record<string, number>;
  activity: ActivityEntry[];
}

export function loadState(): Partial<PersistedState> {
  try {
    return {
      bids: JSON.parse(localStorage.getItem(K_BIDS) || '[]'),
      selected: localStorage.getItem(K_SELECTED) || null,
      pov: JSON.parse(localStorage.getItem(K_POV) || '{}'),
      clicks: JSON.parse(localStorage.getItem(K_CLICKS) || '{}'),
      activity: JSON.parse(localStorage.getItem(K_ACTIVITY) || '[]'),
    };
  } catch {
    return { bids: [], pov: {}, clicks: {}, activity: [] };
  }
}

export function saveState(s: PersistedState): void {
  try {
    localStorage.setItem(K_BIDS, JSON.stringify(s.bids));
    localStorage.setItem(K_SELECTED, s.selected || '');
    localStorage.setItem(K_POV, JSON.stringify(s.pov));
    localStorage.setItem(K_CLICKS, JSON.stringify(s.clicks));
    localStorage.setItem(K_ACTIVITY, JSON.stringify(s.activity.slice(0, 60)));
  } catch {
    /* quota / private mode — ignore */
  }
}
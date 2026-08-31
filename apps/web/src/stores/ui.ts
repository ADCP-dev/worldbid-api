// UI state atoms — selection, hover, camera pov, modal, day/night override.
//
// These are NOT persisted as a bloc; `pov` and `selectedIso2` were persisted
// under the old layout but in the new 3-key shape they live only in memory
// (selection/hover reset on reload is acceptable; the globe restores a default
// POV). The `dayBandOverride` atom drives the manual day/night toggle.

import { atom } from 'nanostores';
import type { DayBand } from '../lib/day-night';

export interface POV {
  lat: number;
  lng: number;
  altitude: number;
}

export const selectedIso2 = atom<string | null>(null);
export const hoveredIso2 = atom<string | null>(null);
export const pov = atom<POV>({ lat: 20, lng: 0, altitude: 2.5 });
export const modalOpen = atom<boolean>(false);
export const dayBandOverride = atom<DayBand | null>(null);

export function selectCountry(iso2: string | null): void {
  selectedIso2.set(iso2);
}

export function setHovered(iso2: string | null): void {
  hoveredIso2.set(iso2);
}

export function setPov(p: POV): void {
  pov.set(p);
}

export function setModalOpen(open: boolean): void {
  modalOpen.set(open);
}

export function setDayBandOverride(band: DayBand | null): void {
  dayBandOverride.set(band);
}

/** Atom + setter used by header nav and other non-React callers to drive the
 *  RightInspector dashboard tab from outside the island. */
export const rightInspectorTab = atom<'country' | 'dashboard'>('country');
export function setRightTab(tab: 'country' | 'dashboard'): void {
  rightInspectorTab.set(tab);
}
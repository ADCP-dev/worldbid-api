// Legacy day/night module — thin re-export of the canonical 4-band module.
//
// Globe.astro currently imports { getDayNightTextures } from '../lib/daynight'.
// Until the globe-wiring phase rewires it to the new 4-band accessor, this
// module preserves that import surface by delegating to day-night.ts.
//
// New code MUST import from './day-night' (getLocalHourBand, getBandVisuals).

import { getLocalHourBand, getBandVisuals, type DayBand } from './day-night';

export { getLocalHourBand, getBandVisuals };
export type { DayBand };

export interface DayNightTextures {
  globe: string;
  background: string | null;
  isDay: boolean;
}

/** Legacy 2-band accessor kept for the pre-split Globe.astro script. */
export function isDaytime(): boolean {
  return getBandVisuals(getLocalHourBand()).isDay;
}

/** Legacy 2-band accessor kept for the pre-split Globe.astro script. */
export function getDayNightTextures(): DayNightTextures {
  const v = getBandVisuals(getLocalHourBand());
  return { globe: v.globeTexture, background: v.backgroundImage, isDay: v.isDay };
}
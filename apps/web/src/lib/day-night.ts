// Day / night atmosphere — simplified to TWO visual states per the user's
// brief ("de día va a ser blanco de noche oscuro"). The PRD's 4-band model is
// preserved in `getLocalHourBand` for the analytic seed, but the live UI only
// reads `isDay` to switch the page background, the globe texture, and the
// glass panel alpha.
//
// Body classes used:
//   body.day    — light/white page, dark text
//   body.night  — dark page, light text
//
// The body background is set via CSS variables so the globe scene + the glass
// panels adapt together.

const TEX_DAY = '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg';
const TEX_NIGHT = '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg';
const BG_NIGHT = '//cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png';

export type DayBand = 'madrugada' | 'manana' | 'tarde' | 'noche';

export interface BandVisuals {
  globeTexture: string;
  backgroundImage: string | null;
  bodyClass: string;
  isDay: boolean;
}

/** Resolve the viewer-hour band. 4-band for analytics; the live UI only reads isDay. */
export function getLocalHourBand(hour: number = new Date().getHours()): DayBand {
  if (hour < 6) return 'madrugada';
  if (hour < 12) return 'manana';
  if (hour < 18) return 'tarde';
  return 'noche';
}

/** Is this a daytime band? */
export function isDaytimeHour(hour: number = new Date().getHours()): boolean {
  const h = hour % 24;
  return h >= 6 && h < 18;
}

/** Inverse mode (day <-> night) — used by the manual toggle. */
export function oppositeMode(isDay: boolean): boolean {
  return !isDay;
}

/** Per-band visual settings. UI uses isDay; the band name is kept for analytics. */
export function getBandVisuals(band: DayBand): BandVisuals {
  const day = band === 'manana' || band === 'tarde';
  return {
    globeTexture: day ? TEX_DAY : TEX_NIGHT,
    backgroundImage: day ? null : BG_NIGHT,
    bodyClass: day ? 'day' : 'night',
    isDay: day,
  };
}

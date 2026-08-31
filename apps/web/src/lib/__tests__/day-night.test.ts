import { describe, it, expect } from 'vitest';
import { getLocalHourBand, getBandVisuals, isDaytimeHour, oppositeMode } from '../day-night';

describe('getLocalHourBand — 4-band viewer-hour boundaries', () => {
  it('00 -> madrugada (inclusive lower bound)', () => {
    expect(getLocalHourBand(0)).toBe('madrugada');
  });
  it('05 -> madrugada', () => {
    expect(getLocalHourBand(5)).toBe('madrugada');
  });
  it('06 -> manana (spec "Band at boundary")', () => {
    expect(getLocalHourBand(6)).toBe('manana');
  });
  it('11 -> manana', () => {
    expect(getLocalHourBand(11)).toBe('manana');
  });
  it('12 -> tarde', () => {
    expect(getLocalHourBand(12)).toBe('tarde');
  });
  it('17 -> tarde', () => {
    expect(getLocalHourBand(17)).toBe('tarde');
  });
  it('18 -> noche (spec scenario)', () => {
    expect(getLocalHourBand(18)).toBe('noche');
  });
  it('23 -> noche', () => {
    expect(getLocalHourBand(23)).toBe('noche');
  });
});

describe('isDaytimeHour — manual override is separate from band', () => {
  it('00 -> false (night)', () => {
    expect(isDaytimeHour(0)).toBe(false);
  });
  it('12 -> true (day)', () => {
    expect(isDaytimeHour(12)).toBe(true);
  });
  it('18 -> false (boundary — night wins)', () => {
    expect(isDaytimeHour(18)).toBe(false);
  });
});

describe('oppositeMode — day <-> night', () => {
  it('flips', () => {
    expect(oppositeMode(true)).toBe(false);
    expect(oppositeMode(false)).toBe(true);
  });
});

describe('getBandVisuals', () => {
  it('returns a non-empty globeTexture + bodyClass for every band', () => {
    for (const b of ['madrugada', 'manana', 'tarde', 'noche'] as const) {
      const v = getBandVisuals(b);
      expect(v.globeTexture.length).toBeGreaterThan(0);
      expect(v.bodyClass.length).toBeGreaterThan(0);
    }
  });
  it('manana and tarde are day bands (isDay true)', () => {
    expect(getBandVisuals('manana').isDay).toBe(true);
    expect(getBandVisuals('tarde').isDay).toBe(true);
  });
  it('madrugada and noche are night bands (isDay false)', () => {
    expect(getBandVisuals('madrugada').isDay).toBe(false);
    expect(getBandVisuals('noche').isDay).toBe(false);
  });
});

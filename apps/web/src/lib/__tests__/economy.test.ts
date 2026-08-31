import { describe, it, expect } from 'vitest';
import {
  PLANE_SPOT_ID,
  PLANE_MIN_STAKE,
  minIncrementForCountry,
  minIncrementForPlane,
  minBidForKind,
} from '../economy';

describe('minIncrementForCountry — tier examples', () => {
  // 2.50*1.20=3.00 | 25*1.20=30 | 50*1.10=55 | 100*1.10=110
  // 250*1.05=262.50 | 1000*1.05=1050
  it.each([
    [2.5, 3],
    [25, 30],
    [50, 55],
    [100, 110],
    [250, 262.5],
    [1000, 1050],
  ])('country $%# -> $%#', (current, expected) => {
    expect(minIncrementForCountry(current)).toBe(expected);
  });
});

describe('minIncrementForCountry — inclusive lower bounds + ceil grid', () => {
  it('$50 sits in the +10% tier (inclusive lower bound)', () => {
    expect(minIncrementForCountry(49.99)).toBe(60); // 49.99*1.20=59.988 -> ceil to 60.00
    expect(minIncrementForCountry(50)).toBe(55);
  });
  it('$250 sits in the +5% tier (inclusive lower bound)', () => {
    expect(minIncrementForCountry(249.99)).toBe(275); // 249.99*1.10=274.989 -> ceil to 275.00
    expect(minIncrementForCountry(250)).toBe(262.5);
  });
  it('ceils a raw percentage jump UP to the $0.25 grid', () => {
    // 60*1.10=66 -> already on grid; 61*1.10=67.1 -> ceil to 67.25
    expect(minIncrementForCountry(60)).toBe(66);
    expect(minIncrementForCountry(61)).toBe(67.25);
  });
});

describe('minIncrementForPlane — tier examples', () => {
  // 20*1.25=25 | 60*1.25=75 | 100*1.15=115 | 200*1.15=230
  // 500*1.10=550 | 1000*1.10=1100 | 5000*1.05=5250
  it.each([
    [20, 25],
    [60, 75],
    [100, 115],
    [200, 230],
    [500, 550],
    [1000, 1100],
    [5000, 5250],
  ])('plane $%# -> $%#', (current, expected) => {
    expect(minIncrementForPlane(current)).toBe(expected);
  });
});

describe('minIncrementForPlane — inclusive lower bounds + ceil grid', () => {
  it('$100 sits in the +15% tier, $500 in +10%, $5000 in +5%', () => {
    expect(minIncrementForPlane(99.99)).toBe(125); // 99.99*1.25=124.9875 -> ceil to 125
    expect(minIncrementForPlane(100)).toBe(115);
    expect(minIncrementForPlane(500)).toBe(550);
    expect(minIncrementForPlane(5000)).toBe(5250);
  });
  it('ceils a raw percentage jump UP to the $5 grid', () => {
    // 33*1.25=41.25 -> ceil to 45
    expect(minIncrementForPlane(33)).toBe(45);
  });
});

describe('minBidForKind — vacant cases', () => {
  it('vacant country -> MIN_STAKE ($2.50)', () => {
    expect(minBidForKind('country', null)).toBe(2.5);
  });
  it('vacant plane -> PLANE_MIN_STAKE ($20)', () => {
    expect(minBidForKind('plane', null)).toBe(20);
  });
  it('exports', () => {
    expect(PLANE_SPOT_ID).toBe('PLANE');
    expect(PLANE_MIN_STAKE).toBe(20);
  });
});
import { describe, it, expect } from 'vitest';
import {
  minBidForCountry,
  minBidForPlane,
  minBidForKind,
  ceilTo,
  PLANE_MIN_STAKE,
} from '../economy';

describe('economy — tiered minimum bids (server port of front economy.ts)', () => {
  it('countries: vacant -> $2.50', () => {
    expect(minBidForCountry(null)).toBe(2.5);
  });

  it('countries: first tier +20% ceiled to $0.25', () => {
    expect(minBidForCountry(2.5)).toBe(3);
    expect(minBidForCountry(25)).toBe(30);
    expect(minBidForCountry(10)).toBe(12);
  });

  it('countries: second tier +10% (inclusive bound at $50)', () => {
    expect(minBidForCountry(50)).toBe(55);
    expect(minBidForCountry(100)).toBe(110);
  });

  it('countries: third tier +5% (inclusive bound at $250)', () => {
    expect(minBidForCountry(250)).toBe(262.5);
    expect(minBidForCountry(1000)).toBe(1050);
  });

  it('countries: IEEE-754 overshoot is absorbed ($50 -> exactly $55)', () => {
    // 50 * 1.1 === 55.000000000000007 in float math
    expect(minBidForCountry(50)).toBe(55);
  });

  it('plane: vacant -> $20', () => {
    expect(minBidForPlane(null)).toBe(PLANE_MIN_STAKE);
    expect(PLANE_MIN_STAKE).toBe(20);
  });

  it('plane: first tier +25% ceiled to $5', () => {
    expect(minBidForPlane(20)).toBe(25);
    expect(minBidForPlane(60)).toBe(75);
    expect(minBidForPlane(37)).toBe(50); // 46.25 -> ceil $5 -> 50
  });

  it('plane: second tier +15% (inclusive bound at $100)', () => {
    expect(minBidForPlane(100)).toBe(115);
    expect(minBidForPlane(200)).toBe(230);
  });

  it('plane: third tier +10% (inclusive bound at $500)', () => {
    expect(minBidForPlane(500)).toBe(550);
    expect(minBidForPlane(1000)).toBe(1100);
  });

  it('plane: fourth tier +5% (inclusive bound at $5000)', () => {
    expect(minBidForPlane(5000)).toBe(5250);
  });

  it('minBidForKind routes plane vs country', () => {
    expect(minBidForKind('plane', null)).toBe(20);
    expect(minBidForKind('country', null)).toBe(2.5);
    expect(minBidForKind('plane', 20)).toBe(25); // +25%
    expect(minBidForKind('country', 20)).toBe(24); // +20%
  });

  it('ceilTo handles float overshoot', () => {
    expect(ceilTo(55.000000000000007, 0.25)).toBe(55);
    expect(ceilTo(46.25, 5)).toBe(50);
    expect(ceilTo(55, 5)).toBe(55);
  });
});
import { describe, it, expect } from 'vitest';
import { heatColorFor, HEAT_TIERS, MIN_STAKE } from '../heatmap';

describe('heatColorFor — spec-exact L0-L4 thresholds', () => {
  it('null -> L0 (vacant)', () => {
    expect(heatColorFor(null).tier).toBe('L0');
    expect(heatColorFor(null).color).toBe(HEAT_TIERS.L0.color);
  });

  it('below MIN_STAKE -> L0', () => {
    expect(heatColorFor(0).tier).toBe('L0');
    expect(heatColorFor(1).tier).toBe('L0');
    expect(heatColorFor(2.49).tier).toBe('L0');
  });

  it('$2.50 -> L1 (boundary inclusive of lower bound)', () => {
    expect(heatColorFor(MIN_STAKE).tier).toBe('L1');
    expect(heatColorFor(MIN_STAKE).color).toBe(HEAT_TIERS.L1.color);
  });

  it('$24.99 -> L1, $25.00 -> L2 (boundary scenario)', () => {
    expect(heatColorFor(24.99).tier).toBe('L1');
    expect(heatColorFor(25).tier).toBe('L2');
    expect(heatColorFor(25).color).toBe(HEAT_TIERS.L2.color);
  });

  it('$99.99 -> L2, $100 -> L3', () => {
    expect(heatColorFor(99.99).tier).toBe('L2');
    expect(heatColorFor(100).tier).toBe('L3');
  });

  it('$499.99 -> L3, $500 -> L4 (spec "$500 maps to L4")', () => {
    expect(heatColorFor(499.99).tier).toBe('L3');
    expect(heatColorFor(500).tier).toBe('L4');
    expect(heatColorFor(500).color).toBe(HEAT_TIERS.L4.color);
    expect(heatColorFor(10_000).tier).toBe('L4');
  });

  it('non-finite -> L0', () => {
    expect(heatColorFor(NaN).tier).toBe('L0');
    expect(heatColorFor(Infinity).tier).toBe('L4'); // Infinity >= 500
    expect(heatColorFor(-1).tier).toBe('L0');
  });
});
// Tiered minimum-increment economy (USD). Two price ladders.
//
// Both round the raw percentage jump UP to a clean grid so quoted minimums
// are always clean numbers. Lower tier bounds are inclusive.
//
//   Countries: <$50: +20% | $50-$249.99: +10% | >=$250: +5%  (ceil to $0.25)
//   Plane:     <$100: +25% | $100-$499.99: +15% | $500-$4999.99: +10%
//              | >=$5000: +5%                              (ceil to $5)

import { MIN_STAKE } from './heatmap';

export const PLANE_SPOT_ID = 'PLANE';
export const PLANE_MIN_STAKE = 20;

function ceilToGrid(value: number, grid: number): number {
  // Epsilon-tolerant ceil: 50*1.1 === 55.000000000000007 in IEEE-754, a naive
  // ceil would jump to the next step. Snap values within 1e-9 of a step down
  // to it, then round away residual grid-multiply noise (e.g. 55.24999...).
  const steps = value / grid;
  const snapped = Math.ceil(steps - 1e-9);
  return Math.round(snapped * grid * 100) / 100;
}

/** Countries: <$50: +20% | $50-$249.99: +10% | >=$250: +5%. Ceil to $0.25. */
export function minIncrementForCountry(currentAmount: number): number {
  const pct = currentAmount < 50 ? 0.20 : currentAmount < 250 ? 0.10 : 0.05;
  return ceilToGrid(currentAmount * (1 + pct), 0.25);
}

// Plane: <$100: +25% | $100-$499.99: +15% | $500-$4999.99: +10% | >=$5000: +5%. Ceil to $5.
export function minIncrementForPlane(currentAmount: number): number {
  const pct = currentAmount < 100 ? 0.25 : currentAmount < 500 ? 0.15 : currentAmount < 5000 ? 0.10 : 0.05;
  return ceilToGrid(currentAmount * (1 + pct), 5);
}

export type SpotKind = 'country' | 'plane';

/**
 * Minimum allowed bid for a spot kind.
 *
 * Vacant: country -> 2.5 (import MIN_STAKE from './heatmap'), plane -> 20.
 * Occupied: currentAmount + tiered increment, rounded per grid.
 */
export function minBidForKind(kind: SpotKind, currentAmount: number | null): number {
  if (currentAmount == null) return kind === 'plane' ? PLANE_MIN_STAKE : MIN_STAKE;
  return kind === 'plane' ? minIncrementForPlane(currentAmount) : minIncrementForCountry(currentAmount);
}
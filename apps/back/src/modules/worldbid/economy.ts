/**
 * WorldBid tiered economy — server-side port of the front's economy.ts.
 *
 * Two price ladders over the same vitalicio (until-outbid) auction model.
 * Minimum next bids are rounded UP to a clean grid so quoted minimums are
 * always clean numbers. Lower tier bounds are inclusive.
 */

export const PLANE_SPOT_ID = 'PLANE';
export const PLANE_MIN_STAKE = 20;

/** Developer slot (Islas Baleares) — permanently owned, never claimable. */
export const DEVELOPER_SPOT_ID = 'IB';

/** Total-multiplier tiers: countries are intentionally gentler than plane. */
function multiplierForCountry(currentAmount: number): number {
  if (currentAmount < 50) return 1.2;
  if (currentAmount < 250) return 1.1;
  return 1.05;
}

function multiplierForPlane(currentAmount: number): number {
  if (currentAmount < 100) return 1.25;
  if (currentAmount < 500) return 1.15;
  if (currentAmount < 5000) return 1.1;
  return 1.05;
}

/** Ceiling to a multiple of `step`, epsilon-tolerant (IEEE-754 overshoot safe). */
export function ceilTo(value: number, step: number): number {
  const q = value / step;
  return Math.round(Math.ceil(q - 1e-9) * step * 100) / 100;
}

/** Countries: <$50 +20% | $50–249.99 +10% | >=$250 +5%, ceiled to $0.25. */
export function minBidForCountry(currentAmount: number | null): number {
  if (currentAmount == null) return 2.5;
  return ceilTo(currentAmount * multiplierForCountry(currentAmount), 0.25);
}

/** Plane: <$100 +25% | $100–499.99 +15% | $500–4999.99 +10% | >=$5000 +5%, ceiled to $5. */
export function minBidForPlane(currentAmount: number | null): number {
  if (currentAmount == null) return PLANE_MIN_STAKE;
  return ceilTo(currentAmount * multiplierForPlane(currentAmount), 5);
}

export type SpotKind = 'country' | 'plane';

/** Unified entry point used by the bids service. */
export function minBidForKind(
  kind: SpotKind,
  currentAmount: number | null,
): number {
  return kind === 'plane'
    ? minBidForPlane(currentAmount)
    : minBidForCountry(currentAmount);
}
// Stake -> heat-map color mapping. Five tiers aligned to the SDD spec exact
// thresholds (capability bid-lifecycle, scenario "Boundary at $25.00" and
// "$500 maps to L4"):
//
//   L0 #3B82F6  vacant / null / < $2.50
//   L1 #10B981  $2.50 – $24.99
//   L2 #F59E0B  $25   – $99.99
//   L3 #F97316  $100  – $499.99
//   L4 #EF4444  $500+
//
// Lower bound is inclusive on each tier (so $25.00 -> L2, not L1). `null` and
// non-finite values map to L0 (vacant).
//
// Legacy `heatColor(total)` / `heatTierName(total)` / `HEAT` / `LEGEND_TIERS`
// / `MIN_STAKE` are kept as compat shims for the pre-split barrel; new code
// uses the spec-exact `heatColorFor(amount)` accessor.

export const HEAT_TIERS = {
  L0: { tier: 'L0', color: '#3B82F6', label: 'Vacant' },
  L1: { tier: 'L1', color: '#10B981', label: '$2.50–24.99' },
  L2: { tier: 'L2', color: '#F59E0B', label: '$25–99.99' },
  L3: { tier: 'L3', color: '#F97316', label: '$100–499.99' },
  L4: { tier: 'L4', color: '#EF4444', label: '$500+' },
} as const;

export const HEAT = {
  UNCLAIMED: HEAT_TIERS.L0.color,
  LOW: HEAT_TIERS.L1.color,
  MEDIUM: HEAT_TIERS.L2.color,
  HIGH: HEAT_TIERS.L3.color,
  VERY: HEAT_TIERS.L4.color,
} as const;

/** Spec-exact minimum bid amount for a vacant country (USD). */
export const MIN_STAKE = 2.5;

export interface HeatTier {
  tier: string;
  color: string;
}

/** Spec-exact accessor: amount -> { tier, color } per L0-L4 thresholds. */
export function heatColorFor(amount: number | null): HeatTier {
  if (amount == null || Number.isNaN(amount) || amount < MIN_STAKE) return HEAT_TIERS.L0;
  if (amount < 25) return HEAT_TIERS.L1;
  if (amount < 100) return HEAT_TIERS.L2;
  if (amount < 500) return HEAT_TIERS.L3;
  return HEAT_TIERS.L4;
}

// --- legacy compat (kept for the pre-split worldbid.ts barrel) ---

/** @deprecated use heatColorFor(amount).color */
export function heatColor(total: number): string {
  return heatColorFor(total).color;
}

/** @deprecated use heatColorFor(amount).tier + HEAT_TIERS labels */
export function heatTierName(total: number): string {
  const t = heatColorFor(total);
  if (t.tier === 'L0') return 'Unclaimed';
  if (t.tier === 'L1') return 'Low stake';
  if (t.tier === 'L2') return 'Medium stake';
  if (t.tier === 'L3') return 'High stake';
  return 'Very high stake';
}

/** @deprecated legend table; new Legend.tsx builds from HEAT_TIERS */
export const LEGEND_TIERS: Array<[string, string]> = [
  [HEAT_TIERS.L0.color, 'Vacant'],
  [HEAT_TIERS.L1.color, '$2.50–24.99'],
  [HEAT_TIERS.L2.color, '$25–99.99'],
  [HEAT_TIERS.L3.color, '$100–499.99'],
  [HEAT_TIERS.L4.color, '$500+'],
];
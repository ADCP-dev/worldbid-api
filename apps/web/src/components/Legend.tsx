import { HEAT_TIERS } from '../lib/heatmap';

const ORDER = [HEAT_TIERS.L0, HEAT_TIERS.L1, HEAT_TIERS.L2, HEAT_TIERS.L3, HEAT_TIERS.L4] as const;

export default function Legend() {
  return (
    <div id="legend" className="glass" data-testid="legend">
      {ORDER.map((t) => (
        <div className="li" key={t.tier}>
          <span className="sw" style={{ background: t.color }} />
          <span className="lbl">{t.tier}</span>
          <span className="rng">{t.label}</span>
        </div>
      ))}
    </div>
  );
}
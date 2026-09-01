// Legend — two-state map: vacant (pale grey, invites the next claim) and
// claimed (the owner's chosen territory color). No more heat tiers.

const ITEMS = [
  { swatch: '#D8DEE6', label: 'Vacant', hint: 'yours to claim' },
  { swatch: 'linear-gradient(135deg, #ef4444, #3b82f6, #10b981)', label: 'Claimed', hint: 'owner-picked color' },
];

export default function Legend() {
  return (
    <div id="legend" className="glass" data-testid="legend">
      {ITEMS.map((it) => (
        <div className="li" key={it.label}>
          <span className="sw" style={{ background: it.swatch }} />
          <span className="lbl">{it.label}</span>
          <span className="rng">{it.hint}</span>
        </div>
      ))}
    </div>
  );
}
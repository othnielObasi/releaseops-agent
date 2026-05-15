/* LaunchGuard v3 — Risk Heatmap (Tailwind) */

const LEVELS = ["Low", "Medium", "High"];

const CELL_COLORS = {
  high: "bg-accent-red/10",
  medium: "bg-accent-orange/10",
  low: "bg-accent-green/10",
  empty: "bg-lg-sf2",
};

export default function Heatmap({ risks }) {
  const matrix = {};
  LEVELS.forEach((l) => LEVELS.forEach((i) => { matrix[`${l}-${i}`] = []; }));
  risks.forEach((r) => {
    const key = `${r.likelihood || "Medium"}-${r.impact || "High"}`;
    if (matrix[key]) matrix[key].push(r);
  });

  const cellColor = (likelihood, impact) => {
    const score = LEVELS.indexOf(likelihood) + LEVELS.indexOf(impact);
    return score >= 3 ? CELL_COLORS.high : score >= 2 ? CELL_COLORS.medium : CELL_COLORS.low;
  };

  return (
    <div className="grid grid-cols-[50px_repeat(3,1fr)] gap-0.5">
      <div />
      {LEVELS.map((l) => (
        <div key={l} className="text-center text-xs font-semibold text-tx-4 py-1">{l}</div>
      ))}
      {[...LEVELS].reverse().map((lik) => (
        <div key={lik} className="contents">
          <div className="flex items-center justify-end pr-1.5 text-xs font-semibold text-tx-4">{lik}</div>
          {LEVELS.map((imp) => {
            const items = matrix[`${lik}-${imp}`];
            return (
              <div key={`${lik}-${imp}`} className={`${items.length ? cellColor(lik, imp) : CELL_COLORS.empty} border border-lg-bd rounded-[5px] p-1.5 min-h-[36px]`}>
                {items.map((r, i) => (
                  <div key={i} className="text-xs text-tx-2">{r.n.slice(0, 25)}</div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ReleaseOps v3 — Dashboard Page (Tailwind) */

import { Badge, Card, Button, CircularScore, Label } from "../components/ui";

const C = { bl: "#3b82f6", or: "#f59e0b", rd: "#ef4444", gn: "#22c55e", pr: "#7c3aed", sf: "#11131b", bd: "#1d2234" };

export default function Dashboard({ sessions = [], loading, onNew, onOpen }) {
  const scores = sessions.map((s) => s.st.score);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const driftAlerts = sessions.filter((s) => s.drift?.scoreDelta < 0).length;
  const pendingSignoffs = sessions.reduce((a, s) => a + s.signoffs.filter((x) => x.status === "pending").length, 0);

  const statColor = [
    "text-accent-blue",
    avg >= 60 ? "text-accent-orange" : "text-accent-red",
    "text-accent-orange",
    pendingSignoffs > 0 ? "text-accent-red" : "text-accent-green",
    driftAlerts > 0 ? "text-accent-red" : "text-accent-green",
    "text-accent-purple",
  ];

  return (
    <div className="max-w-[960px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-5 pt-6 animate-fade-up">
        <div>
          <h1 className="text-3xl font-extrabold text-tx">Dashboard</h1>
          <p className="text-sm text-tx-3 mt-1">Release readiness overview</p>
        </div>
        <Button variant="primary" size="md" onClick={onNew}>+ New Readiness Check</Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-4 animate-fade-up-1">
        {[
          { l: "Sessions", v: sessions.length },
          { l: "Avg Score", v: avg },
          { l: "Total Risks", v: sessions.reduce((a, s) => a + s.st.risks, 0) },
          { l: "Pending Sign-offs", v: pendingSignoffs },
          { l: "Drift Alerts", v: driftAlerts },
          { l: "Frameworks", v: 7 },
        ].map((x, i) => (
          <Card key={i} className="!p-3 text-center">
            <div className={`text-2xl font-extrabold ${statColor[i]}`}>{x.v}</div>
            <div className="text-sm text-tx-3 mt-0.5">{x.l}</div>
          </Card>
        ))}
      </div>

      {/* Score Trends */}
      {sessions.length > 0 ? (
      <Card className="mb-4 animate-fade-up-2">
        <Label>📊 Readiness Score Trends</Label>
        <svg viewBox="0 0 500 70" className="w-full" style={{ height: 80 }}>
          {[0, 1, 2].map((i) => (
            <line key={i} x1="0" y1={i * 30 + 5} x2="500" y2={i * 30 + 5} stroke={C.bd} strokeWidth=".4" strokeDasharray="3" />
          ))}
          <polyline
            points={sessions.map((s, i) => `${i * (500 / Math.max(sessions.length - 1, 1))},${70 - ((s.st.score - 30) / 50) * 65}`).join(" ")}
            fill="none" stroke={C.bl} strokeWidth="2" strokeLinejoin="round"
          />
          {sessions.map((s, i) => (
            <circle key={i} cx={i * (500 / Math.max(sessions.length - 1, 1))} cy={70 - ((s.st.score - 30) / 50) * 65} r="4" fill={s.st.score >= 65 ? C.gn : C.or} stroke={C.sf} strokeWidth="2" />
          ))}
        </svg>
      </Card>
      ) : (
      <Card className="mb-4 animate-fade-up-2 text-center !py-8">
        <div className="text-tx-3 text-sm">No sessions yet. Run your first readiness check to see trends.</div>
        <Button variant="primary" size="sm" onClick={onNew} className="mt-3">+ New Readiness Check</Button>
      </Card>
      )}

      {/* Two Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Recent Sessions */}
        <div>
          <Label>Recent Sessions</Label>
          {sessions.slice(0, 4).map((s) => (
            <Card key={s.id} onClick={() => onOpen(s.id)} className="!p-3 mb-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-base">{s.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-tx">{s.title}</div>
                    <div className="text-xs text-tx-3 font-mono">{s.date.split(",")[0]}</div>
                  </div>
                </div>
                <CircularScore score={s.st.score} size={36} />
              </div>
            </Card>
          ))}
        </div>

        {/* Governance Status */}
        <div>
          <Label>Governance Status</Label>
          <Card className="!p-3 mb-2 !border-l-[3px] border-l-accent-purple">
            <div className="text-sm font-bold text-tx">🚦 Production Release Gate</div>
            <div className="text-sm text-tx-3 mt-1">{sessions.length} sessions analyzed · Configure gates in Settings</div>
          </Card>
          <Card className={`!p-3 mb-2 !border-l-[3px] ${driftAlerts > 0 ? "border-l-accent-red" : "border-l-accent-green"}`}>
            <div className="text-sm font-bold text-tx">📡 Drift Monitor</div>
            <div className="text-sm text-tx-3 mt-1">
              {sessions.filter((s) => s.drift?.active).length} active monitors · {driftAlerts} regressions detected
            </div>
            {sessions.filter((s) => s.drift?.scoreDelta < 0).map((s) => (
              <div key={s.id} className="text-sm text-accent-red2 mt-1">⚠ {s.title}: {s.drift.scoreDelta} points</div>
            ))}
          </Card>
          <Card className={`!p-3 !border-l-[3px] ${pendingSignoffs > 0 ? "border-l-accent-orange" : "border-l-accent-green"}`}>
            <div className="text-sm font-bold text-tx">✍️ Pending Sign-offs</div>
            {sessions.filter((s) => s.signoffs.some((x) => x.status === "pending")).slice(0, 3).map((s) => (
              <div key={s.id} className="text-sm text-accent-orange2 mt-1">
                {s.title}: {s.signoffs.filter((x) => x.status === "pending").map((x) => x.role).join(", ")}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

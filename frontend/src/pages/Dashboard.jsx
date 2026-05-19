/* ReleaseOps v3 — Dashboard Page (Tailwind) */

import { Badge, Card, Button, CircularScore, Label } from "../components/ui";

const C = { bl: "#3b82f6", or: "#f59e0b", rd: "#ef4444", gn: "#22c55e", pr: "#7c3aed", sf: "#11131b", bd: "#1d2234" };

const AUTONOMOUS_PLAN = [
  { step: "Intake", state: "Complete", detail: "Classify release type, actors, data, tools, and launch context." },
  { step: "Plan", state: "Complete", detail: "Select risk frameworks, sign-off policy, tests, and evidence targets." },
  { step: "Reason", state: "Running", detail: "Navigator, Sentinel, and Herald coordinate the readiness decision." },
  { step: "Execute", state: "Ready", detail: "Create audit package, webhook payloads, tickets, and reviewer notifications." },
];

const ROADBLOCKS = [
  "Missing data sensitivity blocks production approval until owner confirms PII/PHI scope.",
  "High-risk action detected: refund execution requires human approval and logging.",
  "No named Legal reviewer: release can proceed only as Needs review.",
];

const SYSTEM_OF_RECORD = [
  ["Vultr Postgres", "release sessions, scores, approvals, audit events"],
  ["ReleaseOps API", "agent runs, gate evaluation, integration triggers"],
  ["Evidence pack", "reports, certificates, tests, guardrails, decision history"],
];

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

      {/* Enterprise Autonomy */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-3.5 mt-4 animate-fade-up-3">
        <Card>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <Label>Autonomous Agent Run Plan</Label>
              <p className="text-sm text-tx-3 -mt-1">ReleaseOps plans, reasons, handles blockers, and packages evidence before a go-live decision.</p>
            </div>
            <Badge color="gn" size="xs">Production workflow</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {AUTONOMOUS_PLAN.map((item, index) => (
              <div key={item.step} className="rounded-lg border border-lg-bd bg-lg-sf2 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-tx-4">0{index + 1}</span>
                  <Badge color={item.state === "Running" ? "or" : item.state === "Ready" ? "bl" : "gn"} size="xs">{item.state}</Badge>
                </div>
                <div className="mt-2 text-sm font-bold text-tx">{item.step}</div>
                <div className="mt-1 text-xs leading-5 text-tx-3">{item.detail}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Label>Roadblocks & System of Record</Label>
          <div className="space-y-2">
            {ROADBLOCKS.map((item) => (
              <div key={item} className="rounded-lg border border-accent-orange/20 bg-accent-orange/5 p-2.5 text-xs leading-5 text-tx-2">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {SYSTEM_OF_RECORD.map(([label, detail]) => (
              <div key={label} className="flex items-start justify-between gap-3 rounded-lg bg-lg-sf2 p-2.5">
                <span className="text-xs font-bold text-tx">{label}</span>
                <span className="text-right text-xs leading-5 text-tx-3">{detail}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

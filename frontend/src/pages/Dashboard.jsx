/* ReleaseOps v3 — Dashboard Page (Tailwind) */

import { Button, Label } from "../components/ui";

const C = { bl: "#2563eb", or: "#b45309", rd: "#b91c1c", gn: "#047857", sf: "#ffffff", bd: "#d8d0c2", tx3: "#6b7280" };

function scoreTone(score) {
  if (score >= 80) return { grade: "B", text: "text-accent-green", bg: "bg-accent-green/10", border: "border-accent-green/20", fill: C.gn };
  if (score >= 60) return { grade: "C", text: "text-accent-orange", bg: "bg-accent-orange/10", border: "border-accent-orange/20", fill: C.or };
  return { grade: "D", text: "text-accent-red", bg: "bg-accent-red/10", border: "border-accent-red/20", fill: C.rd };
}

function ReadinessTrend({ sessions, onOpen }) {
  const visible = sessions.slice(0, 6);
  const ready = visible.filter((session) => session.st.score >= 80).length;
  const needsControls = visible.filter((session) => session.st.score >= 60 && session.st.score < 80).length;
  const blocked = visible.filter((session) => session.st.score < 60).length;

  return (
    <section className="workspace-section mb-4 p-4 animate-fade-up-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Label>Release Readiness Snapshot</Label>
          <p className="text-sm text-tx-3 -mt-1">Latest release reviews grouped by whether they can move toward production.</p>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-lg-bd text-center text-xs font-bold">
          <div className="border-r border-lg-bd px-3 py-2"><div className="text-lg text-accent-green">{ready}</div><div className="text-tx-4">ready</div></div>
          <div className="border-r border-lg-bd px-3 py-2"><div className="text-lg text-accent-orange">{needsControls}</div><div className="text-tx-4">needs controls</div></div>
          <div className="px-3 py-2"><div className="text-lg text-accent-red">{blocked}</div><div className="text-tx-4">blocked</div></div>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-lg-bd">
        {visible.map((session) => {
          const tone = scoreTone(session.st.score);
          return (
            <button key={session.id} type="button" onClick={() => onOpen?.(session.id)} className="workspace-row grid w-full grid-cols-[minmax(0,1fr)_84px_120px] items-center gap-3 bg-transparent px-3 py-2 text-left font-sans">
              <span className="truncate text-sm font-bold text-tx">{session.title}</span>
              <span className={`rounded-full border px-2 py-1 text-center text-xs font-extrabold ${tone.border} ${tone.bg} ${tone.text}`}>{session.st.score}/100</span>
              <span className="text-right text-xs font-semibold text-tx-3">{session.st.risks} risks · {session.st.tests} tests</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function Dashboard({ sessions = [], loading, onNew, onOpen, onRefresh }) {
  const scores = sessions.map((s) => s.st.score);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const driftAlerts = sessions.filter((s) => s.drift?.scoreDelta < 0).length;
  const pendingSignoffs = sessions.reduce((a, s) => a + s.signoffs.filter((x) => x.status === "pending").length, 0);
  const totalRisks = sessions.reduce((a, s) => a + s.st.risks, 0);
  const controlsRequired = sessions.reduce((a, s) => a + s.st.guard, 0);

  const statColor = [
    "text-accent-blue",
    avg >= 60 ? "text-accent-orange" : "text-accent-red",
    "text-accent-orange",
    controlsRequired > 0 ? "text-accent-purple" : "text-accent-green",
    pendingSignoffs > 0 ? "text-accent-red" : "text-accent-green",
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-3 pt-6 mb-5 animate-fade-up sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-tx">Release Operations</h1>
          <p className="text-sm text-tx-3 mt-1">Portfolio view of release decisions, controls, sign-offs, and governance state.</p>
        </div>
        <Button variant="primary" size="md" onClick={onNew} className="w-full sm:w-auto">+ New Release Review</Button>
      </div>

      {/* Stats Row */}
      <section className="workspace-section mb-4 grid grid-cols-2 overflow-hidden animate-fade-up-1 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { l: "Reviews", v: sessions.length },
          { l: "Avg Score", v: avg },
          { l: "Total Risks", v: totalRisks },
          { l: "Controls Required", v: controlsRequired },
          { l: "Pending Sign-offs", v: pendingSignoffs },
        ].map((x, i) => (
          <div key={i} className="border-b border-r border-lg-bd p-3 text-center last:border-r-0 sm:[&:nth-child(3n)]:border-r-0 xl:border-b-0 xl:[&:nth-child(3n)]:border-r xl:[&:nth-child(5n)]:border-r-0">
            <div className={`text-2xl font-extrabold ${statColor[i]}`}>{x.v}</div>
            <div className="text-sm text-tx-3 mt-0.5">{x.l}</div>
          </div>
        ))}
      </section>

      {/* Score Trends */}
      {sessions.length > 0 ? (
        <ReadinessTrend sessions={sessions} onOpen={onOpen} />
      ) : (
      <section className="workspace-section mb-4 animate-fade-up-2 p-8 text-center">
        <div className="text-tx-3 text-sm">No release reviews yet. Run the first review to start building an operational record.</div>
        <Button variant="primary" size="sm" onClick={onNew} className="mt-3">+ New Release Review</Button>
      </section>
      )}

      {/* Two Columns */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Recent Reviews */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label>Recent Reviews</Label>
            {sessions.length > 4 && <span className="text-xs font-semibold text-tx-4">{sessions.length - 4} more stored</span>}
          </div>
          <div className="workspace-section overflow-hidden">
            {sessions.slice(0, 4).map((s) => (
              <button key={s.id} type="button" onClick={() => onOpen(s.id)} className="workspace-row w-full bg-transparent p-4 text-left font-sans transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-orange/10 text-accent-orange">{s.icon}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-tx">{s.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-tx-3">
                        <span className="font-mono">{s.date.split(",")[0]}</span>
                        <span>{s.st.risks} risks</span>
                        <span>{s.st.tests} tests</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${scoreTone(s.st.score).border} ${scoreTone(s.st.score).bg} ${scoreTone(s.st.score).text}`}>
                      {s.st.score}/100
                    </span>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-extrabold ${scoreTone(s.st.score).border} ${scoreTone(s.st.score).bg} ${scoreTone(s.st.score).text}`}>
                      {scoreTone(s.st.score).grade}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Governance Status */}
        <div>
          <Label>Governance Status</Label>
          <div className="workspace-section overflow-hidden">
          <div className="workspace-row border-l-[3px] border-l-accent-purple p-3">
            <div className="text-sm font-bold text-tx">Production Release Gate</div>
            <div className="text-sm text-tx-3 mt-1">{sessions.length} sessions analyzed · Configure gates in Settings</div>
          </div>
          <div className={`workspace-row border-l-[3px] p-3 ${driftAlerts > 0 ? "border-l-accent-red" : "border-l-accent-green"}`}>
            <div className="text-sm font-bold text-tx">Drift Monitor</div>
            <div className="text-sm text-tx-3 mt-1">
              {sessions.filter((s) => s.drift?.active).length} active monitors · {driftAlerts} regressions detected
            </div>
            {sessions.filter((s) => s.drift?.scoreDelta < 0).map((s) => (
              <div key={s.id} className="text-sm text-accent-red2 mt-1">⚠ {s.title}: {s.drift.scoreDelta} points</div>
            ))}
          </div>
          <div className={`workspace-row border-l-[3px] p-3 ${pendingSignoffs > 0 ? "border-l-accent-orange" : "border-l-accent-green"}`}>
            <div className="text-sm font-bold text-tx">Pending Sign-offs</div>
            {sessions.filter((s) => s.signoffs.some((x) => x.status === "pending")).slice(0, 3).map((s) => (
              <div key={s.id} className="text-sm text-accent-orange2 mt-1">
                {s.title}: {s.signoffs.filter((x) => x.status === "pending").map((x) => x.role).join(", ")}
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

    </div>
  );
}


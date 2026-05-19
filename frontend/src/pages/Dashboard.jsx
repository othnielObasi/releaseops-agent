/* ReleaseOps Dashboard */

import { Button, Label } from "../components/ui";

function scoreTone(score) {
  if (score >= 80) return { grade: "B", text: "text-accent-green", bg: "bg-accent-green/10", border: "border-accent-green/20" };
  if (score >= 60) return { grade: "C", text: "text-accent-orange", bg: "bg-accent-orange/10", border: "border-accent-orange/20" };
  return { grade: "D", text: "text-accent-red", bg: "bg-accent-red/10", border: "border-accent-red/20" };
}

function uniqueByTitle(sessions) {
  const seen = new Set();
  return sessions.filter((session) => {
    const key = (session.title || "").trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ReleaseSnapshot({ sessions, onOpen }) {
  const workflows = uniqueByTitle(sessions).slice(0, 6);
  const duplicateCount = Math.max(0, sessions.length - uniqueByTitle(sessions).length);
  const ready = workflows.filter((session) => session.st.score >= 80).length;
  const needsControls = workflows.filter((session) => session.st.score >= 60 && session.st.score < 80).length;
  const blocked = workflows.filter((session) => session.st.score < 60).length;

  return (
    <section className="workspace-section mb-4 p-4 animate-fade-up-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Label>Release Readiness Snapshot</Label>
          <p className="text-sm text-tx-3 -mt-1">Latest review for each workflow, grouped by production readiness.</p>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-lg-bd text-center text-xs font-bold">
          <div className="border-r border-lg-bd px-3 py-2"><div className="text-lg text-accent-green">{ready}</div><div className="text-tx-4">ready</div></div>
          <div className="border-r border-lg-bd px-3 py-2"><div className="text-lg text-accent-orange">{needsControls}</div><div className="text-tx-4">needs controls</div></div>
          <div className="px-3 py-2"><div className="text-lg text-accent-red">{blocked}</div><div className="text-tx-4">blocked</div></div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-lg-bd">
        {workflows.map((session) => {
          const tone = scoreTone(session.st.score);
          return (
            <button key={session.id} type="button" onClick={() => onOpen?.(session.id)} className="workspace-row grid w-full grid-cols-[minmax(0,1fr)_84px_120px] items-center gap-3 bg-transparent px-3 py-2 text-left font-sans">
              <span className="truncate text-sm font-bold text-tx">{session.title}</span>
              <span className={`rounded-full border px-2 py-1 text-center text-xs font-extrabold ${tone.border} ${tone.bg} ${tone.text}`}>{session.st.score}/100</span>
              <span className="text-right text-xs font-semibold text-tx-3">{session.st.risks} risks / {session.st.tests} tests</span>
            </button>
          );
        })}
      </div>

      {duplicateCount > 0 && (
        <div className="mt-2 text-xs font-semibold text-tx-4">{duplicateCount} older duplicate review{duplicateCount === 1 ? "" : "s"} hidden from this snapshot.</div>
      )}
    </section>
  );
}

export default function Dashboard({ sessions = [], loading, onNew, onOpen }) {
  const workflows = uniqueByTitle(sessions);
  const scores = sessions.map((s) => s.st.score);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const driftAlerts = workflows.filter((s) => s.drift?.scoreDelta < 0).length;
  const pendingSignoffs = sessions.reduce((a, s) => a + s.signoffs.filter((x) => x.status === "pending").length, 0);
  const totalRisks = sessions.reduce((a, s) => a + s.st.risks, 0);
  const controlsRequired = sessions.reduce((a, s) => a + s.st.guard, 0);
  const workflowsNeedingAction = workflows.filter((s) => s.signoffs.some((x) => x.status === "pending") || s.st.score < 80);

  const statColor = [
    "text-accent-blue",
    avg >= 60 ? "text-accent-orange" : "text-accent-red",
    "text-accent-orange",
    controlsRequired > 0 ? "text-accent-purple" : "text-accent-green",
    pendingSignoffs > 0 ? "text-accent-red" : "text-accent-green",
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-3 pt-6 mb-5 animate-fade-up sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-tx">Release Operations</h1>
          <p className="text-sm text-tx-3 mt-1">Portfolio view of release decisions, controls, sign-offs, and governance state.</p>
        </div>
        <Button variant="primary" size="md" onClick={onNew} className="w-full sm:w-auto">+ New Release Review</Button>
      </div>

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

      {sessions.length > 0 ? (
        <ReleaseSnapshot sessions={sessions} onOpen={onOpen} />
      ) : (
        <section className="workspace-section mb-4 animate-fade-up-2 p-8 text-center">
          <div className="text-tx-3 text-sm">No release reviews yet. Run the first review to start building an operational record.</div>
          <Button variant="primary" size="sm" onClick={onNew} className="mt-3">+ New Release Review</Button>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label>Required Actions</Label>
            <span className="text-xs font-semibold text-tx-4">{workflowsNeedingAction.length} workflow{workflowsNeedingAction.length === 1 ? "" : "s"}</span>
          </div>
          <div className="workspace-section overflow-hidden">
            {workflowsNeedingAction.slice(0, 5).map((s) => {
              const tone = scoreTone(s.st.score);
              const missingRoles = s.signoffs.filter((x) => x.status === "pending").map((x) => x.role);
              return (
                <button key={s.id} type="button" onClick={() => onOpen(s.id)} className="workspace-row w-full bg-transparent p-4 text-left font-sans transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-tx">{s.title}</div>
                      <div className="mt-1 text-sm text-tx-3">{s.st.score < 80 ? "Review controls before production." : "Collect required sign-offs."}</div>
                      <div className="mt-1 text-xs text-tx-4">{missingRoles.length ? `Pending: ${missingRoles.join(", ")}` : `${s.st.guard} controls required`}</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-extrabold ${tone.border} ${tone.bg} ${tone.text}`}>{s.st.score}/100</span>
                  </div>
                </button>
              );
            })}
            {workflowsNeedingAction.length === 0 && (
              <div className="p-4 text-sm text-tx-3">No active workflow actions. New reviews will appear here when they need controls, sign-offs, or follow-up.</div>
            )}
          </div>
        </div>

        <div>
          <Label>Governance Status</Label>
          <div className="workspace-section overflow-hidden">
            <div className="workspace-row border-l-[3px] border-l-accent-purple p-3">
              <div className="text-sm font-bold text-tx">Production Release Gate</div>
              <div className="text-sm text-tx-3 mt-1">{workflows.length} workflows tracked / configure gates in Settings</div>
            </div>
            <div className={`workspace-row border-l-[3px] p-3 ${driftAlerts > 0 ? "border-l-accent-red" : "border-l-accent-green"}`}>
              <div className="text-sm font-bold text-tx">Drift Monitor</div>
              <div className="text-sm text-tx-3 mt-1">{workflows.filter((s) => s.drift?.active).length} active monitors / {driftAlerts} regressions detected</div>
              {workflows.filter((s) => s.drift?.scoreDelta < 0).map((s) => (
                <div key={s.id} className="text-sm text-accent-red2 mt-1">{s.title}: {s.drift.scoreDelta} points</div>
              ))}
            </div>
            <div className={`workspace-row border-l-[3px] p-3 ${pendingSignoffs > 0 ? "border-l-accent-orange" : "border-l-accent-green"}`}>
              <div className="text-sm font-bold text-tx">Pending Sign-offs</div>
              {workflows.filter((s) => s.signoffs.some((x) => x.status === "pending")).slice(0, 3).map((s) => (
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

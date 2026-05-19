/* ReleaseOps v3 — Dashboard Page (Tailwind) */

import { useState } from "react";
import { Badge, Card, Button, Label } from "../components/ui";
import { governance } from "../services/api";

const C = { bl: "#2563eb", or: "#b45309", rd: "#b91c1c", gn: "#047857", sf: "#ffffff", bd: "#d8d0c2", tx3: "#6b7280" };

function scoreTone(score) {
  if (score >= 80) return { grade: "B", text: "text-accent-green", bg: "bg-accent-green/10", border: "border-accent-green/20", fill: C.gn };
  if (score >= 60) return { grade: "C", text: "text-accent-orange", bg: "bg-accent-orange/10", border: "border-accent-orange/20", fill: C.or };
  return { grade: "D", text: "text-accent-red", bg: "bg-accent-red/10", border: "border-accent-red/20", fill: C.rd };
}

function ReadinessTrend({ sessions }) {
  const width = 720;
  const height = 180;
  const padX = 54;
  const padTop = 18;
  const chartH = 112;
  const plotW = width - padX - 20;
  const visible = sessions.slice(0, 8).reverse();
  const points = visible.map((session, i) => {
    const x = padX + (visible.length === 1 ? plotW / 2 : i * (plotW / (visible.length - 1)));
    const y = padTop + (100 - Math.max(0, Math.min(100, session.st.score))) * (chartH / 100);
    return { x, y, session };
  });
  const path = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <Card className="mb-4 animate-fade-up-2">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Label>Readiness Score Trends</Label>
          <p className="text-sm text-tx-3 -mt-1">Last {visible.length} release reviews, scored from blocked to production-ready.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-accent-green/10 px-2.5 py-1 text-accent-green">80+ Ready</span>
          <span className="rounded-full bg-accent-orange/10 px-2.5 py-1 text-accent-orange">60-79 Needs controls</span>
          <span className="rounded-full bg-accent-red/10 px-2.5 py-1 text-accent-red">0-59 Blocked</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Readiness score trend chart">
        {[100, 80, 60, 40].map((score) => {
          const y = padTop + (100 - score) * (chartH / 100);
          return (
            <g key={score}>
              <text x="0" y={y + 4} fill={C.tx3} fontSize="12" fontWeight="700">{score}</text>
              <line x1={padX} y1={y} x2={width - 20} y2={y} stroke={score === 80 ? C.gn : score === 60 ? C.or : C.bd} strokeWidth={score === 80 || score === 60 ? "1.3" : "0.8"} strokeDasharray={score === 80 || score === 60 ? "0" : "5 6"} />
            </g>
          );
        })}
        {points.length > 1 && <polyline points={path} fill="none" stroke={C.bl} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map(({ x, y, session }) => {
          const tone = scoreTone(session.st.score);
          return (
            <g key={session.id}>
              <circle cx={x} cy={y} r="7" fill={tone.fill} stroke={C.sf} strokeWidth="3" />
              <text x={x} y={y - 14} textAnchor="middle" fill={tone.fill} fontSize="12" fontWeight="800">{session.st.score}</text>
            </g>
          );
        })}
        {points.map(({ x, session }) => (
          <text key={`${session.id}-label`} x={x} y={height - 18} textAnchor="middle" fill={C.tx3} fontSize="11" fontWeight="700">
            {session.date.split(",")[0]}
          </text>
        ))}
      </svg>
    </Card>
  );
}

function deriveRunState(session) {
  const run = session.agentRun || {};
  const persistedSteps = Array.isArray(run.steps) ? run.steps : [];
  const persistedBlockers = (Array.isArray(run.blockers) ? run.blockers : []).filter((blocker) => blocker.status !== "resolved");
  const pendingRoles = (session.signoffs || []).filter((x) => x.status === "pending").map((x) => x.role);
  const highRisks = session.sb?.[0] || 0;
  const blockers = persistedBlockers.map((blocker) => blocker.reason || blocker.title).filter(Boolean);

  if (session._status === "error") blockers.push("Run failed. Open the session and inspect the analysis error.");
  if (session._status === "pending" || session._status === "running") blockers.push("Analysis is still running. Evidence is not ready yet.");
  if (!persistedBlockers.length && session.tags?.some((tag) => tag.l === "Needs Detail" || tag.l === "Low Confidence")) blockers.push("Input needs more detail before a confident release decision.");
  if (!persistedBlockers.length && highRisks > 0) blockers.push(`${highRisks} high-risk item${highRisks === 1 ? "" : "s"} must be controlled or accepted.`);
  if (!persistedBlockers.length && (session.st.tests || 0) === 0) blockers.push("No generated test cases yet.");
  if (!persistedBlockers.length && (session.st.guard || 0) === 0) blockers.push("No mapped guardrails yet.");
  if (pendingRoles.length > 0) blockers.push(`Waiting for sign-off: ${pendingRoles.join(", ")}.`);

  const completeEvidence = ["risks", "tests", "guard"].filter((key) => (session.st[key] || 0) > 0).length;
  const runStatus = run.status === "failed" || session._status === "error"
    ? "Failed"
    : run.status === "complete" || session._status === "complete"
      ? blockers.length > 0 ? "Needs action" : "Ready"
      : run.status === "planned" ? "Planned" : "Running";
  const nextAction = blockers[0] || "Package evidence and prepare go-live approval.";
  const fallbackStages = [
    { label: "Intake", done: Boolean(session.title && session.desc) },
    { label: "Risk model", done: (session.st.risks || 0) > 0 },
    { label: "Validation", done: (session.st.tests || 0) > 0 && (session.st.guard || 0) > 0 },
    { label: "Approval", done: pendingRoles.length === 0 },
  ];
  const stages = persistedSteps.length
    ? persistedSteps.map((step) => ({
      label: step.name || step.step_key,
      done: step.status === "complete",
      status: step.status,
    }))
    : fallbackStages;

  return {
    runStatus,
    blockers,
    persistedBlockers,
    nextAction,
    evidence: {
      risks: session.st.risks || 0,
      tests: session.st.tests || 0,
      guardrails: session.st.guard || 0,
      completeness: Math.round((completeEvidence / 3) * 100),
    },
    stages,
  };
}

export default function Dashboard({ sessions = [], loading, onNew, onOpen, onRefresh }) {
  const [updatingBlocker, setUpdatingBlocker] = useState(null);
  const [actionMsg, setActionMsg] = useState("");
  const scores = sessions.map((s) => s.st.score);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const driftAlerts = sessions.filter((s) => s.drift?.scoreDelta < 0).length;
  const pendingSignoffs = sessions.reduce((a, s) => a + s.signoffs.filter((x) => x.status === "pending").length, 0);
  const operationalRuns = sessions.slice(0, 3).map((session) => ({ session, state: deriveRunState(session) }));
  const activeBlockers = operationalRuns
    .flatMap(({ session, state }) => (
      state.persistedBlockers.length
        ? state.persistedBlockers.map((blocker) => ({ session, blocker, text: blocker.reason || blocker.title }))
        : state.blockers.map((text, index) => ({ session, blocker: null, text, index }))
    ))
    .slice(0, 5);

  async function updateBlocker(session, blocker, status) {
    if (!blocker?.id) {
      onOpen(session.id);
      return;
    }
    setUpdatingBlocker(blocker.id);
    setActionMsg("");
    try {
      await governance.updateBlocker(session.id, blocker.id, { status });
      setActionMsg(status === "resolved" ? "Blocker resolved. Release decision updated." : "Risk accepted. Release decision updated.");
      await onRefresh?.();
    } catch (err) {
      setActionMsg(err.message || "Could not update blocker.");
    } finally {
      setUpdatingBlocker(null);
    }
  }

  const statColor = [
    "text-accent-blue",
    avg >= 60 ? "text-accent-orange" : "text-accent-red",
    "text-accent-orange",
    pendingSignoffs > 0 ? "text-accent-red" : "text-accent-green",
    driftAlerts > 0 ? "text-accent-red" : "text-accent-green",
    "text-accent-purple",
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-3 pt-6 mb-5 animate-fade-up sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-tx">Dashboard</h1>
          <p className="text-sm text-tx-3 mt-1">Autonomous AI release review, evidence, blockers, and go-live governance.</p>
        </div>
        <Button variant="primary" size="md" onClick={onNew} className="w-full sm:w-auto">+ New Readiness Check</Button>
      </div>

      <Card className="mb-4 animate-fade-up">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-accent-purple">Judge briefing</div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-tx">ReleaseOps Agent decides whether an AI feature is ready to ship.</h2>
            <p className="mt-2 text-sm leading-6 text-tx-2">
              The system turns a feature description into a persisted agent run: it plans the review, identifies risks,
              generates tests and guardrails, packages evidence, and blocks production until owners resolve or accept
              release blockers.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={onNew}>Run live review</Button>
            {sessions[0] && <Button variant="ghost" size="sm" onClick={() => onOpen(sessions[0].id)}>Open latest evidence</Button>}
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {[
            ["1. Intake", "Feature title and release context enter the backend."],
            ["2. Reason", "Agent models risks, tests, guardrails, and regulatory impact."],
            ["3. Govern", "Open blockers prevent a GO decision until handled."],
            ["4. Prove", "Audit trail, evidence pack, certificate, and run history persist."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-lg-bd bg-lg-sf2 p-3">
              <div className="text-sm font-extrabold text-tx">{title}</div>
              <div className="mt-1 text-xs leading-5 text-tx-3">{body}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {[
            ["Enterprise value", "Stops unsafe AI releases before production and creates auditor-ready evidence."],
            ["Agentic workflow", "Multi-step execution state is stored, inspectable, and tied to release decisions."],
            ["Vultr deployment", "Frontend, API, and Postgres run as the production system of record on Vultr."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg bg-accent-purple/5 px-3 py-2">
              <div className="text-xs font-bold text-accent-purple">{title}</div>
              <div className="mt-1 text-xs leading-5 text-tx-2">{body}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-lg-bd bg-lg-sf2 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-tx">Production-grade proof</div>
            <Badge color="gn" size="xs">Beyond hackathon demo</Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-5">
            {[
              ["Tenant isolation", "Auth-scoped sessions prevent tenant leakage."],
              ["Persistent runs", "Agent steps, blockers, and events are stored."],
              ["Governance gates", "Open blockers block GO decisions."],
              ["Audit trail", "Resolution, acceptance, and decisions are logged."],
              ["Deployable stack", "Vultr VM, API, Postgres, Nginx, Docker Compose."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg bg-white px-3 py-2 shadow-sm shadow-stone-200/60">
                <div className="text-xs font-bold text-tx">{title}</div>
                <div className="mt-1 text-[11px] leading-5 text-tx-3">{body}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {actionMsg && (
        <div className="mb-3 rounded-md border border-lg-bd bg-lg-sf2 px-3 py-2 text-sm text-tx-2">
          {actionMsg}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-2.5 mb-4 animate-fade-up-1 sm:grid-cols-3 xl:grid-cols-6">
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
        <ReadinessTrend sessions={sessions} />
      ) : (
      <Card className="mb-4 animate-fade-up-2 text-center !py-8">
        <div className="text-tx-3 text-sm">No sessions yet. Run your first readiness check to see trends.</div>
        <Button variant="primary" size="sm" onClick={onNew} className="mt-3">+ New Readiness Check</Button>
      </Card>
      )}

      {/* Two Columns */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Recent Sessions */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label>Recent Sessions</Label>
            {sessions.length > 4 && <span className="text-xs font-semibold text-tx-4">{sessions.length - 4} more stored</span>}
          </div>
          <div className="space-y-2">
            {sessions.slice(0, 4).map((s) => (
              <Card key={s.id} onClick={() => onOpen(s.id)} className="!p-4">
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
              </Card>
            ))}
          </div>
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

      {/* Operational Queue */}
      <div className="grid grid-cols-1 gap-4 mt-4 animate-fade-up-3 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <Label>Production Workbench</Label>
              <p className="text-sm text-tx-3 -mt-1">Resolve blockers, track approvals, and move releases toward a GO decision.</p>
            </div>
            <Badge color={operationalRuns.some((x) => x.state.blockers.length) ? "or" : "gn"} size="xs">
              {activeBlockers.length} active blocker{activeBlockers.length === 1 ? "" : "s"}
            </Badge>
          </div>
          {operationalRuns.length > 0 ? (
            <div className="space-y-2">
              {operationalRuns.map(({ session, state }) => (
                <div key={session.id} className="rounded-lg border border-lg-bd bg-lg-sf2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-tx">{session.title}</div>
                      <div className="mt-1 text-xs leading-5 text-tx-3">{state.nextAction}</div>
                    </div>
                    <Badge color={state.runStatus === "Ready" ? "gn" : state.runStatus === "Failed" ? "rd" : state.runStatus === "Running" ? "bl" : "or"} size="xs">
                      {state.runStatus}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {state.stages.map((stage) => (
                      <div key={stage.label} className={`rounded-md border px-2 py-1.5 text-center text-[10px] font-bold ${stage.done ? "border-accent-green/20 bg-accent-green/10 text-accent-green2" : "border-lg-bd bg-lg-sf3 text-tx-4"}`}>
                        {stage.label}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge color="bl" size="xs">{state.evidence.risks} risks</Badge>
                    <Badge color="pr" size="xs">{state.evidence.tests} tests</Badge>
                    <Badge color="tl" size="xs">{state.evidence.guardrails} guardrails</Badge>
                    <Badge color={state.evidence.completeness === 100 ? "gn" : "or"} size="xs">{state.evidence.completeness}% evidence</Badge>
                    <Button variant="ghost" size="xs" onClick={() => onOpen(session.id)} className="ml-auto">Review</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-lg-bd bg-lg-sf2 p-4 text-sm text-tx-3">
              No runs yet. Create a release check to generate an operations queue.
            </div>
          )}
        </Card>

        <Card>
          <Label>Next Actions</Label>
          {activeBlockers.length > 0 ? (
            <div className="space-y-2">
              {activeBlockers.map(({ session, blocker, text, index }) => (
                <div key={`${session.id}-${blocker?.id || index}`} className="rounded-lg border border-accent-orange/20 bg-accent-orange/5 p-2.5 text-xs leading-5 text-tx-2">
                  <button type="button" onClick={() => onOpen(session.id)} className="w-full bg-transparent border-none p-0 text-left font-sans">
                    <span className="block font-bold text-accent-orange2">{session.title}</span>
                    <span className="block text-tx-2">{blocker?.title || text}</span>
                    {blocker?.title && <span className="block text-tx-3">{text}</span>}
                  </button>
                  {blocker?.id ? (
                    <div className="mt-2 flex gap-1.5">
                      <Button variant="success" size="xs" disabled={updatingBlocker === blocker.id} onClick={() => updateBlocker(session, blocker, "resolved")}>
                        Resolve
                      </Button>
                      <Button variant="ghost" size="xs" disabled={updatingBlocker === blocker.id} onClick={() => updateBlocker(session, blocker, "accepted")}>
                        Accept risk
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="xs" onClick={() => onOpen(session.id)} className="mt-2">Review</Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-accent-green/20 bg-accent-green/5 p-3 text-sm leading-6 text-tx-2">
              No active blockers in the latest runs. Evidence packages are ready for review.
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["Stored runs", sessions.length],
              ["Evidence items", sessions.reduce((total, s) => total + s.st.risks + s.st.tests + s.st.guard, 0)],
              ["Approvals left", pendingSignoffs],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-lg-sf2 p-2.5 text-center">
                <div className="text-lg font-extrabold text-tx">{value}</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-tx-4">{label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

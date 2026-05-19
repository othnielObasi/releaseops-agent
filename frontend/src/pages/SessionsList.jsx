/* ReleaseOps Reviews Register */

import { useMemo, useState } from "react";
import { Badge, Button } from "../components/ui";

function scoreTone(score) {
  if (score >= 80) return { label: "Ready", color: "gn", text: "text-accent-green", bg: "bg-accent-green/10", border: "border-accent-green/20" };
  if (score >= 60) return { label: "Needs controls", color: "or", text: "text-accent-orange", bg: "bg-accent-orange/10", border: "border-accent-orange/20" };
  return { label: "Blocked", color: "rd", text: "text-accent-red", bg: "bg-accent-red/10", border: "border-accent-red/20" };
}

function groupLatestByTitle(sessions) {
  const groups = new Map();
  sessions.forEach((session) => {
    const key = (session.title || "").trim().toLowerCase();
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { latest: session, count: 1 });
      return;
    }
    groups.set(key, { latest: current.latest, count: current.count + 1 });
  });
  return [...groups.values()].map((group) => ({ ...group.latest, versionCount: group.count }));
}

export default function SessionsList({ sessions = [], loading, onOpen, onNew, onCompare }) {
  const [filter, setFilter] = useState("all");
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState([]);

  const filteredSessions = filter === "all" ? sessions : sessions.filter((s) => s.type === filter);
  const rows = useMemo(() => groupLatestByTitle(filteredSessions), [filteredSessions]);
  const hiddenDuplicates = Math.max(0, filteredSessions.length - rows.length);

  const toggleSelect = (id) => {
    if (selected.includes(id)) setSelected(selected.filter((x) => x !== id));
    else if (selected.length < 2) setSelected([...selected, id]);
  };

  const openRow = (id) => {
    if (compareMode) toggleSelect(id);
    else onOpen(id);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 pt-6 mb-5 animate-fade-up lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-tx">Release Reviews</h1>
          <p className="text-sm text-tx-3 mt-1">
            {rows.length} workflow{rows.length === 1 ? "" : "s"} tracked from {filteredSessions.length} review{filteredSessions.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {compareMode && selected.length === 2 && (
            <Button variant="primary" size="sm" onClick={() => { onCompare(selected[0], selected[1]); setCompareMode(false); setSelected([]); }}>Compare selected</Button>
          )}
          <Button variant={compareMode ? "danger" : "default"} size="sm" onClick={() => { setCompareMode(!compareMode); setSelected([]); }}>
            {compareMode ? "Cancel compare" : "Compare reviews"}
          </Button>
          <Button variant="primary" size="sm" onClick={onNew}>+ New Release Review</Button>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-3 animate-fade-up-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          {[{ k: "all", l: "All" }, { k: "live", l: "Live" }, { k: "demo", l: "Samples" }].map((f) => (
            <Button key={f.k} variant={filter === f.k ? "primary" : "ghost"} size="xs" onClick={() => setFilter(f.k)}>{f.l}</Button>
          ))}
        </div>
        {hiddenDuplicates > 0 && (
          <div className="text-xs font-semibold text-tx-4">{hiddenDuplicates} older duplicate review{hiddenDuplicates === 1 ? "" : "s"} grouped by workflow.</div>
        )}
      </div>

      <div className="workspace-section overflow-x-auto animate-fade-up-2">
        <div className={`grid min-w-[860px] ${compareMode ? "grid-cols-[38px_minmax(260px,1.5fr)_110px_90px_90px_105px_100px]" : "grid-cols-[minmax(260px,1.5fr)_110px_90px_90px_105px_100px]"} items-center border-b border-lg-bd bg-lg-sf2 px-4 py-2`}>
          {compareMode && <div />}
          {["Workflow", "Decision", "Score", "Evidence", "Last review", "Source"].map((h) => (
            <div key={h} className="text-xs font-bold text-tx-3 tracking-wide uppercase">{h}</div>
          ))}
        </div>

        {rows.map((s, i) => {
          const tone = scoreTone(s.st.score);
          const selectedRow = selected.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => openRow(s.id)}
              className={`grid min-w-[860px] w-full ${compareMode ? "grid-cols-[38px_minmax(260px,1.5fr)_110px_90px_90px_105px_100px]" : "grid-cols-[minmax(260px,1.5fr)_110px_90px_90px_105px_100px]"} items-center gap-0 px-4 py-3 text-left font-sans transition-colors hover:bg-lg-sf2 ${selectedRow ? "bg-accent-purple/8" : "bg-transparent"} ${i < rows.length - 1 ? "border-b border-lg-bd" : ""}`}
            >
              {compareMode && (
                <div>
                  <div className={`h-4 w-4 rounded-sm border ${selectedRow ? "border-accent-purple bg-accent-purple" : "border-lg-bd2 bg-transparent"}`} />
                </div>
              )}
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-extrabold text-tx">{s.title}</span>
                  {s.versionCount > 1 && <Badge color="bl" size="xs">{s.versionCount} versions</Badge>}
                </div>
                <div className="mt-1 truncate text-xs text-tx-3">{s.desc || "No description provided."}</div>
              </div>
              <div><Badge color={tone.color} size="xs">{tone.label}</Badge></div>
              <div className={`text-sm font-extrabold ${tone.text}`}>{s.st.score}/100</div>
              <div className="text-xs font-semibold text-tx-3">{s.st.risks} risks / {s.st.guard} controls</div>
              <div className="text-xs text-tx-3 font-mono">{s.date.split(",")[0]}</div>
              <div><Badge color={s.type === "demo" ? "or" : "bl"} size="xs">{s.type === "demo" ? "sample" : s.type}</Badge></div>
            </button>
          );
        })}

        {!loading && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-tx-3">No release reviews match this filter.</div>
        )}
      </div>
    </div>
  );
}

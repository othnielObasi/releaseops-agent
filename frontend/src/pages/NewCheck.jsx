/* ReleaseOps v3 - New Release Review Modal (Tailwind) */

import { useState, useRef, useCallback } from "react";
import { Button } from "../components/ui";
import Pipeline from "../components/Pipeline";
import { sessions as sessionsAPI } from "../services/api";

export default function NewCheck({ onClose, onComplete }) {
  const sampleScenario = {
    title: "AI customer support refund assistant",
    desc: "A customer support AI agent can inspect customer profile data, review transaction history, classify complaints, recommend refunds, draft customer responses, and escalate high-risk cases. Refunds above 50 GBP require human approval, PII access must be logged, account closure is blocked, vulnerable customer complaints escalate to a human, and customer-facing replies pass moderation.",
  };
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(-1);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const run = async () => {
    if (!title.trim() || !desc.trim()) {
      setError("Add a feature title and description before running the release review.");
      return;
    }

    setRunning(true);
    setError("");
    setPhase(0);

    try {
      const { session_id } = await sessionsAPI.create({
        feature_title: title.trim(),
        feature_description: desc.trim(),
      });

      pollRef.current = setInterval(async () => {
        try {
          const data = await sessionsAPI.get(session_id);
          const status = data.session?.status || data.status;
          const nav = data.navigator || data.navigator;
          const sen = data.sentinel || data.sentinel;
          const her = data.herald || data.herald;

          if (her && Object.keys(her).length > 0) {
            setPhase(3);
            stopPolling();
            setRunning(false);
            setTimeout(() => onComplete(session_id), 600);
          } else if (sen && Object.keys(sen).length > 0) {
            setPhase(2);
          } else if (nav && Object.keys(nav).length > 0) {
            setPhase(1);
          }

          if (status === "error") {
            stopPolling();
            setError(data.error || "Pipeline failed. Please try again.");
            setRunning(false);
          }
        } catch {
          // Ignore transient poll errors.
        }
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to create session");
      setRunning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={!running ? () => { stopPolling(); onClose(); } : undefined}
    >
      <div onClick={(e) => e.stopPropagation()} className="glass-strong max-h-[90vh] w-[520px] overflow-auto rounded-xl p-6 animate-fade-up">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-bold text-tx">New Release Review</div>
          {!running && (
            <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-lg text-tx-3 transition-colors hover:text-tx">
              x
            </button>
          )}
        </div>

        {running && <Pipeline phase={phase} showLogs={true} />}

        {error && (
          <div className="mb-3 rounded-lg border border-accent-red/25 bg-accent-red/10 px-3 py-2 text-sm text-accent-red2">{error}</div>
        )}

        {!running && (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-tx-3">Industry preset</label>
              <select className="input-glass">
                <option>No preset</option>
                <option>Finance / Fintech</option>
                <option>HealthTech</option>
                <option>LegalTech</option>
                <option>B2B SaaS</option>
              </select>
            </div>

            <button
              type="button"
              className="mb-3 rounded-md border border-lg-bd bg-lg-sf2 px-3 py-2 text-xs font-semibold text-tx-2 transition-colors hover:border-lg-bd2 hover:text-tx"
              onClick={() => {
                setTitle(sampleScenario.title);
                setDesc(sampleScenario.desc);
                setError("");
              }}
            >
              Use sample fintech scenario
            </button>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-tx-3">Feature title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. AI customer support refund assistant"
                className="input-glass"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-tx-3">Description</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What AI workflow is being released? What data and actions can it access?"
                className="input-glass min-h-[80px] resize-y leading-relaxed"
              />
            </div>

            <div className="mb-3.5">
              <label className="mb-1 block text-xs font-semibold text-tx-3">Release type</label>
              <select className="input-glass">
                <option>Production</option>
                <option>MVP</option>
                <option>Feature Update</option>
                <option>Major Release</option>
              </select>
            </div>
          </>
        )}

        <Button variant="cta" size="lg" onClick={run} disabled={running} className="w-full">
          {running ? `Processing... ${["Release Analysis", "Validation Planning", "Decision Packaging", "Done"][Math.min(phase, 3)]}` : "Run Release Review"}
        </Button>
      </div>
    </div>
  );
}

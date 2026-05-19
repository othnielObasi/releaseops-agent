/* ReleaseOps v3 — New Release Review Modal (Tailwind) */

import { useState, useRef, useCallback } from "react";
import { Button } from "../components/ui";
import Pipeline from "../components/Pipeline";
import { sessions as sessionsAPI } from "../services/api";

export default function NewCheck({ onClose, onComplete }) {
  const [title, setTitle] = useState("AI customer support refund assistant");
  const [desc, setDesc] = useState("A customer support AI agent can inspect customer profile data, review transaction history, classify complaints, recommend refunds, draft customer responses, and escalate high-risk cases. Refunds above 50 GBP require human approval, PII access must be logged, account closure is blocked, vulnerable customer complaints escalate to a human, and customer-facing replies pass moderation.");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(-1);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const run = async () => {
    if (!title.trim() && !desc.trim()) return;
    setRunning(true);
    setError("");
    setPhase(0);

    try {
      const { session_id } = await sessionsAPI.create({
        feature_title: title.trim(),
        feature_description: desc.trim(),
      });

      // Poll for pipeline completion
      pollRef.current = setInterval(async () => {
        try {
          const data = await sessionsAPI.get(session_id);
          const status = data.session?.status || data.status;
          const nav = data.navigator || data.navigator;
          const sen = data.sentinel || data.sentinel;
          const her = data.herald || data.herald;

          // Determine phase from populated agent outputs
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
          // Ignore transient poll errors
        }
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to create session");
      setRunning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center"
      onClick={!running ? () => { stopPolling(); onClose(); } : undefined}
    >
      <div onClick={(e) => e.stopPropagation()} className="glass-strong rounded-xl p-6 w-[520px] max-h-[90vh] overflow-auto animate-fade-up">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-base font-bold text-tx">New Release Review</div>
          {!running && <button onClick={onClose} className="bg-transparent border-none text-tx-3 text-lg cursor-pointer hover:text-tx transition-colors">×</button>}
        </div>

        {running && <Pipeline phase={phase} showLogs={true} />}

        {error && (
          <div className="bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2 mb-3 text-sm text-accent-red2">{error}</div>
        )}

        {!running && (
          <>
            {/* Industry Preset */}
            <div className="mb-3">
              <label className="text-xs text-tx-3 font-semibold block mb-1">Industry preset</label>
              <select className="input-glass">
                <option>Finance / Fintech</option>
                <option>— No preset —</option>
                <option>HealthTech</option>
                <option>LegalTech</option>
                <option>B2B SaaS</option>
              </select>
            </div>

            {/* Feature Title */}
            <div className="mb-3">
              <label className="text-xs text-tx-3 font-semibold block mb-1">Feature title</label>
              <input
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. AI customer support refund assistant"
                className="input-glass"
              />
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="text-xs text-tx-3 font-semibold block mb-1">Description</label>
              <textarea
                value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="What AI workflow is being released? What data and actions can it access?"
                className="input-glass min-h-[80px] leading-relaxed resize-y"
              />
            </div>

            {/* Release Type */}
            <div className="mb-3.5">
              <label className="text-xs text-tx-3 font-semibold block mb-1">Release type</label>
              <select className="input-glass">
                <option>Production</option>
                <option>MVP</option>
                <option>Feature Update</option>
                <option>Major Release</option>
              </select>
            </div>
          </>
        )}

        {/* Run Button */}
        <Button variant="cta" size="lg" onClick={run} disabled={running} className="w-full">
          {running ? `Processing... ${["Release Analysis", "Validation Planning", "Decision Packaging", "Done"][Math.min(phase, 3)]}` : "Run Release Review"}
        </Button>
      </div>
    </div>
  );
}

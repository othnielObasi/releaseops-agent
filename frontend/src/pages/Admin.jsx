/* LaunchGuard v3 — Admin Page (Tailwind) */

import { useState, useEffect } from "react";
import { Badge, Card, Button, Label } from "../components/ui";
import { admin as adminAPI } from "../services/api";

export default function Admin() {
  const [tab, setTab] = useState("history");
  const [stats, setStats] = useState({ total_users: 0, total_sessions: 0, logins_today: 0, failed_today: 0 });
  const [users, setUsers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminAPI.stats().catch(() => ({})),
      adminAPI.users().catch(() => ({ users: [] })),
      adminAPI.auditLog(0).catch(() => ({ events: [], total: 0 })),
    ]).then(([s, u, a]) => {
      setStats({ total_users: s.total_users || 0, total_sessions: s.total_sessions || 0, logins_today: s.logins_today || 0, failed_today: s.failed_today || 0 });
      setUsers(u.users || []);
      setAuditLog(a.events || []);
      setAuditTotal(a.total || 0);
      setLoading(false);
    });
  }, []);

  const loadAuditPage = (page) => {
    adminAPI.auditLog(page).then((a) => {
      setAuditLog(a.events || []);
      setAuditTotal(a.total || 0);
      setAuditPage(page);
    }).catch(() => {});
  };

  const total = auditLog.length;
  const failed = auditLog.filter((l) => !l.success).length;

  return (
    <div className="max-w-[1060px] mx-auto pt-6">
      <h1 className="text-2xl font-extrabold text-tx mb-5 animate-fade-up">Developer Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 animate-fade-up-1">
        {[
          { l: "TOTAL USERS", v: stats.total_users, s: "registered accounts" },
          { l: "TOTAL SESSIONS", v: stats.total_sessions, s: "analyses run" },
          { l: "LOGINS TODAY", v: stats.logins_today, s: "successful" },
          { l: "FAILED TODAY", v: stats.failed_today, s: "failed attempts", c: "text-accent-red" },
        ].map((x, i) => (
          <Card key={i} className="!p-4">
            <div className="text-xs font-semibold text-tx-4 tracking-widest">{x.l}</div>
            <div className={`text-3xl font-extrabold ${x.c || "text-tx"}`}>{x.v}</div>
            <div className="text-xs text-tx-4 mt-0.5">{x.s}</div>
          </Card>
        ))}
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 mb-3.5 animate-fade-up-2">
        {[{ k: "users", l: "👥 Users" }, { k: "history", l: "📋 Login History" }, { k: "regulations", l: "🏛 Regulation Updates" }].map((t) => (
          <Button key={t.k} variant={tab === t.k ? "primary" : "ghost"} size="xs" onClick={() => setTab(t.k)}>{t.l}</Button>
        ))}
      </div>

      {/* Login History */}
      {tab === "history" && (
        <Card className="!p-0 overflow-hidden animate-fade-up-3">
          <div className="flex justify-between px-4 py-3 border-b border-lg-bd">
            <span className="text-sm font-bold text-tx">Login History</span>
            <span className="text-sm text-tx-3">{auditTotal} events</span>
          </div>
          <div className="grid grid-cols-[100px_1fr_70px_110px_90px] px-4 py-1.5 bg-lg-sf2 border-b border-lg-bd">
            {["TIME", "EMAIL", "STATUS", "REASON", "IP"].map((h) => (
              <div key={h} className="text-xs font-bold text-tx-4">{h}</div>
            ))}
          </div>
          <div className="max-h-[400px] overflow-auto">
            {auditLog.map((r, i) => (
              <div key={i} className="grid grid-cols-[100px_1fr_70px_110px_90px] px-4 py-2 border-b border-lg-bd">
                <div className="text-sm text-tx-2 font-mono">{(r.timestamp || "").slice(11, 19)}</div>
                <div className="text-sm text-tx">{r.email}</div>
                <div><Badge color={r.success ? "gn" : "rd"} size="xs">{r.success ? "✓" : "✕"}</Badge></div>
                <div className="text-sm text-tx-2">{r.reason}</div>
                <div className="text-xs text-tx-3 font-mono">{r.ip}</div>
              </div>
            ))}
            {auditLog.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-tx-3">No login events recorded yet.</div>
            )}
          </div>
          <div className="flex justify-between px-4 py-2 border-t border-lg-bd">
            <Button variant="ghost" size="xs" onClick={() => auditPage > 0 && loadAuditPage(auditPage - 1)} disabled={auditPage <= 0}>← Prev</Button>
            <span className="text-sm text-tx-3">Page {auditPage + 1} of {Math.max(1, Math.ceil(auditTotal / 50))}</span>
            <Button variant="ghost" size="xs" onClick={() => loadAuditPage(auditPage + 1)} disabled={(auditPage + 1) >= Math.ceil(auditTotal / 50)}>Next →</Button>
          </div>
        </Card>
      )}

      {/* Users */}
      {tab === "users" && (
        <Card className="animate-fade-up-3">
          <Label>Registered Users</Label>
          {users.map((u, i) => (
            <div key={i} className={`flex justify-between py-2 ${i < users.length - 1 ? "border-b border-lg-bd" : ""}`}>
              <div>
                <span className="text-xs text-tx">{u.email}</span>
                {u.name && <span className="text-xs text-tx-3 ml-2">({u.name})</span>}
              </div>
              <span className="text-sm text-tx-3 font-mono">{u.role || "user"}</span>
              <span className="text-xs text-accent-blue2 font-semibold">{u.session_count || 0} sessions</span>
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-sm text-tx-3 py-4 text-center">No users found.</div>
          )}
        </Card>
      )}

      {/* Regulations */}
      {tab === "regulations" && (
        <Card className="animate-fade-up-3">
          <Label>Regulation Frameworks</Label>
          <div className="space-y-1.5">
            {[
              { name: "EU AI Act", version: "2024", jurisdiction: "EU", reqs: 85 },
              { name: "OWASP Top 10 LLM", version: "1.1", jurisdiction: "Global", reqs: 10 },
              { name: "NIST AI RMF", version: "1.0", jurisdiction: "US", reqs: 72 },
              { name: "ISO 42001", version: "2023", jurisdiction: "Global", reqs: 39 },
              { name: "GDPR AI Provisions", version: "2016/679", jurisdiction: "EU", reqs: 24 },
              { name: "SOC 2 AI Controls", version: "2024", jurisdiction: "US", reqs: 18 },
              { name: "Canada AIDA", version: "Draft", jurisdiction: "Canada", reqs: 30 },
            ].map((f, i) => (
              <div key={i} className="p-2.5 bg-lg-sf2 rounded-lg flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-tx">{f.name} <span className="font-normal text-tx-3">({f.version})</span></div>
                  <div className="text-xs text-tx-4 mt-0.5">{f.jurisdiction} · {f.reqs} requirements</div>
                </div>
                <Badge color="gn" size="xs">Active</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

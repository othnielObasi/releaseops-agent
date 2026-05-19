/* ReleaseOps v3 — Settings Page (Tailwind) — wired to real API */

import { useState, useEffect } from "react";
import { Badge, Card, Button } from "../components/ui";
import { teams as teamsAPI, keys as keysAPI, gates as gatesAPI, integrationSettings as integrationsAPI } from "../services/api";

const EMPTY_INTEGRATIONS = {
  slack_webhook: "",
  jira_url: "",
  jira_token: "",
  jira_project: "",
  github_token: "",
  github_repo: "",
  github_pr: "",
  linear_token: "",
  linear_team_id: "",
  webhook_url: "",
  webhook_secret: "",
};

/* ── IntegrationCard — expandable per-provider card ── */
function IntegrationCard({ icon, title, subtitle, description, fields, values, onChange }) {
  const [open, setOpen] = useState(false);
  const configured = fields.some((f) => values[f.key] && String(values[f.key]).trim() !== "");
  return (
    <div className="p-3 bg-lg-sf2 rounded-lg border border-lg-bd mb-2">
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div>
            <span className="text-sm font-bold text-tx">{title}</span>
            <span className="text-xs text-tx-4 ml-2">{subtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {configured && <Badge color="gn" size="xs">CONFIGURED</Badge>}
          <button className="text-xs text-accent-purple2 bg-transparent border-none font-sans cursor-pointer hover:underline">
            {open ? "Close" : "Configure"}
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-2.5 pt-2 border-t border-lg-bd">
          <div className="text-xs text-tx-4 mb-2">{description}</div>
          <div className="grid grid-cols-1 gap-1.5">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs text-tx-3 mb-0.5 block">{f.label}</label>
                <input
                  type={f.type || "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="input-glass text-sm w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [tab, setTab] = useState("teams");

  /* ── Teams state ── */
  const [teamsList, setTeamsList] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");

  /* ── API Keys state ── */
  const [keysList, setKeysList] = useState([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);

  /* ── Integration defaults state ── */
  const [integrationDefaults, setIntegrationDefaults] = useState(EMPTY_INTEGRATIONS);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [integrationsSaving, setIntegrationsSaving] = useState(false);
  const [integrationsMsg, setIntegrationsMsg] = useState("");

  /* ── Gates state ── */
  const [gatesList, setGatesList] = useState([]);
  const [gatesLoading, setGatesLoading] = useState(true);
  const [showGateForm, setShowGateForm] = useState(false);
  const [gateForm, setGateForm] = useState({ name: "", gate_type: "ci_cd", min_score: 65, required_sign_offs: "PM,Legal,QA", required_frameworks: "EU AI Act,OWASP,NIST AI RMF,ISO 42001,GDPR,SOC 2,HIPAA" });

  /* ── Fetch helpers ── */
  const loadTeams = () => { setTeamsLoading(true); teamsAPI.list().then(setTeamsList).catch(() => setTeamsList([])).finally(() => setTeamsLoading(false)); };
  const loadKeys = () => { setKeysLoading(true); keysAPI.list().then(setKeysList).catch(() => setKeysList([])).finally(() => setKeysLoading(false)); };
  const loadGates = () => { setGatesLoading(true); gatesAPI.list().then((r) => setGatesList(r.gates || [])).catch(() => setGatesList([])).finally(() => setGatesLoading(false)); };
  const loadIntegrations = () => {
    setIntegrationsLoading(true);
    integrationsAPI.get()
      .then((r) => setIntegrationDefaults({ ...EMPTY_INTEGRATIONS, ...(r.integrations || {}) }))
      .catch(() => setIntegrationDefaults(EMPTY_INTEGRATIONS))
      .finally(() => setIntegrationsLoading(false));
  };

  useEffect(() => { loadTeams(); loadKeys(); loadGates(); loadIntegrations(); }, []);

  /* ── Teams actions ── */
  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    await teamsAPI.create(newTeamName.trim());
    setNewTeamName("");
    loadTeams();
  };

  const toggleMembers = async (teamId) => {
    if (expandedTeam === teamId) { setExpandedTeam(null); return; }
    setExpandedTeam(teamId);
    try { setMembers(await teamsAPI.members(teamId)); } catch { setMembers([]); }
  };

  const inviteMember = async (teamId) => {
    if (!inviteEmail.trim()) return;
    setInviteMsg("");
    try {
      await teamsAPI.invite(teamId, inviteEmail.trim());
      setInviteMsg("Invited!");
      setInviteEmail("");
      setMembers(await teamsAPI.members(teamId));
    } catch (e) { setInviteMsg(e.message); }
  };

  const removeMember = async (teamId, email) => {
    await teamsAPI.removeMember(teamId, email);
    setMembers(await teamsAPI.members(teamId));
  };

  /* ── API Key actions ── */
  const createKey = async () => {
    if (!newKeyName.trim()) return;
    const res = await keysAPI.create(newKeyName.trim());
    setCreatedKey(res.key);
    setNewKeyName("");
    loadKeys();
  };

  const revokeKey = async (id) => {
    await keysAPI.revoke(id);
    loadKeys();
  };

  /* ── Integration actions ── */
  const updateIntegrationDefault = (field, value) => {
    setIntegrationDefaults((current) => ({ ...current, [field]: value }));
  };

  const saveIntegrationDefaults = async () => {
    const payload = { ...integrationDefaults };
    payload.github_pr = payload.github_pr === "" ? null : Number(payload.github_pr);
    if (Number.isNaN(payload.github_pr)) {
      payload.github_pr = null;
    }
    setIntegrationsSaving(true);
    setIntegrationsMsg("");
    try {
      const res = await integrationsAPI.save(payload);
      setIntegrationDefaults({ ...EMPTY_INTEGRATIONS, ...(res.integrations || {}) });
      setIntegrationsMsg("Default integrations saved. New sessions will inherit these values.");
    } catch (e) {
      setIntegrationsMsg(e.message || "Failed to save integration defaults.");
    } finally {
      setIntegrationsSaving(false);
    }
  };

  /* ── Gate actions ── */
  const createGate = async () => {
    if (!gateForm.name.trim()) return;
    await gatesAPI.create({
      name: gateForm.name.trim(),
      gate_type: gateForm.gate_type,
      min_score: Number(gateForm.min_score),
      required_sign_offs: gateForm.required_sign_offs.split(",").map((s) => s.trim()).filter(Boolean),
      required_frameworks: gateForm.required_frameworks.split(",").map((s) => s.trim()).filter(Boolean),
    });
    setShowGateForm(false);
    setGateForm({ name: "", gate_type: "ci_cd", min_score: 65, required_sign_offs: "PM,Legal,QA", required_frameworks: "EU AI Act,OWASP,NIST AI RMF,ISO 42001,GDPR,SOC 2,HIPAA" });
    loadGates();
  };

  return (
    <div className="max-w-[560px] mx-auto pt-6">
      <h1 className="text-2xl font-extrabold text-tx mb-5 animate-fade-up">Settings</h1>
      <Card className="animate-fade-up-1">
        {/* Tabs */}
        <div className="flex gap-0 mb-3.5 border-b border-lg-bd">
          {[{ k: "teams", l: "🏢 Teams" }, { k: "api", l: "🔑 API Keys" }, { k: "int", l: "🔌 Integrations" }, { k: "gates", l: "🚦 Gates" }].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className={`bg-transparent border-none text-xs px-3 py-2 cursor-pointer font-sans border-b-2 transition-colors ${tab === t.k ? "text-tx font-semibold border-accent-purple2" : "text-tx-4 font-normal border-transparent hover:text-tx-2"}`}>
              {t.l}
            </button>
          ))}
        </div>

        {/* ══════════ Teams ══════════ */}
        {tab === "teams" && (
          <div>
            {teamsLoading ? (
              <div className="text-xs text-tx-3 text-center py-4 animate-pulse">Loading teams...</div>
            ) : teamsList.length === 0 ? (
              <div className="text-xs text-tx-3 text-center py-4">No teams yet. Create one to collaborate.</div>
            ) : (
              teamsList.map((t) => (
                <div key={t.id} className="p-3 bg-lg-sf2 rounded-lg mb-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-[7px] h-[7px] rounded-full" style={{ background: t.brand_color || "#6366f1" }} />
                      <span className="text-base font-bold text-tx">{t.name}</span>
                    </div>
                    <Badge color={t.role === "owner" ? "pr" : "bl"} size="xs">{t.role?.toUpperCase()}</Badge>
                  </div>
                  <div className="text-xs text-tx-4 mt-0.5">{t.owner_email}</div>
                  <div className="flex gap-1 mt-2">
                    <Button variant="ghost" size="xs" onClick={() => toggleMembers(t.id)}>
                      {expandedTeam === t.id ? "Close" : "👥 Members"}
                    </Button>
                  </div>

                  {/* Expanded members */}
                  {expandedTeam === t.id && (
                    <div className="mt-2 border-t border-lg-bd pt-2">
                      {members.length === 0 ? (
                        <div className="text-xs text-tx-4">No members yet.</div>
                      ) : (
                        members.map((m) => (
                          <div key={m.email} className="flex justify-between items-center py-1">
                            <div>
                              <span className="text-sm text-tx">{m.email}</span>
                              <span className="text-xs text-tx-4 ml-1.5">{m.role}</span>
                            </div>
                            {t.role === "owner" && m.role !== "owner" && (
                              <button onClick={() => removeMember(t.id, m.email)} className="text-xs text-accent-red cursor-pointer bg-transparent border-none font-sans hover:underline">Remove</button>
                            )}
                          </div>
                        ))
                      )}
                      {/* Invite */}
                      {t.role === "owner" && (
                        <div className="flex gap-1 mt-2">
                          <input
                            type="email" placeholder="Invite by email" value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="input-glass text-sm flex-1"
                          />
                          <Button variant="primary" size="xs" onClick={() => inviteMember(t.id)}>Invite</Button>
                        </div>
                      )}
                      {inviteMsg && <div className="text-xs text-accent-green mt-1">{inviteMsg}</div>}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Create team */}
            <div className="flex gap-1 mt-2">
              <input
                type="text" placeholder="New workspace name" value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTeam()}
                className="input-glass text-sm flex-1"
              />
              <Button variant="primary" size="sm" onClick={createTeam}>Create Workspace</Button>
            </div>
          </div>
        )}

        {/* ══════════ API Keys ══════════ */}
        {tab === "api" && (
          <div>
            {keysLoading ? (
              <div className="text-xs text-tx-3 text-center py-4 animate-pulse">Loading keys...</div>
            ) : keysList.length === 0 ? (
              <div className="text-xs text-tx-3 text-center py-4 mb-2">No API keys yet. Create one for CI/CD integration.</div>
            ) : (
              <div className="mb-3">
                {keysList.map((k) => (
                  <div key={k.id} className="flex justify-between items-center py-2 border-b border-lg-bd">
                    <div>
                      <div className="text-sm text-tx font-medium">{k.name}</div>
                      <div className="text-xs text-tx-4 font-mono">
                        Created {new Date(k.created_at).toLocaleDateString()}
                        {k.last_used && ` · Last used ${new Date(k.last_used).toLocaleDateString()}`}
                      </div>
                    </div>
                    <Button variant="danger" size="xs" onClick={() => revokeKey(k.id)}>Revoke</Button>
                  </div>
                ))}
              </div>
            )}

            {/* Show newly created key */}
            {createdKey && (
              <div className="p-3 bg-accent-green/10 border border-accent-green/25 rounded-lg mb-3">
                <div className="text-sm text-tx font-semibold mb-1">Your new API key (copy now — shown only once):</div>
                <code className="text-sm text-accent-purple2 font-mono break-all select-all">{createdKey}</code>
                <Button variant="ghost" size="xs" className="mt-1.5" onClick={() => setCreatedKey(null)}>Dismiss</Button>
              </div>
            )}

            <div className="flex gap-1">
              <input
                type="text" placeholder="Key name (e.g. CI/CD Pipeline)" value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createKey()}
                className="input-glass text-sm flex-1"
              />
              <Button variant="primary" size="sm" onClick={createKey}>+ Create Key</Button>
            </div>
            <div className="text-xs text-tx-4 mt-2">Keys are prefixed <code className="text-accent-purple2 font-mono">ro_</code> for easy identification in CI/CD configs.</div>
          </div>
        )}

        {/* ══════════ Integrations ══════════ */}
        {tab === "int" && (
          <div>
            {integrationsLoading ? (
              <div className="text-xs text-tx-3 text-center py-4 animate-pulse">Loading integration defaults...</div>
            ) : (
              <>
                <IntegrationCard
                  icon="SL" title="Slack" subtitle="Webhook on complete"
                  description="Post a rich summary to a Slack channel when analysis completes."
                  fields={[
                    { key: "slack_webhook", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/...", type: "url" },
                  ]}
                  values={integrationDefaults}
                  onChange={updateIntegrationDefault}
                />
                <IntegrationCard
                  icon="JI" title="Jira" subtitle="Auto-create Must-Do issues"
                  description="Create Jira tasks for each Must-priority checklist item."
                  fields={[
                    { key: "jira_url", label: "Jira Base URL", placeholder: "https://your-org.atlassian.net" },
                    { key: "jira_project", label: "Project Key", placeholder: "PROJ" },
                    { key: "jira_token", label: "API Token", placeholder: "Base64-encoded email:token", type: "password" },
                  ]}
                  values={integrationDefaults}
                  onChange={updateIntegrationDefault}
                />
                <IntegrationCard
                  icon="GH" title="GitHub" subtitle="PR risk comment"
                  description="Post a risk summary comment on a GitHub pull request."
                  fields={[
                    { key: "github_repo", label: "Repository", placeholder: "owner/repo" },
                    { key: "github_pr", label: "PR Number", placeholder: "42", type: "number" },
                    { key: "github_token", label: "Personal Access Token", placeholder: "ghp_...", type: "password" },
                  ]}
                  values={integrationDefaults}
                  onChange={updateIntegrationDefault}
                />
                <IntegrationCard
                  icon="LN" title="Linear" subtitle="GraphQL checklist issues"
                  description="Create Linear issues for Must-priority checklist items."
                  fields={[
                    { key: "linear_team_id", label: "Team ID", placeholder: "your-team-uuid" },
                    { key: "linear_token", label: "API Key", placeholder: "lin_api_...", type: "password" },
                  ]}
                  values={integrationDefaults}
                  onChange={updateIntegrationDefault}
                />
                <IntegrationCard
                  icon="WH" title="Webhook" subtitle="Custom HMAC-signed payload"
                  description="POST analysis results to any URL with an HMAC-SHA256 signature header."
                  fields={[
                    { key: "webhook_url", label: "Endpoint URL", placeholder: "https://your-api.com/hooks/ReleaseOps" },
                    { key: "webhook_secret", label: "HMAC Secret", placeholder: "your-signing-secret", type: "password" },
                  ]}
                  values={integrationDefaults}
                  onChange={updateIntegrationDefault}
                />

                <div className="flex items-center justify-between mt-3 gap-2">
                  <div className="text-xs text-tx-4">These defaults are applied to new sessions. Override per-session in the session detail view.</div>
                  <Button variant="primary" size="sm" onClick={saveIntegrationDefaults} disabled={integrationsSaving}>{integrationsSaving ? "Saving..." : "Save Defaults"}</Button>
                </div>
                {integrationsMsg && <div className="text-xs text-tx-3 mt-2">{integrationsMsg}</div>}
              </>
            )}
          </div>
        )}

        {/* ══════════ Gates ══════════ */}
        {tab === "gates" && (
          <div>
            {gatesLoading ? (
              <div className="text-xs text-tx-3 text-center py-4 animate-pulse">Loading gates...</div>
            ) : gatesList.length === 0 ? (
              <div className="text-xs text-tx-3 text-center py-4">No release gates configured.</div>
            ) : (
              gatesList.map((g) => (
                <div key={g.id} className="p-3 bg-lg-sf2 rounded-lg border border-accent-purple/10 mb-2">
                  <div className="flex justify-between items-center">
                    <div className="text-base font-bold text-tx">🚦 {g.name}</div>
                    <Badge color={g.active ? "gn" : "or"} size="xs">{g.active ? "ACTIVE" : "DISABLED"}</Badge>
                  </div>
                  <div className="text-sm text-tx-3 mt-1">
                    Type: {g.gate_type} · Min Score: {g.min_score}
                  </div>
                  {g.required_signoffs && (
                    <div className="text-sm text-tx-3 mt-0.5">
                      Sign-offs: {(typeof g.required_signoffs === "string" ? JSON.parse(g.required_signoffs) : g.required_signoffs).join(", ")}
                    </div>
                  )}
                  {g.required_frameworks && (
                    <div className="text-sm text-tx-3 mt-0.5">
                      Frameworks: {(typeof g.required_frameworks === "string" ? JSON.parse(g.required_frameworks) : g.required_frameworks).join(", ")}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Create gate form */}
            {showGateForm ? (
              <div className="p-3 bg-lg-sf2 rounded-lg border border-lg-bd mt-2">
                <div className="text-sm font-bold text-tx mb-2">New Release Gate</div>
                <input type="text" placeholder="Gate name" value={gateForm.name} onChange={(e) => setGateForm({ ...gateForm, name: e.target.value })} className="input-glass text-sm mb-1.5" />
                <select value={gateForm.gate_type} onChange={(e) => setGateForm({ ...gateForm, gate_type: e.target.value })} className="input-glass text-sm mb-1.5">
                  <option value="ci_cd">CI/CD</option>
                  <option value="pr_check">PR Check</option>
                  <option value="manual">Manual</option>
                </select>
                <input type="number" placeholder="Min score" value={gateForm.min_score} onChange={(e) => setGateForm({ ...gateForm, min_score: e.target.value })} className="input-glass text-sm mb-1.5" />
                <input type="text" placeholder="Sign-offs (comma-separated)" value={gateForm.required_sign_offs} onChange={(e) => setGateForm({ ...gateForm, required_sign_offs: e.target.value })} className="input-glass text-sm mb-1.5" />
                <input type="text" placeholder="Frameworks (comma-separated)" value={gateForm.required_frameworks} onChange={(e) => setGateForm({ ...gateForm, required_frameworks: e.target.value })} className="input-glass text-sm mb-2" />
                <div className="flex gap-1">
                  <Button variant="primary" size="sm" onClick={createGate}>Create</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowGateForm(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="primary" size="sm" className="w-full mt-2" onClick={() => setShowGateForm(true)}>+ Create Gate</Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

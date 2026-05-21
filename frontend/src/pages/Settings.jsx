/* ReleaseOps Settings - enterprise workspace */

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Label } from "../components/ui";
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

const ORG_ROLES = [
  ["member", "Member"],
  ["product", "Product / PM"],
  ["qa", "QA"],
  ["legal", "Legal"],
  ["compliance", "Compliance"],
  ["security", "Security"],
  ["admin", "Admin"],
];

const TABS = [
  ["organizations", "Organizations"],
  ["approvals", "Approval Gates"],
  ["integrations", "Integrations"],
  ["api", "API Keys"],
  ["audit", "Audit"],
];

function Section({ title, description, children, action }) {
  return (
    <section className="workspace-section p-5">
      <div className="mb-5 flex flex-col gap-3 border-b border-lg-bd pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-tx">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-tx-3">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function IntegrationRow({ title, subtitle, fields, values, onChange }) {
  const [open, setOpen] = useState(false);
  const configured = fields.some((field) => String(values[field.key] || "").trim());
  return (
    <div className="workspace-row py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-tx">{title}</h3>
            {configured ? <Badge color="gn" size="xs">Configured</Badge> : <Badge color="or" size="xs">Not configured</Badge>}
          </div>
          <p className="mt-1 text-sm leading-6 text-tx-3">{subtitle}</p>
        </div>
        <Button variant="default" size="xs" onClick={() => setOpen((value) => !value)}>{open ? "Close" : "Configure"}</Button>
      </div>
      {open ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className={field.wide ? "lg:col-span-2" : ""}>
              <span className="mb-1 block text-xs font-semibold text-tx-3">{field.label}</span>
              <input
                type={field.type || "text"}
                value={values[field.key] ?? ""}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                className="input-glass text-sm"
              />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
  }
}

export default function Settings() {
  const [tab, setTab] = useState("organizations");
  const [teamsList, setTeamsList] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberForm, setMemberForm] = useState({ email: "", role: "member" });
  const [memberMsg, setMemberMsg] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [keysList, setKeysList] = useState([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [integrationDefaults, setIntegrationDefaults] = useState(EMPTY_INTEGRATIONS);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [integrationsSaving, setIntegrationsSaving] = useState(false);
  const [integrationsMsg, setIntegrationsMsg] = useState("");
  const [gatesList, setGatesList] = useState([]);
  const [gatesLoading, setGatesLoading] = useState(true);
  const [showGateForm, setShowGateForm] = useState(false);
  const [gateForm, setGateForm] = useState({
    name: "",
    gate_type: "ci_cd",
    min_score: 80,
    required_sign_offs: "pm,qa,legal,security",
    required_frameworks: "EU AI Act,OWASP,NIST AI RMF,ISO 42001,GDPR,SOC 2,HIPAA",
  });

  const activeTeam = useMemo(() => teamsList.find((team) => team.id === expandedTeam), [teamsList, expandedTeam]);

  const loadTeams = () => {
    setTeamsLoading(true);
    teamsAPI.list().then(setTeamsList).catch(() => setTeamsList([])).finally(() => setTeamsLoading(false));
  };
  const loadKeys = () => {
    setKeysLoading(true);
    keysAPI.list().then(setKeysList).catch(() => setKeysList([])).finally(() => setKeysLoading(false));
  };
  const loadGates = () => {
    setGatesLoading(true);
    gatesAPI.list().then((response) => setGatesList(response.gates || [])).catch(() => setGatesList([])).finally(() => setGatesLoading(false));
  };
  const loadIntegrations = () => {
    setIntegrationsLoading(true);
    integrationsAPI.get()
      .then((response) => setIntegrationDefaults({ ...EMPTY_INTEGRATIONS, ...(response.integrations || {}) }))
      .catch(() => setIntegrationDefaults(EMPTY_INTEGRATIONS))
      .finally(() => setIntegrationsLoading(false));
  };

  useEffect(() => {
    loadTeams();
    loadKeys();
    loadGates();
    loadIntegrations();
  }, []);

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    await teamsAPI.create(newTeamName.trim());
    setNewTeamName("");
    loadTeams();
  };

  const toggleMembers = async (teamId) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null);
      return;
    }
    setExpandedTeam(teamId);
    setMemberMsg("");
    setInviteLink("");
    try {
      setMembers(await teamsAPI.members(teamId));
    } catch {
      setMembers([]);
    }
  };

  const inviteMember = async (teamId) => {
    if (!memberForm.email.trim()) return;
    setMemberMsg("");
    setInviteLink("");
    try {
      const response = await teamsAPI.invite(teamId, memberForm.email.trim(), memberForm.role);
      setInviteLink(response.invite_url || "");
      setMemberMsg(response.email_sent
        ? `Invitation sent to ${memberForm.email.trim()}.`
        : `Email was not sent${response.email_error ? `: ${response.email_error}` : ""}. Use the invite link below.`);
      setMemberForm({ email: "", role: "member" });
      setMembers(await teamsAPI.members(teamId));
    } catch (error) {
      setMemberMsg(error.message || "Could not send invitation.");
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard?.writeText(inviteLink);
    setMemberMsg("Invite link copied.");
  };

  const updateMemberRole = async (teamId, memberEmail, role) => {
    setMemberMsg("");
    try {
      await teamsAPI.updateMemberRole(teamId, memberEmail, role);
      setMembers(await teamsAPI.members(teamId));
      setMemberMsg("Role updated.");
    } catch (error) {
      setMemberMsg(error.message || "Could not update role.");
    }
  };

  const removeMember = async (teamId, email) => {
    await teamsAPI.removeMember(teamId, email);
    setMembers(await teamsAPI.members(teamId));
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    const response = await keysAPI.create(newKeyName.trim());
    setCreatedKey(response.key);
    setNewKeyName("");
    loadKeys();
  };

  const revokeKey = async (id) => {
    await keysAPI.revoke(id);
    loadKeys();
  };

  const updateIntegrationDefault = (field, value) => {
    setIntegrationDefaults((current) => ({ ...current, [field]: value }));
  };

  const saveIntegrationDefaults = async () => {
    const payload = { ...integrationDefaults };
    payload.github_pr = payload.github_pr === "" ? null : Number(payload.github_pr);
    if (Number.isNaN(payload.github_pr)) payload.github_pr = null;
    setIntegrationsSaving(true);
    setIntegrationsMsg("");
    try {
      const response = await integrationsAPI.save(payload);
      setIntegrationDefaults({ ...EMPTY_INTEGRATIONS, ...(response.integrations || {}) });
      setIntegrationsMsg("Default integrations saved.");
    } catch (error) {
      setIntegrationsMsg(error.message || "Failed to save integration defaults.");
    } finally {
      setIntegrationsSaving(false);
    }
  };

  const createGate = async () => {
    if (!gateForm.name.trim()) return;
    await gatesAPI.create({
      name: gateForm.name.trim(),
      gate_type: gateForm.gate_type,
      min_score: Number(gateForm.min_score),
      required_sign_offs: gateForm.required_sign_offs.split(",").map((item) => item.trim()).filter(Boolean),
      required_frameworks: gateForm.required_frameworks.split(",").map((item) => item.trim()).filter(Boolean),
    });
    setShowGateForm(false);
    setGateForm({
      name: "",
      gate_type: "ci_cd",
      min_score: 80,
      required_sign_offs: "pm,qa,legal,security",
      required_frameworks: "EU AI Act,OWASP,NIST AI RMF,ISO 42001,GDPR,SOC 2,HIPAA",
    });
    loadGates();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 pt-4">
        <h1 className="text-3xl font-extrabold text-tx">Settings</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-tx-3">
          Configure organizations, approval authority, release gates, integrations, and API access for production AI release governance.
        </p>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto border-b border-lg-bd">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${tab === key ? "border-slate-950 text-tx" : "border-transparent text-tx-3 hover:text-tx"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "organizations" ? (
        <Section
          title="Organizations and roles"
          description="Create tenant organizations, invite users, and assign the roles that control release approvals."
          action={
            <div className="flex w-full gap-2 lg:w-auto">
              <input
                type="text"
                placeholder="Organization name"
                value={newTeamName}
                onChange={(event) => setNewTeamName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && createTeam()}
                className="input-glass text-sm lg:w-72"
              />
              <Button variant="primary" size="sm" onClick={createTeam}>Create</Button>
            </div>
          }
        >
          {teamsLoading ? <div className="py-8 text-sm text-tx-3">Loading organizations...</div> : null}
          {!teamsLoading && teamsList.length === 0 ? <div className="py-8 text-sm text-tx-3">No organization yet. Create one before assigning approver roles.</div> : null}
          <div className="grid gap-4">
            {teamsList.map((team) => (
              <div key={team.id} className="rounded-lg border border-lg-bd bg-white">
                <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: team.brand_color || "#111827" }} />
                      <h3 className="text-base font-extrabold text-tx">{team.name}</h3>
                      <Badge color={team.role === "owner" ? "pr" : "bl"} size="xs">{team.role || "member"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-tx-4">Owner: {team.owner_email || "Not recorded"}</p>
                  </div>
                  <Button variant="default" size="sm" onClick={() => toggleMembers(team.id)}>
                    {expandedTeam === team.id ? "Close members" : "Manage members"}
                  </Button>
                </div>
                {expandedTeam === team.id ? (
                  <div className="border-t border-lg-bd p-4">
                    <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_340px]">
                      <div>
                        <Label>Members</Label>
                        <div className="overflow-hidden rounded-lg border border-lg-bd">
                          {members.length === 0 ? <div className="p-4 text-sm text-tx-3">No members yet.</div> : null}
                          {members.map((member) => (
                            <div key={member.email} className="workspace-row grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_180px_80px] lg:items-center">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-tx">{member.name || member.email}</div>
                                <div className="truncate text-xs text-tx-4">{member.email}</div>
                              </div>
                              {["owner", "admin"].includes(team.role) && member.role !== "owner" ? (
                                <select value={member.role} onChange={(event) => updateMemberRole(team.id, member.email, event.target.value)} className="input-glass text-xs">
                                  {ORG_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                              ) : (
                                <Badge color="bl" size="xs">{member.role}</Badge>
                              )}
                              {team.role === "owner" && member.role !== "owner" ? (
                                <Button variant="danger" size="xs" onClick={() => removeMember(team.id, member.email)}>Remove</Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                      {["owner", "admin"].includes(team.role) ? (
                        <div className="rounded-lg border border-lg-bd bg-[#fbfaf7] p-4">
                          <Label>Invite user</Label>
                          <div className="grid gap-2">
                            <input type="email" placeholder="Email address" value={memberForm.email} onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })} className="input-glass text-sm" />
                            <select value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value })} className="input-glass text-sm">
                              {ORG_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            <Button variant="primary" size="sm" onClick={() => inviteMember(team.id)}>Send invitation</Button>
                          </div>
                          {memberMsg ? <div className="mt-3 text-xs leading-5 text-tx-3">{memberMsg}</div> : null}
                          {inviteLink ? (
                            <div className="mt-3 rounded-md border border-lg-bd bg-white p-3">
                              <div className="mb-1 text-xs font-semibold text-tx-4">Invite link</div>
                              <div className="break-all font-mono text-xs text-tx">{inviteLink}</div>
                              <Button variant="ghost" size="xs" className="mt-2" onClick={copyInviteLink}>Copy link</Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {activeTeam ? <div className="mt-4 text-xs text-tx-4">Editing organization: {activeTeam.name}</div> : null}
        </Section>
      ) : null}

      {tab === "approvals" ? (
        <Section title="Approval gates" description="Define the score, role approvals, and framework coverage required before a release can be marked production-ready.">
          {gatesLoading ? <div className="py-6 text-sm text-tx-3">Loading gates...</div> : null}
          <div className="grid gap-3">
            {gatesList.map((gate) => (
              <div key={gate.id} className="rounded-lg border border-lg-bd bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-tx">{gate.name}</h3>
                      <Badge color={gate.active ? "gn" : "or"} size="xs">{gate.active ? "Active" : "Disabled"}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-tx-3">Type: {gate.gate_type} / Minimum score: {gate.min_score}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parseList(gate.required_signoffs).map((role) => <Badge key={role} color="pr" size="xs">{role}</Badge>)}
                  </div>
                </div>
                {parseList(gate.required_frameworks).length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {parseList(gate.required_frameworks).map((framework) => <Badge key={framework} color="bl" size="xs">{framework}</Badge>)}
                  </div>
                ) : null}
              </div>
            ))}
            {!gatesLoading && gatesList.length === 0 ? <div className="rounded-lg border border-lg-bd bg-white p-5 text-sm text-tx-3">No approval gates configured.</div> : null}
          </div>

          {showGateForm ? (
            <div className="mt-5 rounded-lg border border-lg-bd bg-[#fbfaf7] p-4">
              <Label>New release gate</Label>
              <div className="grid gap-3 lg:grid-cols-2">
                <input type="text" placeholder="Gate name" value={gateForm.name} onChange={(event) => setGateForm({ ...gateForm, name: event.target.value })} className="input-glass text-sm" />
                <select value={gateForm.gate_type} onChange={(event) => setGateForm({ ...gateForm, gate_type: event.target.value })} className="input-glass text-sm">
                  <option value="ci_cd">CI/CD</option>
                  <option value="pr_check">PR Check</option>
                  <option value="manual">Manual</option>
                </select>
                <input type="number" placeholder="Minimum score" value={gateForm.min_score} onChange={(event) => setGateForm({ ...gateForm, min_score: event.target.value })} className="input-glass text-sm" />
                <input type="text" placeholder="Required sign-offs" value={gateForm.required_sign_offs} onChange={(event) => setGateForm({ ...gateForm, required_sign_offs: event.target.value })} className="input-glass text-sm" />
                <input type="text" placeholder="Required frameworks" value={gateForm.required_frameworks} onChange={(event) => setGateForm({ ...gateForm, required_frameworks: event.target.value })} className="input-glass text-sm lg:col-span-2" />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="primary" size="sm" onClick={createGate}>Create gate</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowGateForm(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="primary" size="sm" className="mt-5" onClick={() => setShowGateForm(true)}>Create approval gate</Button>
          )}
        </Section>
      ) : null}

      {tab === "integrations" ? (
        <Section
          title="Integration defaults"
          description="Configure default destinations for release evidence, tickets, PR comments, and webhooks. New reviews inherit these settings."
          action={<Button variant="primary" size="sm" onClick={saveIntegrationDefaults} disabled={integrationsSaving}>{integrationsSaving ? "Saving..." : "Save defaults"}</Button>}
        >
          {integrationsLoading ? <div className="py-6 text-sm text-tx-3">Loading integration defaults...</div> : (
            <>
              <IntegrationRow title="Slack" subtitle="Post a release summary when analysis completes." fields={[{ key: "slack_webhook", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/...", type: "url", wide: true }]} values={integrationDefaults} onChange={updateIntegrationDefault} />
              <IntegrationRow title="Jira" subtitle="Create Jira tasks for required controls and blockers." fields={[{ key: "jira_url", label: "Jira base URL", placeholder: "https://your-org.atlassian.net" }, { key: "jira_project", label: "Project key", placeholder: "PROJ" }, { key: "jira_token", label: "API token", placeholder: "Base64 email:token", type: "password", wide: true }]} values={integrationDefaults} onChange={updateIntegrationDefault} />
              <IntegrationRow title="GitHub" subtitle="Post a release risk summary on a pull request." fields={[{ key: "github_repo", label: "Repository", placeholder: "owner/repo" }, { key: "github_pr", label: "PR number", placeholder: "42", type: "number" }, { key: "github_token", label: "Token", placeholder: "ghp_...", type: "password", wide: true }]} values={integrationDefaults} onChange={updateIntegrationDefault} />
              <IntegrationRow title="Linear" subtitle="Create checklist issues for release controls." fields={[{ key: "linear_team_id", label: "Team ID", placeholder: "team uuid" }, { key: "linear_token", label: "API key", placeholder: "lin_api_...", type: "password" }]} values={integrationDefaults} onChange={updateIntegrationDefault} />
              <IntegrationRow title="Webhook" subtitle="POST a signed payload to your internal release system." fields={[{ key: "webhook_url", label: "Endpoint URL", placeholder: "https://your-api.com/hooks/releaseops" }, { key: "webhook_secret", label: "HMAC secret", placeholder: "Signing secret", type: "password" }]} values={integrationDefaults} onChange={updateIntegrationDefault} />
            </>
          )}
          {integrationsMsg ? <div className="mt-3 text-sm text-tx-3">{integrationsMsg}</div> : null}
        </Section>
      ) : null}

      {tab === "api" ? (
        <Section title="API keys" description="Create scoped keys for CI/CD, release automation, and internal workflow integration. New keys are shown once.">
          {createdKey ? (
            <div className="mb-4 rounded-lg border border-accent-green/25 bg-accent-green/10 p-4">
              <div className="mb-1 text-sm font-semibold text-tx">New API key, shown once</div>
              <code className="break-all font-mono text-sm text-accent-purple2">{createdKey}</code>
              <Button variant="ghost" size="xs" className="mt-2" onClick={() => setCreatedKey(null)}>Dismiss</Button>
            </div>
          ) : null}
          {keysLoading ? <div className="py-6 text-sm text-tx-3">Loading keys...</div> : null}
          <div className="overflow-hidden rounded-lg border border-lg-bd">
            {keysList.length === 0 && !keysLoading ? <div className="p-4 text-sm text-tx-3">No API keys yet.</div> : null}
            {keysList.map((key) => (
              <div key={key.id} className="workspace-row grid gap-3 p-3 lg:grid-cols-[1fr_220px_80px] lg:items-center">
                <div>
                  <div className="text-sm font-semibold text-tx">{key.name}</div>
                  <div className="font-mono text-xs text-tx-4">Created {new Date(key.created_at).toLocaleDateString()}</div>
                </div>
                <div className="text-xs text-tx-4">{key.last_used ? `Last used ${new Date(key.last_used).toLocaleDateString()}` : "Never used"}</div>
                <Button variant="danger" size="xs" onClick={() => revokeKey(key.id)}>Revoke</Button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input type="text" placeholder="Key name, e.g. CI/CD Pipeline" value={newKeyName} onChange={(event) => setNewKeyName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createKey()} className="input-glass text-sm" />
            <Button variant="primary" size="sm" onClick={createKey}>Create key</Button>
          </div>
        </Section>
      ) : null}

      {tab === "audit" ? (
        <Section title="Audit posture" description="Operational history for organization and policy changes will appear here as the audit model expands.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-lg-bd bg-white p-4">
              <div className="text-2xl font-extrabold text-tx">{teamsList.length}</div>
              <div className="text-sm text-tx-3">Organizations</div>
            </div>
            <div className="rounded-lg border border-lg-bd bg-white p-4">
              <div className="text-2xl font-extrabold text-tx">{gatesList.length}</div>
              <div className="text-sm text-tx-3">Approval gates</div>
            </div>
            <div className="rounded-lg border border-lg-bd bg-white p-4">
              <div className="text-2xl font-extrabold text-tx">{keysList.length}</div>
              <div className="text-sm text-tx-3">API keys</div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-lg-bd bg-[#fbfaf7] p-4 text-sm leading-6 text-tx-3">
            Release-level audit history is available inside each review under Governance. Organization-level audit history should be backed by immutable server events before broad enterprise rollout.
          </div>
        </Section>
      ) : null}
    </div>
  );
}

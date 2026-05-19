# ReleaseOps Agent Hackathon Submission

## Summary

ReleaseOps Agent is a web-based enterprise AI release decision agent deployed on Vultr. It helps teams decide whether an AI workflow is ready for production by running an autonomous multi-step review that produces a release spec, risk register, tests, guardrails, compliance mapping, sign-off state, and go-live decision.

Public demo:

```text
http://45.32.176.216/
```

GitHub:

```text
https://github.com/othnielObasi/releaseops-agent
```

## Problem

Enterprise AI release review is fragmented. Product, engineering, security, compliance, QA, and leadership often work from separate documents and meetings. That creates slow launches, unclear ownership, weak evidence, and late discovery of risk.

ReleaseOps Agent turns that review into one repeatable operating system for AI release readiness.

## Autonomous Agent Workflow

Each release review follows an explicit execution plan:

1. **Intake:** classify the feature, users, data, tools, actions, and launch environment.
2. **Plan:** choose applicable frameworks, sign-offs, release gates, tests, controls, and evidence outputs.
3. **Reason:** coordinate specialized agents to build the spec, detect risk, generate tests, map guardrails, and produce a decision.
4. **Handle roadblocks:** block or downgrade the release if key details, owners, sign-offs, controls, or evidence are missing.
5. **Execute:** generate reports, evidence packs, certificates, integration payloads, and stakeholder summaries.
6. **Persist:** store the run as a durable system-of-record entry.

This is more than a copilot response. ReleaseOps Agent plans the review, evaluates constraints, produces a decision, and records the operational evidence behind that decision.

## Multi-Agent Design

| Agent | Responsibility | Output |
|-------|----------------|--------|
| **Navigator** | Understands product intent, users, workflow, data, and missing context. | Release spec, personas, workflow, readiness checklist |
| **Sentinel** | Stress-tests the release for safety, security, privacy, compliance, and business risk. | Risk register, tests, guardrails, framework mapping |
| **Herald** | Packages the decision for stakeholders and auditors. | Release notes, decision summary, launch package, evidence record |

## Vultr Architecture

Vultr is the central system of record for planning, coordination, and execution.

```text
User browser
  |
  v
React frontend on Vultr VM
  |
  v
Nginx /api proxy
  |
  v
FastAPI backend on Vultr VM
  |
  v
LangGraph-style multi-agent release workflow
  |
  v
Postgres on Vultr VM
```

Stored records include:

- users and tenants
- release sessions
- agent outputs
- readiness scores
- risks and generated tests
- guardrails and gates
- approvals and sign-offs
- audit logs
- share tokens and evidence artifacts

## Production Shape

ReleaseOps Agent includes:

- Docker Compose deployment
- React frontend
- FastAPI backend
- Postgres persistence
- tenant-aware auth
- backend/database ports bound to localhost
- Nginx frontend proxy
- audit logs
- governance gates
- evidence exports
- integration surfaces for webhooks, GitHub, Jira, Slack, Linear, Confluence, and Notion

## Demo Flow

1. Open the public demo URL.
2. Sign up with a simple name and password.
3. Start a new release review.
4. Enter an AI workflow such as an AI customer support refund assistant.
5. Review the generated score, risks, tests, guardrails, compliance mapping, and governance status.
6. Show the autonomous run plan and roadblock handling.
7. Export or inspect the evidence package and decision record.

## Why It Wins The Vultr Track

| Requirement | ReleaseOps Agent |
|-------------|------------------|
| Web-based enterprise agent | Full browser app with authenticated workspaces |
| Deployed on Vultr | Live VM deployment with public URL |
| Real enterprise workflow | AI release readiness, risk, compliance, QA, and approval |
| Agentic workflow | Multi-step planning, reasoning, roadblock handling, and evidence generation |
| System of record | Postgres-backed release sessions and audit history on Vultr |
| Production-style app | Docker, FastAPI, React, Nginx, Postgres, docs, deployment path |
| Measurable value | Scores, risk counts, test counts, guardrail counts, sign-off state, launch decision |

## Roadmap Beyond The Hackathon

- Add live streaming agent execution logs.
- Add document upload for PRDs, policies, model cards, and audit evidence.
- Add Gemini, Featherless, or Vultr Serverless Inference provider adapters.
- Add scheduled drift monitoring for already-launched AI features.
- Add enterprise SSO and role-based access control.
- Add organization-level analytics across release portfolios.

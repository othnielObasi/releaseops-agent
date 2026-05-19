<div align="center">

# ReleaseOps Agent

### Vultr-Deployed Enterprise AI Release Decision Agent

Autonomously evaluate enterprise AI workflows before launch — from feature intake to risk analysis, test planning, runtime guardrails, stakeholder approval, and go/no-go release decisions.

[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agentic%20Workflow-1C3C3C)](https://github.com/langchain-ai/langgraph)
[![Deployed on Vultr](https://img.shields.io/badge/Deployed%20on-Vultr-007BFC)](https://www.vultr.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## What is ReleaseOps Agent?

ReleaseOps Agent is a web-based enterprise AI release decision agent built for teams launching AI-powered products, autonomous workflows, and enterprise AI systems.

It helps product, engineering, operations, customer support, compliance, security, and leadership teams answer one critical question:

> Is this AI workflow ready to go live, and under what controls?

Instead of producing a simple checklist, ReleaseOps Agent runs a structured multi-agent workflow that analyses the proposed AI feature, identifies business and technical risks, generates test plans, maps runtime guardrails, and produces an approval-ready release decision record.

The final output is a structured launch decision:

- **Ship**
- **Ship with controls**
- **Needs review**
- **Do not ship yet**

Each decision is backed by risk evidence, generated tests, compliance mapping, runtime control recommendations, and an auditable execution trail.

---

## Why it matters

Enterprise teams are under pressure to launch AI features quickly, but release review is often fragmented across product documents, spreadsheets, QA plans, security checks, compliance reviews, and stakeholder approvals.

**Before ReleaseOps Agent:**  
Teams manually compile risk assessments, write test plans, check regulatory alignment, discuss approval gates, and struggle to produce a clear launch decision.

**After ReleaseOps Agent:**  
A team submits an AI feature proposal, PRD, or workflow description. ReleaseOps Agent autonomously analyses the workflow, identifies risky actions and data access concerns, generates tests and guardrails, scores readiness, and produces a go/no-go release decision record.

---

## Vultr Hackathon Challenge Alignment

ReleaseOps Agent is designed for the Vultr challenge: **Build a Web-Based Enterprise Agent Deployed on Vultr**.

| Vultr Requirement | ReleaseOps Agent Alignment |
|------------------|----------------------------|
| **Web-based enterprise agent** | Browser-based AI release decision workflow for enterprise teams |
| **Real-world enterprise workflow** | Supports release review for AI workflows across customer support, operations, sales, marketing, HR, product, and compliance |
| **Operational decision system** | Produces structured launch decisions, not just suggestions |
| **Agentic workflows** | Uses specialized agents for product analysis, risk review, test planning, guardrail mapping, and stakeholder packaging |
| **Enterprise utility** | Helps teams reduce release ambiguity, improve review quality, and produce auditable launch records |
| **Measurable output** | Readiness score, risk count, generated tests, required controls, approval status, and launch recommendation |
| **Vultr deployment** | Backend deployed on Vultr VM with persistent run records and production-style web access |

---

## Reference Demo Scenario

The reference demo evaluates a fintech customer support AI agent that can:

- read customer profile data
- inspect transaction history
- classify complaints
- recommend refunds
- draft customer responses
- escalate high-risk cases

ReleaseOps Agent analyses the proposed workflow and produces:

- AI release readiness score
- risk register
- generated test plan
- required human approvals
- blocked or restricted actions
- runtime guardrail recommendations
- compliance mapping
- final launch decision record

Example decision:

> **Ship with controls**  
> Refunds above a defined threshold require human approval. Customer-facing responses require moderation. PII access must be logged. Account deletion is blocked. Vulnerable customer complaints must be escalated.

---

## Agentic Decision Workflow

Three specialized review stages orchestrated by [LangGraph](https://github.com/langchain-ai/langgraph) run in sequence:

| Stage | Role | Output |
|-------|------|--------|
| **Release Analysis** | Enterprise Workflow Analysis | Product intent, affected users, personas, user stories, business workflow, initial risk areas, readiness checklist |
| **Validation Planning** | Risk, Test & Guardrail Planning | Risk register, testing strategy, linked test cases, safety checks, runtime guardrail recommendations |
| **Decision Packaging** | Decision Record & Stakeholder Packaging | Release notes, stakeholder summary, launch decision explanation, approval package, GTM materials |

Each output is validated, scored using a 0–100 readiness grade, and persisted for audit.

---

## Enterprise Agent Capabilities

| Capability | Description |
|-----------|-------------|
| **Autonomous Release Decisioning** | Produces a structured Ship / Ship with controls / Needs review / Do not ship yet decision. |
| **Multi-Step Workflow Execution** | Moves through intake, analysis, risk detection, test planning, guardrail mapping, scoring, and decision packaging. |
| **Enterprise Workflow Coverage** | Supports AI workflows across customer support, operations, sales, marketing, HR, product, and compliance. |
| **Runtime Governance Mapping** | Converts risky AI actions into practical controls such as allow, block, require approval, log, or escalate. |
| **Persistent Decision Record** | Stores each run, risk, test, score, control, approval, and final decision for later review. |
| **Measurable Outputs** | Provides readiness score, number of risks, generated tests, required controls, blocked actions, and approval status. |

---

## Production-Grade Autonomy

ReleaseOps Agent is designed as an operational decision system, not a chat assistant. Each run follows an explicit autonomous plan:

1. **Intake:** classify the AI release, business action, user groups, data sensitivity, tools, and launch environment.
2. **Plan:** select applicable governance frameworks, required sign-offs, release gates, tests, and evidence targets.
3. **Reason:** coordinate specialist agents to generate the release spec, risk model, tests, guardrails, and launch decision.
4. **Handle roadblocks:** pause or downgrade the decision when required context, owners, sign-offs, or controls are missing.
5. **Execute:** package the decision record, evidence pack, certificates, webhooks, reviewer notifications, and integration outputs.
6. **Persist:** store run state, artifacts, approvals, metrics, and audit events as a durable enterprise record.

This makes the agent suitable for real release operations: it can say **yes**, **yes with controls**, **not yet**, or **blocked**, and it records why.

---

## Vultr as the System of Record

The Vultr deployment is not just a demo host. It runs the central operational record for ReleaseOps:

- **Postgres on Vultr:** users, tenants, release sessions, scores, approvals, gates, audit logs, share tokens, and integration settings.
- **FastAPI backend on Vultr:** authenticated agent orchestration, session APIs, governance APIs, export APIs, and webhook triggers.
- **Nginx/React frontend on Vultr:** browser-based release review workspace for product, engineering, compliance, and leadership users.
- **Docker Compose deployment:** reproducible production-style services with private backend/database ports and public frontend access.

This satisfies the enterprise-agent requirement that planning, coordination, execution, and decision history live in a durable backend system.

---

## Measurable Enterprise Value

ReleaseOps Agent produces outputs that can be inspected, compared, and governed:

| Metric | Why it matters |
|--------|----------------|
| **Readiness score** | Gives leadership a clear launch signal. |
| **Risk count and severity** | Shows what must be fixed or controlled before release. |
| **Generated tests** | Turns risk analysis into QA action. |
| **Mapped guardrails** | Converts policy into runtime controls. |
| **Required sign-offs** | Makes ownership explicit across PM, QA, Legal, and Security. |
| **Evidence pack** | Gives auditors and stakeholders a durable record of the decision. |

---

## Key Features

| Category | Capabilities |
|----------|-------------|
| **Risk Analysis** | Automated risk register across Safety, Security, Privacy, and UX/Business categories. Readiness scoring with letter grades (A–F). Risk heatmap visualization. |
| **Compliance** | Maps to 7 regulation frameworks — EU AI Act, OWASP Top 10 LLM, NIST AI RMF, ISO 42001, GDPR, SOC 2, HIPAA. EU AI Act risk classification. Compliance certificates. |
| **Governance** | Role-based sign-offs for PM, Legal, QA, and Security. Configurable CI/CD quality gates. Full audit trail with structured logging. |
| **Runtime Controls** | Maps risky AI actions to guardrails such as human approval, restricted execution, logging, escalation, and blocking. |
| **Integrations** | Slack notifications, Jira issue creation, GitHub PR comments, Linear issues, Confluence/Notion export, webhook/CI-CD triggers. |
| **Collaboration** | Team workspaces with invite flow. Session annotations. Shareable report links. Email notifications. Branding customization. |
| **Analysis Tools** | Session version comparison. Re-analysis with version tracking. Evidence pack export. PDF export. Trend analytics. |



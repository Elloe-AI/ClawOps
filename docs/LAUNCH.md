# ClawOps Launch & Distribution

This document defines how ClawOps ships, onboards, and scales adoption without weakening enforcement, RBAC, auditability, or readiness guarantees established in Prompts #1-#5.

## Positioning

ClawOps is not an agent framework or chatbot builder. It is the operations, safety, and governance layer for agents you already run.

**Core narrative**

> You don't rebuild agents to make them safe. You operate them safely after they're deployed.

## Deployment Modes

All modes share the same UX, guardrail semantics, agent lifecycle, and audit guarantees.

### A. Hosted ClawOps (SaaS)

- **Control plane**: Hosted by ClawOps
- **Data handling**: Metadata-only by default; opt-in for full-fidelity
- **Analysis**: Managed ClawOps Engine

```
Agent Runtime -> ClawOps Control Plane (Hosted)
                 |-> Guardrails / Incidents / Audit
                 `-> ClawOps Engine (Managed)
```

### B. Hybrid ClawOps (Recommended)

- **Control plane**: Hosted by ClawOps
- **Edge**: Self-hosted connector + decision cache
- **Data handling**: Raw data stays local; SaaS receives metadata + incidents

```
Agent Runtime -> ClawOps Edge (Self-hosted)
                 |-> Decision Cache / Optional Local Engine
                 `-> Metadata + Incidents -> ClawOps Control Plane (Hosted)
```

### C. Fully Self-Hosted ClawOps

- **Control plane + Edge**: Deployed on customer infrastructure
- **Data handling**: No external dependencies
- **Support**: Licensing + enterprise support hooks

```
Agent Runtime -> ClawOps Control Plane (Self-hosted)
                 |-> ClawOps Engine (Local)
                 `-> Audit + Evidence Exports (Local)
```

## 5-Minute Onboarding Flow (Screens + States)

**Goal**: A non-technical user protects an agent in minutes with no CLI or Docker in the SaaS path.

1. **Create org + project**
   - State: Complete when project is created
2. **Register first agent**
   - State: Configured -> Connected once heartbeat + first event
3. **Choose policy preset**
   - Options: General Agent / Healthcare / Finance
   - State: Applied (records guardrail + threat protections)
4. **Generate agent key + snippet**
   - State: Copy-ready; no runtime changes beyond LLM wrap
5. **Mandatory demo run**
   - State: Demo activity seeded; incidents created
6. **Readiness label emitted**
   - State: READY / NOT READY, based on enforcement & critical path checks

## Pricing & Metering

ClawOps is metered on **active agents, sessions, incidents, and exports**. No per-token pricing.

| Tier | Intended Use | Key Capabilities | Metering Basis |
| --- | --- | --- | --- |
| Community (Free) | Individuals, early pilots | 1 active agent, metadata-only telemetry, basic guardrails | Active agents, sessions |
| Pro | Teams & startups | Multi-agent monitoring, approvals + auto-pause, redacted telemetry, WhatsApp/SMS | Active agents, sessions, incidents |
| Enterprise | Regulated orgs | Full-fidelity telemetry (local/hybrid), evidence bundles, advanced approvals, self-hosted | Active agents, sessions, incidents, exports |

## Distribution Checklist

### ClawBot Ecosystem (No Dependency)
- Drop-in connector + base URL proxy
- \"Works with ClawBot\" positioning
- No ClawBot UI changes required

### SimpleClaw / Emergent-style Builders
- Copy-paste runtime setup
- Opinionated guardrail presets
- Safe templates ready

### Direct Developer Adoption
- Docker quickstart
- `npm run clawops:check` surfaced early
- SDK optional, never required
- CLI quickstart: `npm run clawops:quickstart`

## Growth & Retention Loops

- Guardrail template marketplace
- Shareable safety scorecards
- Compliance export as proof artifact
- Incident-driven re-engagement
- Partner badges: \"ClawOps-Protected\"

## Internal Guardrails (Non-Negotiable)

These safeguards must never be bypassed:

- RBAC enforced for all sensitive actions
- Readiness gating must remain active
- Audit logs are append-only and reproducible
- Demo requirement for launch validation
- `clawops:check` must run without warnings
- Feature gates enforced at execution time
- Proxy failures default to safest behavior
- Secrets never logged

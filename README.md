---
classification: Documentation
last_reviewed: '2026-02-06'
start_date: '2026-01-01'
---
# 🧠 ClawOps — mission control for live AI agents

> **Operations, safety, and governance for agents running in public channels.**

## 🎯 Overview

ClawOps is the control plane for AI agents deployed in Telegram, Discord, WhatsApp, and SMS. It gives non-technical teams a clear, safe way to operate agents in production: see what’s running, spot risk early, and intervene when needed.

ClawOps is **not** an agent framework or chatbot builder. It’s the operations layer for agents you already run. You don’t rebuild agents to make them safe — you operate them safely after they’re deployed.

[![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](LICENSE.md)
[![Docs](https://img.shields.io/badge/docs-clawops.ai-0a66c2.svg)](https://clawops.ai)
[![Checks](https://img.shields.io/badge/checks-clawops%3Acheck-2ea043.svg)](https://clawops.ai)
[![Community](https://img.shields.io/badge/community-x.com%2Fclawops-111111.svg)](https://x.com/clawops)

---

## Get started

- Docs & overview: <https://clawops.ai>
- Launch & packaging: `docs/LAUNCH.md`
- Deployment guide: `DEPLOYMENT.md`
- Contributing: `CONTRIBUTING.md`
- Updates: <https://x.com/clawops>

---

## What ClawOps does

**Control**

- Agent status, pause/resume, and kill switch
- Channel-first onboarding (no CLI, no YAML required for hosted)
- Human-readable activity timelines

**Guardrails**

- Simple safety toggles mapped to policy rules
- Blocks for direct injection rules
- Auto-pause on repeated risk

**Visibility**

- Activity timelines with technical details on demand
- Risk scoring and safety trends
- OpenTelemetry-compatible traces under the hood

---

## Deployment modes

ClawOps ships in three official modes — all backed by the same codebase, guardrail semantics, and audit guarantees:

1. **Hosted ClawOps (SaaS)**  
   Control plane hosted by ClawOps. Data handling is **metadata-only** by default, with full-fidelity opt-in.

2. **Hybrid ClawOps (Recommended)**  
   Hosted control plane + self-hosted Edge connector and decision cache. Raw data stays local; incidents and metadata sync.

3. **Fully Self-Hosted ClawOps**  
   Control plane and Edge deployed on your infrastructure. No external dependencies; licensing + support hooks only.

For full packaging details, see `docs/LAUNCH.md`.

---

## Supported channels

- Telegram
- Discord
- WhatsApp
- SMS
- Slack

---

## Runtime compatibility

ClawOps wraps your existing LLM client and works with:

- OpenAI, Anthropic, Bedrock, Groq, Mistral, Azure, and more
- Any REST-based model gateway

---

## 5-minute agent protection

ClawOps onboarding is designed for non-technical teams:

1. Create org + project
2. Register your first agent
3. Choose a guardrail preset (General Agent / Healthcare / Finance)
4. Generate agent key + connector snippet
5. **Run the mandatory demo**
6. Readiness label is emitted automatically
---

## Quick start (self-hosted)

### Prerequisites

- Docker and Docker Compose
- Git

### Step 1: Clone and setup

```bash
git clone <your-repository-url>
cd clawops
```

### Step 2: Create environment file

Create a `.env` file in the project root with minimal required variables:

**Linux/Mac:**

```bash
cat > .env << 'EOF'
# Database (required)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
CLAWOPS_ENGINE_DB_NAME=clawops_engine

# ClickHouse (required)
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=clickhouse_password

# Security tokens (required - generate random strings)
SHARED_SECRET_TOKEN=$(openssl rand -hex 32)
AEAD_SECRET_KEY=$(openssl rand -hex 32)
CLAWOPS_ENGINE_API_KEY=$(openssl rand -hex 16)
NEXTAUTH_SECRET=$(openssl rand -hex 32)
CLAWOPS_ENGINE_URL=http://localhost:8006

# LLM Configuration (optional - for guardrail checks)
OPENAI_API_KEY=your-openai-key-here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=gpt-4o-mini
EOF
```

**Windows (PowerShell):**

```powershell
@"
# Database (required)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
CLAWOPS_ENGINE_DB_NAME=clawops_engine

# ClickHouse (required)
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=clickhouse_password

# Security tokens (required - replace with random strings)
SHARED_SECRET_TOKEN=replace-with-random-32-char-string
AEAD_SECRET_KEY=replace-with-random-32-char-string
CLAWOPS_ENGINE_API_KEY=replace-with-random-16-char-string
NEXTAUTH_SECRET=replace-with-random-32-char-string
CLAWOPS_ENGINE_URL=http://localhost:8006

# LLM Configuration (optional - for guardrail checks)
OPENAI_API_KEY=your-openai-key-here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=gpt-4o-mini
"@ | Out-File -FilePath .env -Encoding utf8
```

**Or use the example file:**

```bash
cp .env.example .env
# Then edit .env and replace placeholder values
```

### Step 3: Start services

```bash
docker compose -f docker-compose.yml up -d
```

This starts all services:

- **ClawOps UI** → <http://localhost:3000>
- **ClawOps Core API** → <http://localhost:8006>
- **Observability Backend** → <http://localhost:8000>
- **PostgreSQL** → localhost:5433
- **ClickHouse** → localhost:8123
- **Quickwit** → <http://localhost:7280>

### Step 4: Run safety checks

```bash
cd frontend
npm run clawops:check
```

### Step 5: Access the dashboard

Open your browser and go to **<http://localhost:3000>**

**CLI quickstart (optional):**

```bash
cd frontend
npm run clawops:quickstart
```

---

## Connect your first agent

1. Connect a channel (Telegram, Discord, WhatsApp, SMS)
2. Name your agent
3. Choose a guardrail preset
4. Copy the runtime snippet
5. Run the mandatory demo
6. Go live

---

## Runtime integration (copy‑paste)

ClawOps connects to your agent runtime with no logic changes — wrap your LLM client.

### Node / TypeScript

```ts
import { ClawOps } from "@clawops/runtime";

const clawops = new ClawOps({
  apiKey: process.env.CLAWOPS_API_KEY,
  agentId: "support-bot",
  channel: "telegram"
});

const llm = clawops.wrapLLM(openai);
```

### Python

```python
from clawops import ClawOps
import os

clawops = ClawOps(
  api_key=os.getenv("CLAWOPS_API_KEY"),
  agent_id="support-bot",
  channel="telegram"
)

llm = clawops.wrap_llm(openai_client)
```

Replace your LLM client with the wrapped version. The first request appears in Activity and Incidents.

### Runtime environment variables

```bash
export CLAWOPS_API_KEY=your-api-key-from-dashboard
export AGENT_ID=your-agent-id
```

---

## Activity & incidents (reading the results)

Every risky or blocked action becomes an **Incident** with clear context:

- **What happened**
- **Why it happened** (guardrail or threat protection)
- **What was prevented**

Technical details are available behind a toggle for engineers.

---

## Guardrails & threat protection

Guardrails are presets you can understand:

- Safe
- Balanced
- Autonomous

Threat protection groups detections by:

- Jailbreaks
- Data exfiltration
- Prompt injection
- Policy manipulation

---

## Audit & compliance

ClawOps provides:

- Immutable audit logs
- CSV/JSON exports
- Evidence bundles for regulated reviews

---

## Pricing & metering

ClawOps is metered on **active agents, sessions, incidents, and exports** — never per token.

- **Community (Free)**: 1 active agent, metadata-only telemetry, basic guardrails
- **Pro**: multi-agent monitoring, approvals + auto-pause, redacted telemetry, WhatsApp/SMS
- **Enterprise**: full-fidelity telemetry (local or hybrid), evidence bundles, advanced approvals, self-hosted

---

## Production deployment

For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

**Quick production commands:**

```bash
# Build and push images
.\scripts\build-and-push.ps1 -VersionTag v1.0.0  # Windows
./scripts/build-and-push.sh v1.0.0                # Linux/Mac

# Deploy
docker compose -f docker-compose.prod.yml up -d
```

---

## CLI checks

```bash
cd frontend
npm run clawops:check
```

ClawOps enforces:

- No secrets in logs
- Append-only audit logs
- Rate limits at runtime boundaries
- Readiness gating

---

## FAQ

**Is ClawOps an agent framework?**  
No. It’s the operations layer for agents you already run.

**Do I need ClawBot UI changes?**  
No. ClawOps connects via a runtime wrapper and works with existing bots.

**Can I run locally or in regulated environments?**  
Yes. Hybrid and fully self-hosted modes keep raw data local.

---

## Citing ClawOps

If you reference ClawOps in a paper or audit, use:

```bibtex
@software{clawops,
  title={{ClawOps: Mission Control for AI Agents}},
  author={ClawOps Team},
  year={2026},
  howpublished={\url{https://clawops.ai}}
}
```

---

## 📄 License

ClawOps is licensed under Apache 2.0. See [LICENSE.md](LICENSE.md).


## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.


## 📞 Contact

For support and inquiries:
- Email: support@elloe.ai
- Deployment Guide: [DEPLOYMENT.md](DEPLOYMENT.md)
- Operations Guide: [README_DEPLOY.md](README_DEPLOY.md)

---

<div align="center">
  <p>Built with ❤️ by the Elloe AI Labs Team</p>
  <p>© 2026 Elloe AI Labs. All rights reserved.</p>
</div> 

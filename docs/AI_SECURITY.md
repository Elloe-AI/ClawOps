# ClawOps AI Safety & Guardrails

ClawOps is the control plane for AI agents running in public channels. This document explains the safety engine that powers ClawOps guardrails, blocks, and activity review.

## Terminology (ClawOps UI -> Engine)

- Guardrails -> Policies
- Threat Protection -> Shields
- Activity -> Traces (engine internal)
- Checks -> Evaluations

## Getting Started

### Runtime setup

1. Get your API credentials from the ClawOps dashboard at http://localhost:3000 (or your hosted instance).

2. Set runtime environment variables:

```bash
export CLAWOPS_API_KEY=your-api-key-here
export AGENT_ID=your-agent-id-here
export CLAWOPS_ENGINE_URL=http://localhost:8006
```

3. Wrap your runtime:

Node / TypeScript:

```ts
import { ClawOps } from "@clawops/runtime";

const clawops = new ClawOps({
  apiKey: process.env.CLAWOPS_API_KEY,
  agentId: "support-bot",
  channel: "telegram"
});

const llm = clawops.wrapLLM(openai);
```

Python:

```python
from clawops import ClawOps

clawops = ClawOps(
  api_key=os.getenv("CLAWOPS_API_KEY"),
  agent_id="support-bot",
  channel="telegram"
)

llm = clawops.wrap_llm(openai_client)
```

4. Configure Guardrails in the ClawOps UI. Guardrails map to engine policies internally.

## Architecture (High Level)

ClawOps runs two primary services:

1. ClawOps UI (port 3000)
   - Agent setup, guardrails, activity review

2. ClawOps Engine (clawops-engine) (port 8006)
   - Multi-stage analysis (input check, model check, quarantine)
   - Guardrail decisions and blocks

Observability data (spans, metrics, activity history) is stored in ClickHouse and served via the observability backend.

## Guardrails and Threat Protection

### Guardrails

Guardrails are simple toggles in the ClawOps UI that map to policy rules under the hood. Typical controls include:
- Block instruction overrides
- Ask before risky actions
- Limit response frequency
- Pause on uncertainty
- Disable external tools

### Threat Protection

Threat Protection uses curated detectors for direct prompt injection and exfiltration attempts. Use it to scan user input, emails, documents, or web content before it reaches your agent.

## Multi-Stage Safety Checks

The engine performs layered checks to detect prompt injection and unsafe tool usage:

- Input check (Prompt Guard): Fast detection on inputs and tool results
- Model check: LLM-based structured analysis for risky behavior
- Quarantine: Optional two-stage simulation for complex or indirect attacks

Each check contributes to a final decision (ALLOWED, BLOCKED, or REVIEW_REQUIRED).

## Threat Categories (S1-S14)

The engine classifies risk into 14 categories (S1-S14), including:
- Violent Crimes, Non-Violent Crimes, Sexual Content, Child Exploitation
- Privacy, IP, Weapons, Hate, Self-Harm, Elections, Code Abuse

Technical indicators include:
- instruction_injection
- contextual_blending
- function_call_attempt
- hidden_instructions

## Best Practices

1. Start with guardrails: Enable safe defaults before going live.
2. Use threat protection for direct input: Scan external content before the model sees it.
3. Review activity regularly: Use Activity timelines to understand decisions.
4. Tune thresholds over time: Reduce false positives while keeping safety intact.

## Resources

- ClawOps: https://clawops.ai
- Deployment Guide: [DEPLOYMENT.md](../DEPLOYMENT.md)
- Contributing Guide: [CONTRIBUTING.md](../CONTRIBUTING.md)
- Support: support@elloe.ai

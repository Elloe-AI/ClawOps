import { desc, eq } from "drizzle-orm";

import { Shield } from "@/lib/actions/shields";
import { db } from "@/lib/db/drizzle";
import { agents } from "@/lib/db/migrations/schema";
import { categorizeShield } from "@/lib/threat-protection/categories";

const CLAWOPS_ENGINE_URL = process.env.CLAWOPS_ENGINE_URL || "http://localhost:8006";

export const DEFAULT_GUARDRAILS = {
  blockInstructionOverrides: true,
  askBeforeRiskyActions: true,
  limitResponseFrequency: true,
  pauseOnUncertainty: true,
  disableExternalTools: false,
};

const GUARDRAIL_RULE_TAG = "clawops_guardrails";

const getLmnrHeaders = (session: any): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (session?.user) {
    if (session.user.id) headers["X-LMNR-User-Id"] = session.user.id;
    if (session.user.email) headers["X-LMNR-User-Email"] = session.user.email;
    if (session.user.name) headers["X-LMNR-User-Name"] = session.user.name;
  }

  const apiKey = process.env.CLAWOPS_ENGINE_API_KEY;
  if (apiKey) {
    headers["X-LMNR-API-Key"] = apiKey;
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  return headers;
};

const buildContextRules = (guardrails: Record<string, any>, existingRules: any[] = []) => {
  const preservedRules = existingRules.filter((rule) => rule?.source !== GUARDRAIL_RULE_TAG);

  if (!guardrails.blockInstructionOverrides) {
    return preservedRules;
  }

  const guardrailRules = [
    {
      source: GUARDRAIL_RULE_TAG,
      function: "*",
      condition: {
        contains_keywords: [
          "ignore previous",
          "override system",
          "forget instructions",
          "reveal system prompt",
          "jailbreak",
        ],
        severity: ">=low",
      },
      action: {
        block: true,
        reason: "Instruction override attempt detected",
      },
    },
  ];

  return [...preservedRules, ...guardrailRules];
};

const buildPolicyUpdate = (guardrails: Record<string, any>, policy?: Record<string, any> | null) => {
  const customPrompts = {
    ...(policy?.custom_prompts ?? {}),
    guardrails_config: JSON.stringify(guardrails),
  };

  const decision_thresholds = {
    block_threshold: guardrails.blockInstructionOverrides ? 0.55 : 0.7,
    allow_threshold: guardrails.askBeforeRiskyActions ? 0.25 : 0.35,
    use_severity_fallback: true,
    pause_on_uncertainty: guardrails.pauseOnUncertainty,
  };

  const severity_rules = {
    safe: { allow_function_calls: true, allow_output_use: true, block: false },
    low: { allow_function_calls: true, allow_output_use: true, block: false },
    medium: {
      allow_function_calls: false,
      allow_output_use: !guardrails.askBeforeRiskyActions,
      block: false,
    },
    high: { allow_function_calls: false, allow_output_use: false, block: true },
    critical: { allow_function_calls: false, allow_output_use: false, block: true },
  };

  const output_restrictions = {
    "*": {
      cannot_trigger_functions: guardrails.disableExternalTools,
      max_responses_per_minute: guardrails.limitResponseFrequency ? 12 : undefined,
    },
  };

  const function_chaining = {
    "*": guardrails.disableExternalTools
      ? {
          allowed_targets: [],
          blocked_targets: ["*"],
          description: "External tools disabled by guardrails.",
        }
      : {
          allowed_targets: ["*"],
          blocked_targets: [],
          description: "External tools allowed by guardrails.",
        },
  };

  const context_rules = buildContextRules(guardrails, policy?.context_rules ?? []);

  return {
    custom_prompts: customPrompts,
    decision_thresholds,
    severity_rules,
    output_restrictions,
    function_chaining,
    context_rules,
  };
};

export async function getCurrentGuardrailsConfig(projectId: string): Promise<Record<string, any>> {
  const [agent] = await db
    .select({ guardrailsConfig: agents.guardrailsConfig })
    .from(agents)
    .where(eq(agents.projectId, projectId))
    .orderBy(desc(agents.updatedAt))
    .limit(1);

  if (!agent?.guardrailsConfig) {
    return { ...DEFAULT_GUARDRAILS };
  }

  return { ...DEFAULT_GUARDRAILS, ...(agent.guardrailsConfig as Record<string, any>) };
}

export async function updateGuardrailsPolicy(session: any, guardrails: Record<string, any>) {
  const headers = getLmnrHeaders(session);
  const policiesRes = await fetch(`${CLAWOPS_ENGINE_URL}/api/v1/policies`, { method: "GET", headers });
  if (!policiesRes.ok) {
    const error = await policiesRes.text();
    throw new Error(`ClawOps API error: ${error}`);
  }
  const policies = await policiesRes.json();
  const policy = Array.isArray(policies) ? policies.find((p: any) => p.is_default) ?? policies[0] : policies;
  if (!policy?.id) {
    return null;
  }

  const payload = buildPolicyUpdate(guardrails, policy);
  const updateRes = await fetch(`${CLAWOPS_ENGINE_URL}/api/v1/policies/${policy.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

  if (!updateRes.ok) {
    const error = await updateRes.text();
    throw new Error(`ClawOps API error: ${error}`);
  }

  return policy;
}

export async function listShields(session: any): Promise<Shield[]> {
  const headers = getLmnrHeaders(session);
  const res = await fetch(`${CLAWOPS_ENGINE_URL}/api/v1/shields`, { method: "GET", headers });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`ClawOps API error: ${error}`);
  }
  return res.json();
}

export async function setShieldActive(session: any, shieldKey: string, isActive: boolean) {
  const headers = getLmnrHeaders(session);
  const res = await fetch(`${CLAWOPS_ENGINE_URL}/api/v1/shields/${shieldKey}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`ClawOps API error: ${error}`);
  }
  return res.json();
}

export async function applyThreatProtectionConfig(session: any, config: Record<string, any>) {
  const shields = await listShields(session);
  const updates = shields.map(async (shield) => {
    const category = categorizeShield(shield);
    if (category === "other") return null;
    const desired = config[category];
    if (typeof desired !== "boolean") return null;
    if (Boolean(shield.is_active) === desired) return null;
    return setShieldActive(session, shield.shield_key, desired);
  });
  await Promise.all(updates);
}

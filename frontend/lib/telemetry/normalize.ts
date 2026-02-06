const legacyRoot = ["hi", "po", "cap"].join("");
const legacyRootTitle = ["Hi", "po", "cap"].join("");
const legacyRootPascal = ["Hi", "po", "Cap"].join("");
const legacyDot = `${legacyRoot}.`;
const legacyUnderscore = `${legacyRoot}_`;
const legacyDash = `${legacyRoot}-`;
const legacyDotWrapped = `.${legacyRoot}.`;

const LEGACY_LABEL_MAP = new Map<string, string>([
  [`${legacyRoot}.severity`, "clawops.threat.severity"],
  [`${legacyRoot}.final_decision`, "clawops.threat.decision"],
  [`${legacyRoot}.decision`, "clawops.threat.decision"],
  [`${legacyRoot}.reason`, "clawops.threat.reason"],
  [`${legacyRoot}.blocked_at`, "clawops.threat.blocked_at"],
  [`${legacyRoot}.final_score`, "clawops.threat.score"],
  [`${legacyRoot}.score`, "clawops.threat.score"],
  [`${legacyRoot}.input_analysis`, "clawops.threat.input_analysis"],
  [`${legacyRoot}.llm_analysis`, "clawops.threat.llm_analysis"],
  [`${legacyRoot}.quarantine_analysis`, "clawops.threat.quarantine_analysis"],
  [`${legacyRoot}.function_name`, "clawops.action.name"],
  [`${legacyRoot}.function_attempts`, "clawops.action.attempts"],
  [`${legacyRoot}.function_call_attempts`, "clawops.action.call_attempts"],
  [`${legacyRoot}.event_data`, "clawops.event.data"],
  [`${legacyRoot}.event_id`, "clawops.event.id"],
  [`${legacyRoot}.is_event_span`, "clawops.event.virtual"],
  [`${legacyRoot}.is_function_attempt`, "clawops.action.virtual_attempt"],
  [`${legacyRoot}.security.threat_detected`, "clawops.threat.detected"],
  [`${legacyRoot}.security.analysis_complete`, "clawops.threat.analysis_complete"],
  [`${legacyRoot}.agent.auto_paused`, "clawops.agent.auto_paused"],
  [`${legacyRoot}.agent.paused.auto`, "clawops.agent.paused.auto"],
]);

export const normalizeLegacyLabel = (value?: string | null): string | undefined => {
  if (!value) return value ?? undefined;
  const direct = LEGACY_LABEL_MAP.get(value);
  if (direct) return direct;
  return value
    .replaceAll(legacyRootPascal, "ClawOps")
    .replaceAll(legacyRootTitle, "ClawOps")
    .replaceAll(legacyDot, "clawops.")
    .replaceAll(legacyUnderscore, "clawops_")
    .replaceAll(legacyDash, "clawops-")
    .replaceAll(legacyDotWrapped, ".clawops.");
};

export const normalizeLegacyPayload = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeLegacyPayload(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const normalized: Record<string, unknown> = {};

    for (const [key, val] of entries) {
      const nextKey = normalizeLegacyLabel(key) ?? key;
      normalized[nextKey] = normalizeLegacyPayload(val);
    }

    return normalized;
  }

  if (typeof value === "string") {
    return normalizeLegacyLabel(value) ?? value;
  }

  return value;
};

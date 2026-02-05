import { Shield } from "@/lib/actions/shields";

export type ThreatCategory = "jailbreaks" | "data_exfiltration" | "prompt_injection" | "policy_manipulation" | "other";

export const THREAT_CATEGORY_LABELS: Record<ThreatCategory, string> = {
  jailbreaks: "Jailbreaks",
  data_exfiltration: "Data exfiltration",
  prompt_injection: "Prompt injection",
  policy_manipulation: "Policy manipulation",
  other: "Other",
};

const normalize = (value?: string | null) => (value ?? "").toLowerCase();

export const mapThreatCategory = (value?: string | null): ThreatCategory => {
  const text = normalize(value);
  if (!text) return "other";
  if (text.includes("jailbreak") || text.includes("prompt-guard") || text.includes("promptguard")) {
    return "jailbreaks";
  }
  if (text.includes("exfil") || text.includes("data leak") || text.includes("sensitive") || text.includes("pii")) {
    return "data_exfiltration";
  }
  if (text.includes("prompt injection") || text.includes("injection")) {
    return "prompt_injection";
  }
  if (text.includes("policy") || text.includes("override") || text.includes("system")) {
    return "policy_manipulation";
  }
  return "other";
};

export const categorizeShield = (shield: Shield): ThreatCategory => {
  const key = normalize(shield.shield_key);
  const name = normalize(shield.name);
  const description = normalize(shield.description ?? "");

  if (key || name || description) {
    return mapThreatCategory([key, name, description].join(" "));
  }
  return "other";
};

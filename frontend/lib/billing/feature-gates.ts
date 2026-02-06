import { createProductEvent } from "@/lib/actions/product-events";
import { getProjectDetails } from "@/lib/actions/project";
import { logAuditEntry } from "@/lib/actions/audit-log";

export type FeatureGate =
  | "approval_queue"
  | "auto_pause"
  | "whatsapp_sms"
  | "audit_exports"
  | "multi_agent_monitoring";

export class FeatureGateError extends Error {
  feature: FeatureGate;
  status: number;
  constructor(feature: FeatureGate, message: string) {
    super(message);
    this.feature = feature;
    this.status = 402;
  }
}

const isFreeTierName = (tierName?: string | null) =>
  typeof tierName === "string" && tierName.toLowerCase().trim() === "free";

export async function assertFeatureAccess(params: {
  projectId: string;
  feature: FeatureGate;
  userId?: string | null;
  source?: string;
  metadata?: Record<string, any>;
}) {
  const { projectId, feature, userId, source, metadata } = params;
  const project = await getProjectDetails(projectId);
  const locked = project.isFreeTier || isFreeTierName(project.tierName);

  if (!locked) return;

  const reasonMap: Record<FeatureGate, string> = {
    approval_queue: "Approval queue is available on Pro or Enterprise plans.",
    auto_pause: "Auto-pause is available on Pro or Enterprise plans.",
    whatsapp_sms: "WhatsApp and SMS connections require a Pro or Enterprise plan.",
    audit_exports: "Audit exports are available on Pro or Enterprise plans.",
    multi_agent_monitoring: "Multi-agent monitoring is available on Pro or Enterprise plans.",
  };

  const message = reasonMap[feature] ?? "This feature is locked on the current plan.";

  try {
    await logAuditEntry({
      projectId,
      actorUserId: userId ?? null,
      action: "feature_gate_blocked",
      entityType: "feature",
      entityId: feature,
      metadata: {
        source: source ?? "api",
        feature,
        message,
        ...(metadata ?? {}),
      },
    });
  } catch (error) {
    console.error("Failed to log feature gate audit entry:", error);
  }

  try {
    await createProductEvent({
      name: "upgrade_clicked",
      projectId,
      userId: userId ?? null,
      metadata: {
        source: source ?? "feature_gate",
        feature,
        ...(metadata ?? {}),
      },
    });
  } catch (error) {
    console.error("Failed to log upgrade intent:", error);
  }

  throw new FeatureGateError(feature, message);
}

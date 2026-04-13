import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod/v4";

import { createHash } from "crypto";

import { logAuditEntry } from "@/lib/actions/audit-log";
import { db } from "@/lib/db/drizzle";
import { safetyTemplateApplications, safetyTemplates } from "@/lib/db/migrations/schema";
import { stableJsonStringify } from "@/lib/utils/stable-json";

const TemplateVisibilitySchema = z.enum(["private", "marketplace"]);

const SafetyTemplateSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  version: z.number().int().min(1).optional(),
  guardrailsConfig: z.record(z.string(), z.any()),
  threatProtectionConfig: z.record(z.string(), z.any()),
  visibility: TemplateVisibilitySchema.optional(),
  isPublished: z.boolean().optional(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional(),
});

const ListTemplatesSchema = z.object({
  projectId: z.string().uuid().optional(),
  includeMarketplace: z.boolean().optional(),
});

const ApplyTemplateSchema = z.object({
  projectId: z.string().uuid(),
  templateId: z.string().uuid(),
  appliedBy: z.string().uuid().optional(),
  previousGuardrailsConfig: z.record(z.string(), z.any()),
  previousThreatProtectionConfig: z.record(z.string(), z.any()),
  newGuardrailsConfig: z.record(z.string(), z.any()),
  newThreatProtectionConfig: z.record(z.string(), z.any()),
});

const RevertTemplateSchema = z.object({
  projectId: z.string().uuid(),
  applicationId: z.string().uuid(),
  revertedBy: z.string().uuid().optional(),
});

export async function createSafetyTemplate(input: z.infer<typeof SafetyTemplateSchema>) {
  const payload = SafetyTemplateSchema.parse(input);
  const checksum = createTemplateChecksum(payload.guardrailsConfig, payload.threatProtectionConfig);

  const [template] = await db
    .insert(safetyTemplates)
    .values({
      projectId: payload.projectId ?? null,
      name: payload.name,
      description: payload.description ?? null,
      version: payload.version ?? 1,
      guardrailsConfig: payload.guardrailsConfig,
      threatProtectionConfig: payload.threatProtectionConfig,
      visibility: payload.visibility ?? "private",
      isPublished: payload.isPublished ?? false,
      publishedAt: payload.isPublished ? new Date().toISOString() : null,
      checksum,
      createdBy: payload.createdBy ?? null,
      updatedBy: payload.updatedBy ?? null,
    })
    .returning();

  if (!template) {
    throw new Error("Failed to create safety template");
  }

  return template;
}

export async function listSafetyTemplates(input: z.infer<typeof ListTemplatesSchema>) {
  const { projectId, includeMarketplace } = ListTemplatesSchema.parse(input);
  const whereClause = projectId && includeMarketplace
    ? or(eq(safetyTemplates.projectId, projectId), eq(safetyTemplates.visibility, "marketplace"))
    : projectId
      ? eq(safetyTemplates.projectId, projectId)
      : includeMarketplace
        ? eq(safetyTemplates.visibility, "marketplace")
        : undefined;

  return db.query.safetyTemplates.findMany({
    where: whereClause,
    orderBy: desc(safetyTemplates.createdAt),
  });
}

export async function getSafetyTemplateById(templateId: string) {
  return db.query.safetyTemplates.findFirst({
    where: eq(safetyTemplates.id, templateId),
  });
}

export async function updateSafetyTemplate(templateId: string, input: z.infer<typeof SafetyTemplateSchema>) {
  const payload = SafetyTemplateSchema.parse(input);
  const existing = await getSafetyTemplateById(templateId);
  if (!existing) {
    throw new Error("Safety template not found");
  }
  if (existing.isPublished && existing.visibility === "marketplace") {
    throw new Error("Marketplace templates are immutable once published");
  }

  const checksum = createTemplateChecksum(payload.guardrailsConfig, payload.threatProtectionConfig);

  const [updated] = await db
    .update(safetyTemplates)
    .set({
      name: payload.name,
      description: payload.description ?? null,
      version: payload.version ?? existing.version,
      guardrailsConfig: payload.guardrailsConfig,
      threatProtectionConfig: payload.threatProtectionConfig,
      visibility: payload.visibility ?? existing.visibility,
      isPublished: payload.isPublished ?? existing.isPublished,
      publishedAt: payload.isPublished && !existing.publishedAt ? new Date().toISOString() : existing.publishedAt,
      checksum,
      updatedBy: payload.updatedBy ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(safetyTemplates.id, templateId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update safety template");
  }

  return updated;
}

export async function publishSafetyTemplate(templateId: string, userId?: string) {
  const existing = await getSafetyTemplateById(templateId);
  if (!existing) {
    throw new Error("Safety template not found");
  }
  if (existing.isPublished) {
    return existing;
  }

  const [updated] = await db
    .update(safetyTemplates)
    .set({
      isPublished: true,
      publishedAt: new Date().toISOString(),
      updatedBy: userId ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(safetyTemplates.id, templateId))
    .returning();

  if (!updated) {
    throw new Error("Failed to publish safety template");
  }

  return updated;
}

export async function applySafetyTemplate(input: z.infer<typeof ApplyTemplateSchema>) {
  const payload = ApplyTemplateSchema.parse(input);

  const [application] = await db
    .insert(safetyTemplateApplications)
    .values({
      projectId: payload.projectId,
      templateId: payload.templateId,
      appliedBy: payload.appliedBy ?? null,
      previousGuardrailsConfig: payload.previousGuardrailsConfig,
      previousThreatProtectionConfig: payload.previousThreatProtectionConfig,
      newGuardrailsConfig: payload.newGuardrailsConfig,
      newThreatProtectionConfig: payload.newThreatProtectionConfig,
    })
    .returning();

  if (!application) {
    throw new Error("Failed to log template application");
  }

  await logAuditEntry({
    projectId: payload.projectId,
    actorUserId: payload.appliedBy ?? null,
    action: "safety_template_applied",
    entityType: "safety_template",
    entityId: payload.templateId,
    before: {
      guardrails: payload.previousGuardrailsConfig,
      threatProtection: payload.previousThreatProtectionConfig,
    },
    after: {
      guardrails: payload.newGuardrailsConfig,
      threatProtection: payload.newThreatProtectionConfig,
    },
    metadata: {
      applicationId: application.id,
    },
  });

  return application;
}

export async function revertSafetyTemplate(input: z.infer<typeof RevertTemplateSchema>) {
  const payload = RevertTemplateSchema.parse(input);
  const application = await db.query.safetyTemplateApplications.findFirst({
    where: and(eq(safetyTemplateApplications.projectId, payload.projectId), eq(safetyTemplateApplications.id, payload.applicationId)),
  });

  if (!application) {
    throw new Error("Template application not found");
  }

  const [updated] = await db
    .update(safetyTemplateApplications)
    .set({
      revertedAt: new Date().toISOString(),
      revertedBy: payload.revertedBy ?? null,
    })
    .where(eq(safetyTemplateApplications.id, payload.applicationId))
    .returning();

  if (!updated) {
    throw new Error("Failed to mark template application as reverted");
  }

  await logAuditEntry({
    projectId: payload.projectId,
    actorUserId: payload.revertedBy ?? null,
    action: "safety_template_reverted",
    entityType: "safety_template_application",
    entityId: payload.applicationId,
    before: {
      guardrails: application.newGuardrailsConfig,
      threatProtection: application.newThreatProtectionConfig,
    },
    after: {
      guardrails: application.previousGuardrailsConfig,
      threatProtection: application.previousThreatProtectionConfig,
    },
    metadata: {
      templateId: application.templateId,
    },
  });

  return updated;
}

export function createTemplateChecksum(guardrailsConfig: Record<string, any>, threatProtectionConfig: Record<string, any>) {
  const payload = stableJsonStringify({ guardrailsConfig, threatProtectionConfig });
  return createHash("sha256").update(payload).digest("hex");
}

export async function ensureMarketplaceTemplates() {
  const existing = await db.query.safetyTemplates.findMany({
    where: eq(safetyTemplates.visibility, "marketplace"),
    columns: {
      id: true,
      name: true,
    },
  });

  const existingNames = new Set(existing.map((template) => template.name));

  const defaults = [
    {
      name: "General Agent",
      description: "Balanced guardrails for public-channel agents. Recommended default.",
      guardrailsConfig: {
        blockInstructionOverrides: true,
        askBeforeRiskyActions: true,
        limitResponseFrequency: true,
        pauseOnUncertainty: true,
        disableExternalTools: false,
      },
      threatProtectionConfig: {
        jailbreaks: true,
        data_exfiltration: true,
        prompt_injection: true,
        policy_manipulation: true,
      },
    },
    {
      name: "Healthcare",
      description: "Regulated preset for patient-facing workflows and sensitive data handling.",
      guardrailsConfig: {
        blockInstructionOverrides: true,
        askBeforeRiskyActions: true,
        limitResponseFrequency: true,
        pauseOnUncertainty: true,
        disableExternalTools: true,
      },
      threatProtectionConfig: {
        jailbreaks: true,
        data_exfiltration: true,
        prompt_injection: true,
        policy_manipulation: true,
      },
    },
    {
      name: "Finance",
      description: "High-scrutiny preset for financial workflows, approvals, and PII.",
      guardrailsConfig: {
        blockInstructionOverrides: true,
        askBeforeRiskyActions: true,
        limitResponseFrequency: true,
        pauseOnUncertainty: true,
        disableExternalTools: true,
      },
      threatProtectionConfig: {
        jailbreaks: true,
        data_exfiltration: true,
        prompt_injection: true,
        policy_manipulation: true,
      },
    },
    {
      name: "Safe Operations",
      description: "Strict guardrails with maximum protection across threat categories.",
      guardrailsConfig: {
        blockInstructionOverrides: true,
        askBeforeRiskyActions: true,
        limitResponseFrequency: true,
        pauseOnUncertainty: true,
        disableExternalTools: true,
      },
      threatProtectionConfig: {
        jailbreaks: true,
        data_exfiltration: true,
        prompt_injection: true,
        policy_manipulation: true,
      },
    },
    {
      name: "Balanced Operations",
      description: "Recommended balance between autonomy and oversight.",
      guardrailsConfig: {
        blockInstructionOverrides: true,
        askBeforeRiskyActions: true,
        limitResponseFrequency: true,
        pauseOnUncertainty: true,
        disableExternalTools: false,
      },
      threatProtectionConfig: {
        jailbreaks: true,
        data_exfiltration: true,
        prompt_injection: true,
        policy_manipulation: true,
      },
    },
    {
      name: "Autonomous Operations",
      description: "Minimal friction while keeping core protections.",
      guardrailsConfig: {
        blockInstructionOverrides: true,
        askBeforeRiskyActions: false,
        limitResponseFrequency: false,
        pauseOnUncertainty: false,
        disableExternalTools: false,
      },
      threatProtectionConfig: {
        jailbreaks: true,
        data_exfiltration: true,
        prompt_injection: true,
        policy_manipulation: true,
      },
    },
  ];

  const created = [];
  for (const template of defaults) {
    if (existingNames.has(template.name)) {
      continue;
    }
    const checksum = createTemplateChecksum(template.guardrailsConfig, template.threatProtectionConfig);
    const [row] = await db
      .insert(safetyTemplates)
      .values({
        projectId: null,
        name: template.name,
        description: template.description,
        version: 1,
        guardrailsConfig: template.guardrailsConfig,
        threatProtectionConfig: template.threatProtectionConfig,
        visibility: "marketplace",
        isPublished: true,
        publishedAt: new Date().toISOString(),
        checksum,
      })
      .returning();
    if (row) {
      created.push(row);
    }
  }

  const updated = await db.query.safetyTemplates.findMany({
    where: eq(safetyTemplates.visibility, "marketplace"),
    orderBy: desc(safetyTemplates.createdAt),
  });

  return updated.length > 0 ? updated : created;
}

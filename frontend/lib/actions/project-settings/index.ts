import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { db } from "@/lib/db/drizzle";
import { projectSettings } from "@/lib/db/migrations/schema";

const ProjectSettingSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  value: z.string(),
});

const ThreatProtectionConfigSchema = z.object({
  jailbreaks: z.boolean(),
  data_exfiltration: z.boolean(),
  prompt_injection: z.boolean(),
  policy_manipulation: z.boolean(),
});

export type ThreatProtectionConfig = z.infer<typeof ThreatProtectionConfigSchema>;

export const DEFAULT_THREAT_PROTECTION_CONFIG: ThreatProtectionConfig = {
  jailbreaks: true,
  data_exfiltration: true,
  prompt_injection: true,
  policy_manipulation: true,
};

export async function getProjectSetting(projectId: string, name: string) {
  const row = await db.query.projectSettings.findFirst({
    where: and(eq(projectSettings.projectId, projectId), eq(projectSettings.name, name)),
  });
  return row?.value ?? null;
}

export async function upsertProjectSetting(input: z.infer<typeof ProjectSettingSchema>) {
  const payload = ProjectSettingSchema.parse(input);
  const existing = await db.query.projectSettings.findFirst({
    where: and(eq(projectSettings.projectId, payload.projectId), eq(projectSettings.name, payload.name)),
  });

  if (existing) {
    const [updated] = await db
      .update(projectSettings)
      .set({ value: payload.value })
      .where(eq(projectSettings.id, existing.id))
      .returning();
    if (!updated) {
      throw new Error("Failed to update project setting");
    }
    return updated;
  }

  const [created] = await db
    .insert(projectSettings)
    .values({
      projectId: payload.projectId,
      name: payload.name,
      value: payload.value,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create project setting");
  }

  return created;
}

export async function getThreatProtectionConfig(projectId: string): Promise<ThreatProtectionConfig> {
  const stored = await getProjectSetting(projectId, "threat_protection_config");
  if (!stored) return DEFAULT_THREAT_PROTECTION_CONFIG;

  try {
    const parsed = JSON.parse(stored);
    return ThreatProtectionConfigSchema.parse({ ...DEFAULT_THREAT_PROTECTION_CONFIG, ...parsed });
  } catch (error) {
    return DEFAULT_THREAT_PROTECTION_CONFIG;
  }
}

export async function setThreatProtectionConfig(projectId: string, config: ThreatProtectionConfig) {
  const payload = ThreatProtectionConfigSchema.parse(config);
  return upsertProjectSetting({
    projectId,
    name: "threat_protection_config",
    value: JSON.stringify(payload),
  });
}

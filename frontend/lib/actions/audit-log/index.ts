import { z } from "zod/v4";

import { db } from "@/lib/db/drizzle";
import { auditLogEntries } from "@/lib/db/migrations/schema";

const AuditLogEntrySchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  workspaceId: z.string().uuid().optional().nullable(),
  actorUserId: z.string().uuid().optional().nullable(),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().optional().nullable(),
  before: z.record(z.any()).optional().nullable(),
  after: z.record(z.any()).optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

export type AuditLogEntryInput = z.infer<typeof AuditLogEntrySchema>;

export async function logAuditEntry(input: AuditLogEntryInput) {
  const payload = AuditLogEntrySchema.parse(input);

  const [entry] = await db
    .insert(auditLogEntries)
    .values({
      projectId: payload.projectId ?? null,
      workspaceId: payload.workspaceId ?? null,
      actorUserId: payload.actorUserId ?? null,
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId ?? null,
      before: payload.before ?? null,
      after: payload.after ?? null,
      metadata: payload.metadata ?? {},
    })
    .returning();

  if (!entry) {
    throw new Error("Failed to log audit entry");
  }

  return entry;
}

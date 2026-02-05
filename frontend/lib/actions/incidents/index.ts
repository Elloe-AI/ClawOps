import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";

import { logAuditEntry } from "@/lib/actions/audit-log";
import { db } from "@/lib/db/drizzle";
import { agentActivityEvents, agents, incidents } from "@/lib/db/migrations/schema";

const IncidentTypeSchema = z.enum([
  "blocked_response",
  "guardrail_triggered",
  "auto_paused",
  "manual_paused",
  "approval_requested",
  "approval_completed",
  "runtime_disconnected",
]);

const IncidentStatusSchema = z.enum(["open", "resolved"]);

const CreateIncidentSchema = z.object({
  projectId: z.string(),
  agentId: z.string(),
  eventId: z.string(),
  traceId: z.string().nullable().optional(),
  incidentType: IncidentTypeSchema,
  category: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  action: z.string().optional().nullable(),
});

const ListIncidentsSchema = z.object({
  projectId: z.string(),
  agentId: z.string().optional(),
  status: IncidentStatusSchema.optional(),
  environment: z.enum(["local", "staging", "prod"]).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

const UpdateIncidentSchema = z.object({
  projectId: z.string(),
  incidentId: z.string(),
  status: IncidentStatusSchema,
  resolvedBy: z.string().uuid().optional(),
});

export type IncidentRecord = typeof incidents.$inferSelect;

export async function createIncident(input: z.infer<typeof CreateIncidentSchema>) {
  const payload = CreateIncidentSchema.parse(input);

  const [incident] = await db
    .insert(incidents)
    .values({
      projectId: payload.projectId,
      agentId: payload.agentId,
      eventId: payload.eventId,
      traceId: payload.traceId ?? null,
      incidentType: payload.incidentType,
      category: payload.category ?? null,
      summary: payload.summary ?? null,
      reason: payload.reason ?? null,
      action: payload.action ?? null,
    })
    .returning();

  if (!incident) {
    throw new Error("Failed to create incident");
  }

  return incident;
}

export async function listIncidents(input: z.infer<typeof ListIncidentsSchema>) {
  const { projectId, agentId, status, environment, limit } = ListIncidentsSchema.parse(input);
  const filters = [eq(incidents.projectId, projectId)];

  if (agentId) {
    filters.push(eq(incidents.agentId, agentId));
  }
  if (status) {
    filters.push(eq(incidents.status, status));
  }
  if (environment) {
    filters.push(eq(agents.environment, environment));
  }

  return db
    .select({
      id: incidents.id,
      projectId: incidents.projectId,
      agentId: incidents.agentId,
      eventId: incidents.eventId,
      traceId: incidents.traceId,
      incidentType: incidents.incidentType,
      status: incidents.status,
      category: incidents.category,
      summary: incidents.summary,
      reason: incidents.reason,
      action: incidents.action,
      createdAt: incidents.createdAt,
      agentName: agents.name,
      agentChannel: agents.channel,
      agentStatus: agents.status,
      agentRiskScore: agents.riskScore,
      agentEnvironment: agents.environment,
      agentConnectionStatus: agents.connectionStatus,
    })
    .from(incidents)
    .innerJoin(agents, eq(incidents.agentId, agents.id))
    .where(and(...filters))
    .orderBy(desc(incidents.createdAt))
    .limit(limit ?? 200);
}

export async function getIncidentByEvent(projectId: string, eventId: string) {
  return db.query.incidents.findFirst({
    where: and(eq(incidents.projectId, projectId), eq(incidents.eventId, eventId)),
  });
}

export async function listIncidentsByEventIds(projectId: string, eventIds: string[]) {
  if (eventIds.length === 0) return [];
  return db
    .select({ incidentId: incidents.id, eventId: incidents.eventId })
    .from(incidents)
    .where(and(eq(incidents.projectId, projectId), inArray(incidents.eventId, eventIds)));
}

export async function updateIncidentStatus(input: z.infer<typeof UpdateIncidentSchema>) {
  const payload = UpdateIncidentSchema.parse(input);

  const existing = await db.query.incidents.findFirst({
    where: and(eq(incidents.projectId, payload.projectId), eq(incidents.id, payload.incidentId)),
  });

  if (!existing) {
    throw new Error("Incident not found");
  }

  const resolvedAt = payload.status === "resolved" ? new Date().toISOString() : null;

  const [updated] = await db
    .update(incidents)
    .set({ status: payload.status, resolvedAt })
    .where(and(eq(incidents.projectId, payload.projectId), eq(incidents.id, payload.incidentId)))
    .returning();

  if (!updated) {
    throw new Error("Failed to update incident");
  }

  await logAuditEntry({
    projectId: payload.projectId,
    actorUserId: payload.resolvedBy ?? null,
    action: payload.status === "resolved" ? "incident_resolved" : "incident_reopened",
    entityType: "incident",
    entityId: payload.incidentId,
    before: { status: existing.status },
    after: { status: payload.status },
  });

  return updated;
}

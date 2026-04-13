import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { db } from "@/lib/db/drizzle";
import { agentApprovals, agents, incidents } from "@/lib/db/migrations/schema";

const ApprovalStatusSchema = z.enum(["pending", "approved", "denied", "expired"]);

const CreateApprovalSchema = z.object({
  projectId: z.string(),
  agentId: z.string(),
  incidentId: z.string(),
  requestedBy: z.string().uuid().optional(),
  requestDetails: z.record(z.string(), z.any()).optional(),
});

const UpdateApprovalSchema = z.object({
  projectId: z.string(),
  approvalId: z.string(),
  status: ApprovalStatusSchema,
  approvedBy: z.string().uuid().optional(),
  responseDetails: z.record(z.string(), z.any()).optional(),
});

const ListApprovalsSchema = z.object({
  projectId: z.string(),
  status: ApprovalStatusSchema.optional(),
  environment: z.enum(["local", "staging", "prod"]).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export type ApprovalRecord = typeof agentApprovals.$inferSelect;

export async function createApproval(input: z.infer<typeof CreateApprovalSchema>) {
  const payload = CreateApprovalSchema.parse(input);

  const [approval] = await db
    .insert(agentApprovals)
    .values({
      projectId: payload.projectId,
      agentId: payload.agentId,
      incidentId: payload.incidentId,
      status: "pending",
      requestedBy: payload.requestedBy ?? null,
      requestDetails: payload.requestDetails ?? {},
      responseDetails: {},
    })
    .returning();

  if (!approval) {
    throw new Error("Failed to create approval request");
  }

  return approval;
}

export async function updateApproval(input: z.infer<typeof UpdateApprovalSchema>) {
  const payload = UpdateApprovalSchema.parse(input);

  const [approval] = await db
    .update(agentApprovals)
    .set({
      status: payload.status,
      approvedBy: payload.approvedBy ?? null,
      responseDetails: payload.responseDetails ?? {},
      respondedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(agentApprovals.projectId, payload.projectId), eq(agentApprovals.id, payload.approvalId)))
    .returning();

  if (!approval) {
    throw new Error("Approval request not found");
  }

  return approval;
}

export async function listApprovals(input: z.infer<typeof ListApprovalsSchema>) {
  const { projectId, status, environment, limit } = ListApprovalsSchema.parse(input);
  const filters = [eq(agentApprovals.projectId, projectId)];
  if (status) filters.push(eq(agentApprovals.status, status));
  if (environment) filters.push(eq(agents.environment, environment));

  return db
    .select({
      id: agentApprovals.id,
      projectId: agentApprovals.projectId,
      agentId: agentApprovals.agentId,
      incidentId: agentApprovals.incidentId,
      status: agentApprovals.status,
      requestDetails: agentApprovals.requestDetails,
      responseDetails: agentApprovals.responseDetails,
      requestedAt: agentApprovals.requestedAt,
      respondedAt: agentApprovals.respondedAt,
      agentName: agents.name,
      agentChannel: agents.channel,
      agentEnvironment: agents.environment,
      incidentSummary: incidents.summary,
      incidentReason: incidents.reason,
      incidentAction: incidents.action,
    })
    .from(agentApprovals)
    .innerJoin(agents, eq(agentApprovals.agentId, agents.id))
    .innerJoin(incidents, eq(agentApprovals.incidentId, incidents.id))
    .where(and(...filters))
    .orderBy(desc(agentApprovals.requestedAt))
    .limit(limit ?? 200);
}

export async function getApproval(projectId: string, approvalId: string) {
  return db.query.agentApprovals.findFirst({
    where: and(eq(agentApprovals.projectId, projectId), eq(agentApprovals.id, approvalId)),
  });
}

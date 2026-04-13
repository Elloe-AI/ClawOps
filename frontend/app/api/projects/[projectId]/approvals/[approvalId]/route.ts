import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { prettifyError, ZodError } from "zod/v4";

import { createAgentEvent } from "@/lib/actions/agents";
import { getApproval, updateApproval } from "@/lib/actions/approvals";
import { updateIncidentStatus } from "@/lib/actions/incidents";
import { logAuditEntry } from "@/lib/actions/audit-log";
import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { assertFeatureAccess, FeatureGateError } from "@/lib/billing/feature-gates";
import { db } from "@/lib/db/drizzle";
import { incidents } from "@/lib/db/migrations/schema";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; approvalId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const params = await props.params;
    await requireProjectRoleAtLeast(params.projectId, "operator");

    const body = await req.json();
    const status = body.status as "approved" | "denied" | "expired" | undefined;
    if (!status || !["approved", "denied"].includes(status)) {
      return new Response(JSON.stringify({ error: "Invalid approval status" }), { status: 400 });
    }

    await assertFeatureAccess({
      projectId: params.projectId,
      feature: "approval_queue",
      userId: session.user.id,
      source: "approval_decision",
    });

    const approval = await getApproval(params.projectId, params.approvalId);
    if (!approval) {
      return new Response(JSON.stringify({ error: "Approval not found" }), { status: 404 });
    }

    if (approval.status !== "pending") {
      return new Response(JSON.stringify({ error: "Approval already processed" }), { status: 409 });
    }

    const updated = await updateApproval({
      projectId: params.projectId,
      approvalId: params.approvalId,
      status,
      approvedBy: session.user.id,
      responseDetails: body.responseDetails ?? {},
    });

    const incident = await db.query.incidents.findFirst({
      where: and(eq(incidents.projectId, params.projectId), eq(incidents.id, approval.incidentId)),
    });

    const traceId = incident?.traceId ?? null;

    if (status === "approved") {
      await createAgentEvent({
        projectId: params.projectId,
        agentId: approval.agentId,
        traceId: traceId ?? undefined,
        eventType: "agent_response_sent",
        summary: "Approval completed",
        reason: "Operator approved the response",
        action: "Response sent",
        details: {
          approvalCompleted: true,
          approvalId: approval.id,
        },
        userId: session.user.id,
      });
    }

    if (status === "denied") {
      await createAgentEvent({
        projectId: params.projectId,
        agentId: approval.agentId,
        traceId: traceId ?? undefined,
        eventType: "agent_response_blocked",
        summary: "Approval denied",
        reason: "Operator denied the response",
        action: "Blocked before sending",
        details: {
          approvalDenied: true,
          approvalId: approval.id,
        },
        userId: session.user.id,
      });
    }

    await updateIncidentStatus({
      projectId: params.projectId,
      incidentId: approval.incidentId,
      status: "resolved",
      resolvedBy: session.user.id,
    });

    await logAuditEntry({
      projectId: params.projectId,
      actorUserId: session.user.id,
      action: "approval_decision",
      entityType: "approval",
      entityId: approval.id,
      metadata: {
        status,
        incidentId: approval.incidentId,
        agentId: approval.agentId,
      },
    });

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating approval:", error);
    if (error instanceof FeatureGateError) {
      return new Response(JSON.stringify({ error: error.message, code: error.feature }), { status: error.status });
    }
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

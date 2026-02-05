import { NextRequest } from "next/server";
import { z } from "zod/v4";

import { createAgentEvent, getAgentByExternalId, recordAgentHeartbeat } from "@/lib/actions/agents";
import { logAuditEntry } from "@/lib/actions/audit-log";
import { getProjectDetails } from "@/lib/actions/project";
import { authenticateRuntime } from "@/lib/runtime/auth";

const EventSchema = z.object({
  agentId: z.string().min(1),
  eventType: z.enum([
    "user_message_received",
    "agent_response_sent",
    "agent_response_blocked",
    "guardrail_triggered",
    "agent_paused_auto",
    "agent_paused_manual",
    "agent_resumed",
  ]),
  traceId: z.string().optional(),
  summary: z.string().optional(),
  reason: z.string().optional(),
  action: z.string().optional(),
  details: z.record(z.any()).optional(),
  environment: z.enum(["local", "staging", "prod"]).optional(),
  partnerId: z.string().optional(),
  runtimeType: z.string().optional(),
  wrapped: z.boolean().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { projectId } = await authenticateRuntime(req.headers);
    const payload = EventSchema.parse(await req.json());

    const agent = await getAgentByExternalId(projectId, payload.agentId);
    if (!agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404 });
    }

    if (payload.environment && payload.environment !== agent.environment) {
      return new Response(
        JSON.stringify({ error: "Environment mismatch", expected: agent.environment }),
        { status: 409 }
      );
    }

    if (agent.status !== "running" && payload.eventType === "agent_response_sent") {
      return new Response(
        JSON.stringify({
          error: "Agent is paused",
          status: agent.status,
          message: "This agent has been temporarily paused for safety.",
        }),
        { status: 409 }
      );
    }

    const project = await getProjectDetails(projectId);
    const isFreeTier = project.isFreeTier;

    if (payload.eventType === "guardrail_triggered" && payload.details?.approvalRequested && isFreeTier) {
      await logAuditEntry({
        projectId,
        action: "approval_queue_blocked",
        entityType: "agent",
        entityId: agent.id,
        metadata: {
          reason: "Approval queue is locked on current plan",
          agentId: agent.externalBotId,
        },
      });

      await createAgentEvent({
        projectId,
        agentId: agent.id,
        traceId: payload.traceId,
        eventType: "agent_response_blocked",
        summary: "Approval required but unavailable",
        reason: "Approval queue is locked on the current plan",
        action: "Blocked before sending",
        details: {
          ...payload.details,
          blockedReason: "approval_queue_locked",
          threatCategory: payload.details?.threatCategory,
        },
        environment: agent.environment,
        partnerId: payload.partnerId,
        runtimeType: payload.runtimeType,
      });

      return new Response(
        JSON.stringify({ error: "Approval queue locked on current plan" }),
        { status: 402 }
      );
    }

    if (payload.eventType === "agent_response_sent" && payload.wrapped !== true) {
      await createAgentEvent({
        projectId,
        agentId: agent.id,
        traceId: payload.traceId,
        eventType: "agent_response_blocked",
        summary: "Unwrapped response blocked",
        reason: "Unwrapped runtime calls are not allowed for connected agents.",
        action: "Blocked before sending",
        details: {
          ...payload.details,
          blockedReason: "unwrapped_runtime",
        },
        environment: agent.environment,
        partnerId: payload.partnerId,
        runtimeType: payload.runtimeType,
      });

      return new Response(
        JSON.stringify({ error: "Unwrapped runtime calls are not allowed" }),
        { status: 403 }
      );
    }

    await recordAgentHeartbeat({
      projectId,
      agentId: agent.id,
      partnerId: payload.partnerId,
      runtimeType: payload.runtimeType,
      environment: agent.environment,
    });

    const event = await createAgentEvent({
      projectId,
      agentId: agent.id,
      traceId: payload.traceId,
      eventType: payload.eventType,
      summary: payload.summary,
      reason: payload.reason,
      action: payload.action,
      details: payload.details,
      environment: agent.environment,
      partnerId: payload.partnerId,
      runtimeType: payload.runtimeType,
    });

    return new Response(JSON.stringify({ status: "recorded", id: event.id }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Runtime event failed";
    return new Response(JSON.stringify({ error: message }), { status: 401 });
  }
}

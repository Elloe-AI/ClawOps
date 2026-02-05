import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { createAgent, createAgentEvent, recordAgentHeartbeat } from "@/lib/actions/agents";
import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { db } from "@/lib/db/drizzle";
import { agents } from "@/lib/db/migrations/schema";

const DEFAULT_GUARDRAILS = {
  blockInstructionOverrides: true,
  askBeforeRiskyActions: true,
  limitResponseFrequency: true,
  pauseOnUncertainty: true,
  disableExternalTools: false,
};

export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ projectId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const params = await props.params;
  const projectId = params.projectId;
  await requireProjectRoleAtLeast(projectId, "operator");

  const demoExternalIds = ["demo-support", "demo-sales"];
  const existing = await db
    .select({ id: agents.id, externalBotId: agents.externalBotId })
    .from(agents)
    .where((table, { and, eq, inArray }) =>
      and(eq(table.projectId, projectId), inArray(table.externalBotId, demoExternalIds))
    );

  if (existing.length === demoExternalIds.length) {
    return new Response(JSON.stringify({ status: "ok", seeded: false }), { status: 200 });
  }

  const supportAgent = await createAgent({
    projectId,
    name: "Support Agent",
    channel: "telegram",
    externalBotId: "demo-support",
    environment: "prod",
    guardrailsConfig: DEFAULT_GUARDRAILS,
    channelConfig: { environment: "prod", demo: true },
    userId: session.user.id,
  });

  const salesAgent = await createAgent({
    projectId,
    name: "Sales Concierge",
    channel: "whatsapp",
    externalBotId: "demo-sales",
    environment: "staging",
    guardrailsConfig: DEFAULT_GUARDRAILS,
    channelConfig: { environment: "staging", demo: true },
    userId: session.user.id,
  });

  await Promise.all([
    recordAgentHeartbeat({ projectId, agentId: supportAgent.id, environment: "prod" }),
    recordAgentHeartbeat({ projectId, agentId: salesAgent.id, environment: "staging" }),
  ]);

  const now = Date.now();

  await createAgentEvent({
    projectId,
    agentId: supportAgent.id,
    eventType: "user_message_received",
    summary: "User messaged Support Agent",
    reason: "Account reset request received",
    action: "Queued for response",
    details: { demo: true },
    createdAt: new Date(now - 1000 * 60 * 4).toISOString(),
  });

  await createAgentEvent({
    projectId,
    agentId: supportAgent.id,
    eventType: "agent_response_sent",
    summary: "Support Agent replied",
    reason: "Provided reset instructions",
    action: "Delivered reply",
    details: { demo: true },
    createdAt: new Date(now - 1000 * 60 * 3).toISOString(),
  });

  await createAgentEvent({
    projectId,
    agentId: salesAgent.id,
    eventType: "guardrail_triggered",
    summary: "Approval requested: sensitive data",
    reason: "Detected request for billing details",
    action: "Awaiting approval",
    details: {
      demo: true,
      approvalRequested: true,
      threatCategory: "data_exfiltration",
    },
    createdAt: new Date(now - 1000 * 60 * 10).toISOString(),
  });

  await createAgentEvent({
    projectId,
    agentId: salesAgent.id,
    eventType: "agent_response_blocked",
    summary: "Blocked response",
    reason: "Prompt injection attempt detected",
    action: "Blocked before sending",
    details: { demo: true, threatCategory: "prompt_injection" },
    createdAt: new Date(now - 1000 * 60 * 8).toISOString(),
  });

  await createAgentEvent({
    projectId,
    agentId: salesAgent.id,
    eventType: "agent_paused_auto",
    summary: "Agent auto-paused",
    reason: "Multiple guardrails triggered",
    action: "Paused for safety",
    details: { demo: true },
    createdAt: new Date(now - 1000 * 60 * 6).toISOString(),
  });

  return new Response(JSON.stringify({ status: "ok", seeded: true }), { status: 201 });
}

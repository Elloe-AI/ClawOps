import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

import { authOptions } from "@/lib/auth";
import { count, eq } from "drizzle-orm";

import { createAgent, getAgents } from "@/lib/actions/agents";
import { getProjectDetails } from "@/lib/actions/project";
import { createProductEvent } from "@/lib/actions/product-events";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { assertFeatureAccess, FeatureGateError } from "@/lib/billing/feature-gates";
import { db } from "@/lib/db/drizzle";
import { agents } from "@/lib/db/migrations/schema";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ projectId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const params = await props.params;
    await requireProjectRoleAtLeast(params.projectId, "viewer");
    const data = await getAgents({ projectId: params.projectId });

    return new Response(JSON.stringify({ items: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching agents:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ projectId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const params = await props.params;
    const body = await req.json();
    await requireProjectRoleAtLeast(params.projectId, "operator");

    const project = await getProjectDetails(params.projectId);
    if (["whatsapp", "sms"].includes(body.channel)) {
      await assertFeatureAccess({
        projectId: params.projectId,
        feature: "whatsapp_sms",
        userId: session.user.id,
        source: "agent_create",
        metadata: { channel: body.channel },
      });
    }

    if (project.isFreeTier) {
      const [{ count: agentCount }] = await db
        .select({ count: count(agents.id) })
        .from(agents)
        .where(eq(agents.projectId, params.projectId));
      if (Number(agentCount) >= 1) {
        await assertFeatureAccess({
          projectId: params.projectId,
          feature: "multi_agent_monitoring",
          userId: session.user.id,
          source: "agent_create",
        });
      }
    }

    const agent = await createAgent({ ...body, projectId: params.projectId, userId: session.user.id });

    try {
      await createProductEvent({
        name: "agent_created",
        userId: session.user.id,
        projectId: params.projectId,
        agentId: agent.id,
        metadata: { channel: agent.channel },
      });
    } catch (error) {
      console.error("Failed to log agent_created event:", error);
    }

    return new Response(JSON.stringify(agent), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating agent:", error);
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

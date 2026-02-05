import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

import { authOptions } from "@/lib/auth";
import { createAgentEvent, getAgent } from "@/lib/actions/agents";

const PAUSED_MESSAGE = "This agent has been temporarily paused for safety.";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; agentId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const params = await props.params;
    const body = await req.json();

    const agent = await getAgent({ projectId: params.projectId, agentId: params.agentId });

    if (!agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404 });
    }

    if (agent.status !== "running") {
      return new Response(
        JSON.stringify({ status: agent.status, message: PAUSED_MESSAGE }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    await createAgentEvent({
      projectId: params.projectId,
      agentId: params.agentId,
      userId: session.user.id,
      traceId: body?.traceId,
      eventType: "user_message_received",
      summary: body?.summary,
      reason: body?.reason,
      action: body?.action,
      details: {
        channelUserId: body?.channelUserId,
        text: body?.text,
        metadata: body?.metadata,
      },
    });

    return new Response(JSON.stringify({ status: "received" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error handling agent message:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

import { authOptions } from "@/lib/auth";
import { getProjectAgentEvents } from "@/lib/actions/agents";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";

const AGENT_ACTIVITY_TYPES = [
  "user_message_received",
  "agent_response_sent",
  "agent_response_blocked",
  "guardrail_triggered",
  "agent_paused_auto",
  "agent_paused_manual",
  "agent_resumed",
  "agent_connected",
  "runtime_disconnected",
] as const;

type AgentActivityType = (typeof AGENT_ACTIVITY_TYPES)[number];
const AGENT_ACTIVITY_TYPE_SET = new Set<string>(AGENT_ACTIVITY_TYPES);

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
    const limitParam = req.nextUrl.searchParams.get("limit");
    const typesParam = req.nextUrl.searchParams.get("types");
    const traceId = req.nextUrl.searchParams.get("traceId") ?? undefined;
    const environment = req.nextUrl.searchParams.get("environment") ?? undefined;

    const limit = limitParam ? Number(limitParam) : undefined;
    const eventTypes = typesParam
      ? typesParam
          .split(",")
          .map((value) => value.trim())
          .filter((value): value is AgentActivityType => AGENT_ACTIVITY_TYPE_SET.has(value))
      : undefined;

    const events = await getProjectAgentEvents({
      projectId: params.projectId,
      limit,
      eventTypes,
      traceId,
      environment: environment as "local" | "staging" | "prod" | undefined,
    });

    return new Response(JSON.stringify({ items: events }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching agent activity:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

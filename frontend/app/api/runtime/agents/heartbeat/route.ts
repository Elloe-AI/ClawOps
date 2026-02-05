import { NextRequest } from "next/server";
import { z } from "zod/v4";

import { getAgentByExternalId, recordAgentHeartbeat } from "@/lib/actions/agents";
import { authenticateRuntime } from "@/lib/runtime/auth";

const HeartbeatSchema = z.object({
  agentId: z.string().min(1),
  environment: z.enum(["local", "staging", "prod"]).optional(),
  partnerId: z.string().optional(),
  runtimeType: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { projectId } = await authenticateRuntime(req.headers);
    const payload = HeartbeatSchema.parse(await req.json());

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

    const updated = await recordAgentHeartbeat({
      projectId,
      agentId: agent.id,
      partnerId: payload.partnerId,
      runtimeType: payload.runtimeType,
      environment: agent.environment,
    });

    return new Response(
      JSON.stringify({
        status: "ok",
        agentId: agent.externalBotId,
        connectionStatus: updated.connectionStatus,
        lastHeartbeatAt: updated.lastHeartbeatAt,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Runtime heartbeat failed";
    return new Response(JSON.stringify({ error: message }), { status: 401 });
  }
}

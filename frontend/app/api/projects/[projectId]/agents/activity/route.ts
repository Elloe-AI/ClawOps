import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

import { authOptions } from "@/lib/auth";
import { getProjectAgentEvents } from "@/lib/actions/agents";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";

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
    const eventTypes = typesParam ? typesParam.split(",").map((value) => value.trim()).filter(Boolean) : undefined;

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

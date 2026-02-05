import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

import { authOptions } from "@/lib/auth";
import { listIncidents } from "@/lib/actions/incidents";
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
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const agentId = req.nextUrl.searchParams.get("agentId") ?? undefined;
    const environment = req.nextUrl.searchParams.get("environment") ?? undefined;
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const incidents = await listIncidents({
      projectId: params.projectId,
      agentId,
      status: status as "open" | "resolved" | undefined,
      environment: environment as "local" | "staging" | "prod" | undefined,
      limit,
    });

    return new Response(JSON.stringify({ items: incidents }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching incidents:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

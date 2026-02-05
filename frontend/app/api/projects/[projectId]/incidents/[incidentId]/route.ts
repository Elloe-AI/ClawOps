import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

import { authOptions } from "@/lib/auth";
import { updateIncidentStatus } from "@/lib/actions/incidents";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; incidentId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const params = await props.params;
    await requireProjectRoleAtLeast(params.projectId, "operator");
    const body = await req.json();

    const updated = await updateIncidentStatus({
      projectId: params.projectId,
      incidentId: params.incidentId,
      status: body.status,
      resolvedBy: session.user.id,
    });

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating incident:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

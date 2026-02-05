import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

import { revertSafetyTemplate } from "@/lib/actions/safety-templates";
import { updateAgentsGuardrailsConfig } from "@/lib/actions/agents";
import { setThreatProtectionConfig } from "@/lib/actions/project-settings";
import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { db } from "@/lib/db/drizzle";
import { safetyTemplateApplications } from "@/lib/db/migrations/schema";
import {
  applyThreatProtectionConfig,
  updateGuardrailsPolicy,
} from "@/lib/safety-templates/operations";

export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ projectId: string; applicationId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const params = await props.params;
    await requireProjectRoleAtLeast(params.projectId, "operator");

    const application = await db.query.safetyTemplateApplications.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.projectId, params.projectId), eq(table.id, params.applicationId)),
    });

    if (!application) {
      return new Response(JSON.stringify({ error: "Template application not found" }), { status: 404 });
    }

    if (application.revertedAt) {
      return new Response(JSON.stringify({ error: "Template already reverted" }), { status: 409 });
    }

    await updateGuardrailsPolicy(session, application.previousGuardrailsConfig ?? {});
    await updateAgentsGuardrailsConfig({
      projectId: params.projectId,
      guardrailsConfig: application.previousGuardrailsConfig ?? {},
    });

    await applyThreatProtectionConfig(session, application.previousThreatProtectionConfig ?? {});
    await setThreatProtectionConfig(params.projectId, application.previousThreatProtectionConfig ?? {});

    const reverted = await revertSafetyTemplate({
      projectId: params.projectId,
      applicationId: params.applicationId,
      revertedBy: session.user.id,
    });

    return new Response(JSON.stringify(reverted), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error reverting safety template:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

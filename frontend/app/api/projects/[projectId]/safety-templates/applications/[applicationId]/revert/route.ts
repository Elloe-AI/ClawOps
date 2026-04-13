import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { prettifyError, ZodError } from "zod/v4";

import { revertSafetyTemplate } from "@/lib/actions/safety-templates";
import { updateAgentsGuardrailsConfig } from "@/lib/actions/agents";
import { DEFAULT_THREAT_PROTECTION_CONFIG, setThreatProtectionConfig } from "@/lib/actions/project-settings";
import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { db } from "@/lib/db/drizzle";
import { safetyTemplateApplications } from "@/lib/db/migrations/schema";
import {
  DEFAULT_GUARDRAILS,
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
      where: and(
        eq(safetyTemplateApplications.projectId, params.projectId),
        eq(safetyTemplateApplications.id, params.applicationId)
      ),
    });

    if (!application) {
      return new Response(JSON.stringify({ error: "Template application not found" }), { status: 404 });
    }

    if (application.revertedAt) {
      return new Response(JSON.stringify({ error: "Template already reverted" }), { status: 409 });
    }

    const previousGuardrailsConfig =
      (application.previousGuardrailsConfig as Record<string, unknown> | null) ?? {};
    const previousThreatProtectionConfig =
      (application.previousThreatProtectionConfig as Partial<typeof DEFAULT_THREAT_PROTECTION_CONFIG> | null) ?? {};

    const restoredGuardrailsConfig = {
      ...DEFAULT_GUARDRAILS,
      ...previousGuardrailsConfig,
    };
    const restoredThreatProtectionConfig = {
      ...DEFAULT_THREAT_PROTECTION_CONFIG,
      ...previousThreatProtectionConfig,
    };

    await updateGuardrailsPolicy(session, restoredGuardrailsConfig);
    await updateAgentsGuardrailsConfig({
      projectId: params.projectId,
      guardrailsConfig: restoredGuardrailsConfig,
    });

    await applyThreatProtectionConfig(session, restoredThreatProtectionConfig);
    await setThreatProtectionConfig(params.projectId, restoredThreatProtectionConfig);

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

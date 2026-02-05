import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

import { applySafetyTemplate, getSafetyTemplateById } from "@/lib/actions/safety-templates";
import { updateAgentsGuardrailsConfig } from "@/lib/actions/agents";
import { DEFAULT_THREAT_PROTECTION_CONFIG, getThreatProtectionConfig, setThreatProtectionConfig } from "@/lib/actions/project-settings";
import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { db } from "@/lib/db/drizzle";
import { safetyTemplateApplications, safetyTemplates } from "@/lib/db/migrations/schema";
import {
  DEFAULT_GUARDRAILS,
  applyThreatProtectionConfig,
  getCurrentGuardrailsConfig,
  updateGuardrailsPolicy,
} from "@/lib/safety-templates/operations";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ projectId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const params = await props.params;
    await requireProjectRoleAtLeast(params.projectId, "viewer");

    const applications = await db
      .select({
        id: safetyTemplateApplications.id,
        templateId: safetyTemplateApplications.templateId,
        appliedAt: safetyTemplateApplications.appliedAt,
        revertedAt: safetyTemplateApplications.revertedAt,
        revertedBy: safetyTemplateApplications.revertedBy,
        templateName: safetyTemplates.name,
        templateVersion: safetyTemplates.version,
      })
      .from(safetyTemplateApplications)
      .innerJoin(safetyTemplates, eq(safetyTemplateApplications.templateId, safetyTemplates.id))
      .where(eq(safetyTemplateApplications.projectId, params.projectId))
      .orderBy(desc(safetyTemplateApplications.appliedAt));

    return new Response(JSON.stringify({ items: applications }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching template applications:", error);
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
    await requireProjectRoleAtLeast(params.projectId, "operator");
    const body = await req.json();
    const templateId = body.templateId as string;

    const template = await getSafetyTemplateById(templateId);
    if (!template) {
      return new Response(JSON.stringify({ error: "Template not found" }), { status: 404 });
    }

    const previousGuardrailsConfig = await getCurrentGuardrailsConfig(params.projectId);
    const previousThreatProtectionConfig = await getThreatProtectionConfig(params.projectId);

    const newGuardrailsConfig = { ...DEFAULT_GUARDRAILS, ...(template.guardrailsConfig ?? {}) };
    const newThreatProtectionConfig = {
      ...DEFAULT_THREAT_PROTECTION_CONFIG,
      ...(template.threatProtectionConfig ?? {}),
    };

    await updateGuardrailsPolicy(session, newGuardrailsConfig);
    await updateAgentsGuardrailsConfig({ projectId: params.projectId, guardrailsConfig: newGuardrailsConfig });

    await applyThreatProtectionConfig(session, newThreatProtectionConfig);
    await setThreatProtectionConfig(params.projectId, newThreatProtectionConfig);

    const application = await applySafetyTemplate({
      projectId: params.projectId,
      templateId,
      appliedBy: session.user.id,
      previousGuardrailsConfig,
      previousThreatProtectionConfig,
      newGuardrailsConfig,
      newThreatProtectionConfig,
    });

    return new Response(JSON.stringify(application), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error applying safety template:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

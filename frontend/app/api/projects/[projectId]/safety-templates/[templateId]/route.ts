import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { getSafetyTemplateById, updateSafetyTemplate } from "@/lib/actions/safety-templates";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ projectId: string; templateId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const params = await props.params;
    const template = await getSafetyTemplateById(params.templateId);

    if (!template) {
      return new Response(JSON.stringify({ error: "Template not found" }), { status: 404 });
    }

    return new Response(JSON.stringify(template), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching safety template:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; templateId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const params = await props.params;
    await requireProjectRoleAtLeast(params.projectId, "operator");
    const body = await req.json();

    const updated = await updateSafetyTemplate(params.templateId, {
      projectId: params.projectId,
      name: body.name,
      description: body.description,
      version: body.version,
      guardrailsConfig: body.guardrailsConfig ?? {},
      threatProtectionConfig: body.threatProtectionConfig ?? {},
      visibility: body.visibility,
      isPublished: body.isPublished,
      updatedBy: session.user.id,
    });

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating safety template:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

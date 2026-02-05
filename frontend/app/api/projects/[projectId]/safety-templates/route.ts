import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { createSafetyTemplate, ensureMarketplaceTemplates, listSafetyTemplates } from "@/lib/actions/safety-templates";

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
    const includeMarketplace = req.nextUrl.searchParams.get("includeMarketplace") !== "false";

    if (includeMarketplace) {
      await ensureMarketplaceTemplates();
    }

    const templates = await listSafetyTemplates({ projectId: params.projectId, includeMarketplace });

    return new Response(JSON.stringify({ items: templates }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching safety templates:", error);
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

    const created = await createSafetyTemplate({
      projectId: params.projectId,
      name: body.name,
      description: body.description,
      version: body.version,
      guardrailsConfig: body.guardrailsConfig ?? {},
      threatProtectionConfig: body.threatProtectionConfig ?? {},
      visibility: body.visibility ?? "private",
      isPublished: body.isPublished ?? false,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });

    return new Response(JSON.stringify(created), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating safety template:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

import { and, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { logAuditEntry } from "@/lib/actions/audit-log";
import { getProjectSetting, upsertProjectSetting } from "@/lib/actions/project-settings";
import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { db } from "@/lib/db/drizzle";
import { projectSettings } from "@/lib/db/migrations/schema";

const DEPLOYMENT_MODES = ["hosted", "hybrid", "self_hosted"] as const;
const DATA_HANDLING_MODES = ["metadata_only", "redacted", "full_fidelity"] as const;

const SETTINGS_KEYS = ["deployment_mode", "data_handling_mode"] as const;

const DEFAULTS = {
  deployment_mode: "hybrid",
  data_handling_mode: "metadata_only",
};

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

    const rows = await db
      .select({
        name: projectSettings.name,
        value: projectSettings.value,
      })
      .from(projectSettings)
      .where(and(eq(projectSettings.projectId, params.projectId), inArray(projectSettings.name, SETTINGS_KEYS)));

    const settings = rows.reduce<Record<string, string>>((acc, row) => {
      if (row.name && row.value) {
        acc[row.name] = row.value;
      }
      return acc;
    }, {});

    return new Response(
      JSON.stringify({
        deploymentMode: settings.deployment_mode ?? DEFAULTS.deployment_mode,
        dataHandlingMode: settings.data_handling_mode ?? DEFAULTS.data_handling_mode,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching project settings:", error);
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
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
    const nextDeploymentMode = String(body.deploymentMode ?? "");
    const nextDataHandlingMode = String(body.dataHandlingMode ?? "");

    if (nextDeploymentMode && !DEPLOYMENT_MODES.includes(nextDeploymentMode as (typeof DEPLOYMENT_MODES)[number])) {
      return new Response(JSON.stringify({ error: "Invalid deployment mode" }), { status: 400 });
    }

    if (nextDataHandlingMode && !DATA_HANDLING_MODES.includes(nextDataHandlingMode as (typeof DATA_HANDLING_MODES)[number])) {
      return new Response(JSON.stringify({ error: "Invalid data handling mode" }), { status: 400 });
    }

    const previousDeploymentMode = await getProjectSetting(params.projectId, "deployment_mode");
    const previousDataHandlingMode = await getProjectSetting(params.projectId, "data_handling_mode");

    if (nextDeploymentMode) {
      await upsertProjectSetting({
        projectId: params.projectId,
        name: "deployment_mode",
        value: nextDeploymentMode,
      });
    }

    if (nextDataHandlingMode) {
      await upsertProjectSetting({
        projectId: params.projectId,
        name: "data_handling_mode",
        value: nextDataHandlingMode,
      });
    }

    await logAuditEntry({
      projectId: params.projectId,
      actorUserId: session.user.id,
      action: "project_settings_updated",
      entityType: "project_settings",
      entityId: params.projectId,
      before: {
        deploymentMode: previousDeploymentMode ?? DEFAULTS.deployment_mode,
        dataHandlingMode: previousDataHandlingMode ?? DEFAULTS.data_handling_mode,
      },
      after: {
        deploymentMode: nextDeploymentMode || previousDeploymentMode || DEFAULTS.deployment_mode,
        dataHandlingMode: nextDataHandlingMode || previousDataHandlingMode || DEFAULTS.data_handling_mode,
      },
    });

    return new Response(
      JSON.stringify({
        deploymentMode: nextDeploymentMode || previousDeploymentMode || DEFAULTS.deployment_mode,
        dataHandlingMode: nextDataHandlingMode || previousDataHandlingMode || DEFAULTS.data_handling_mode,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating project settings:", error);
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

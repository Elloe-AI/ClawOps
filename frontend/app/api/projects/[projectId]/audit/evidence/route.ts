import { createHash } from "crypto";
import { asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { logAuditEntry } from "@/lib/actions/audit-log";
import { getThreatProtectionConfig } from "@/lib/actions/project-settings";
import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { assertFeatureAccess, FeatureGateError } from "@/lib/billing/feature-gates";
import { db } from "@/lib/db/drizzle";
import {
  agentActivityEvents,
  agentApprovals,
  agents,
  auditLogEntries,
  incidents,
  projects,
  safetyTemplateApplications,
  safetyTemplates,
} from "@/lib/db/migrations/schema";
import { normalizeLegacyPayload } from "@/lib/telemetry/normalize";
import { stableJsonStringify } from "@/lib/utils/stable-json";

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
    await requireProjectRoleAtLeast(params.projectId, "admin");
    await assertFeatureAccess({
      projectId: params.projectId,
      feature: "audit_exports",
      userId: session.user.id,
      source: "audit_evidence_bundle",
    });

    const generatedAt = new Date().toISOString();
    const threatProtectionConfig = await getThreatProtectionConfig(params.projectId);
    const normalizedThreatProtectionConfig = normalizeLegacyPayload(threatProtectionConfig);

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        workspaceId: projects.workspaceId,
        complianceMode: projects.complianceMode,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.id, params.projectId));

    const [agentsRows, activityRows, incidentsRows, approvalsRows, auditRows, templatesRows, applicationRows] =
      await Promise.all([
        db
          .select()
          .from(agents)
          .where(eq(agents.projectId, params.projectId))
          .orderBy(asc(agents.createdAt)),
        db
          .select()
          .from(agentActivityEvents)
          .where(eq(agentActivityEvents.projectId, params.projectId))
          .orderBy(asc(agentActivityEvents.createdAt)),
        db
          .select()
          .from(incidents)
          .where(eq(incidents.projectId, params.projectId))
          .orderBy(asc(incidents.createdAt)),
        db
          .select()
          .from(agentApprovals)
          .where(eq(agentApprovals.projectId, params.projectId))
          .orderBy(asc(agentApprovals.requestedAt)),
        db
          .select()
          .from(auditLogEntries)
          .where(eq(auditLogEntries.projectId, params.projectId))
          .orderBy(asc(auditLogEntries.createdAt)),
        db
          .select()
          .from(safetyTemplates)
          .where(eq(safetyTemplates.projectId, params.projectId))
          .orderBy(asc(safetyTemplates.createdAt)),
        db
          .select()
          .from(safetyTemplateApplications)
          .where(eq(safetyTemplateApplications.projectId, params.projectId))
          .orderBy(asc(safetyTemplateApplications.appliedAt)),
      ]);

    const normalizedAgents = agentsRows.map((row) => normalizeLegacyPayload(row));
    const normalizedActivity = activityRows.map((row) => normalizeLegacyPayload(row));
    const normalizedIncidents = incidentsRows.map((row) => normalizeLegacyPayload(row));
    const normalizedApprovals = approvalsRows.map((row) => normalizeLegacyPayload(row));
    const normalizedAuditLogs = auditRows.map((row) => normalizeLegacyPayload(row));
    const normalizedTemplates = templatesRows.map((row) => normalizeLegacyPayload(row));
    const normalizedTemplateApplications = applicationRows.map((row) => normalizeLegacyPayload(row));

    const bundle = {
      generatedAt,
      project: project ?? null,
      threatProtectionConfig: normalizedThreatProtectionConfig,
      agents: normalizedAgents,
      activityEvents: normalizedActivity,
      incidents: normalizedIncidents,
      approvals: normalizedApprovals,
      auditLogs: normalizedAuditLogs,
      safetyTemplates: normalizedTemplates,
      safetyTemplateApplications: normalizedTemplateApplications,
    };

    const checksumPayload = {
      project: project ?? null,
      threatProtectionConfig: normalizedThreatProtectionConfig,
      agents: normalizedAgents,
      activityEvents: normalizedActivity,
      incidents: normalizedIncidents,
      approvals: normalizedApprovals,
      auditLogs: normalizedAuditLogs,
      safetyTemplates: normalizedTemplates,
      safetyTemplateApplications: normalizedTemplateApplications,
    };

    const checksum = createHash("sha256").update(stableJsonStringify(checksumPayload)).digest("hex");

    await logAuditEntry({
      projectId: params.projectId,
      actorUserId: session.user.id,
      action: "evidence_bundle_exported",
      entityType: "audit_log",
      entityId: params.projectId,
      metadata: { checksum },
    });

    return new Response(JSON.stringify({ ...bundle, checksum }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Checksum": checksum,
        "X-Generated-At": generatedAt,
      },
    });
  } catch (error) {
    console.error("Error exporting evidence bundle:", error);
    if (error instanceof FeatureGateError) {
      return new Response(JSON.stringify({ error: error.message, code: error.feature }), { status: error.status });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

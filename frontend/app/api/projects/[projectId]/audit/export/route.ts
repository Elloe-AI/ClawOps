import { createHash } from "crypto";
import { asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { logAuditEntry } from "@/lib/actions/audit-log";
import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { assertFeatureAccess, FeatureGateError } from "@/lib/billing/feature-gates";
import { db } from "@/lib/db/drizzle";
import { auditLogEntries } from "@/lib/db/migrations/schema";
import { normalizeLegacyPayload } from "@/lib/telemetry/normalize";
import { stableJsonStringify } from "@/lib/utils/stable-json";

const escapeCsv = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes(",") || text.includes("\n") || text.includes("\"") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

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
    await requireProjectRoleAtLeast(params.projectId, "admin");
    await assertFeatureAccess({
      projectId: params.projectId,
      feature: "audit_exports",
      userId: session.user.id,
      source: "audit_export",
    });

    const format = req.nextUrl.searchParams.get("format") ?? "csv";
    const generatedAt = new Date().toISOString();

    const rows = await db
      .select({
        id: auditLogEntries.id,
        createdAt: auditLogEntries.createdAt,
        action: auditLogEntries.action,
        entityType: auditLogEntries.entityType,
        entityId: auditLogEntries.entityId,
        actorUserId: auditLogEntries.actorUserId,
        metadata: auditLogEntries.metadata,
        before: auditLogEntries.before,
        after: auditLogEntries.after,
      })
      .from(auditLogEntries)
      .where(eq(auditLogEntries.projectId, params.projectId))
      .orderBy(asc(auditLogEntries.createdAt));

    const normalizedRows = rows.map((row) => ({
      ...row,
      metadata: normalizeLegacyPayload(row.metadata),
      before: normalizeLegacyPayload(row.before),
      after: normalizeLegacyPayload(row.after),
    }));

    const payload = {
      projectId: params.projectId,
      generatedAt,
      records: normalizedRows,
    };

    const checksumPayload = {
      projectId: params.projectId,
      records: normalizedRows,
    };

    const checksum = createHash("sha256").update(stableJsonStringify(checksumPayload)).digest("hex");

    await logAuditEntry({
      projectId: params.projectId,
      actorUserId: session.user.id,
      action: "audit_exported",
      entityType: "audit_log",
      entityId: params.projectId,
      metadata: { format, checksum, recordCount: normalizedRows.length },
    });

    if (format === "json") {
      return new Response(JSON.stringify({ ...payload, checksum }), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Content-Checksum": checksum,
          "X-Generated-At": generatedAt,
        },
      });
    }

    const header = ["id", "created_at", "action", "entity_type", "entity_id", "actor_user_id", "metadata", "before", "after"];
    const csvLines = [header.join(",")];
    for (const row of normalizedRows) {
      csvLines.push(
        [
          row.id,
          row.createdAt,
          row.action,
          row.entityType,
          row.entityId ?? "",
          row.actorUserId ?? "",
          row.metadata ? JSON.stringify(row.metadata) : "",
          row.before ? JSON.stringify(row.before) : "",
          row.after ? JSON.stringify(row.after) : "",
        ]
          .map(escapeCsv)
          .join(",")
      );
    }

    return new Response(csvLines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=clawops-audit-log.csv",
        "X-Content-Checksum": checksum,
        "X-Generated-At": generatedAt,
      },
    });
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    if (error instanceof FeatureGateError) {
      return new Response(JSON.stringify({ error: error.message, code: error.feature }), { status: error.status });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

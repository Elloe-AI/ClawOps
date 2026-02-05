import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isClawOpsAdmin } from "@/lib/admin/permissions";
import { db } from "@/lib/db/drizzle";
import { productEvents, users } from "@/lib/db/migrations/schema";

const escapeCsv = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes(",") || text.includes("\n") || text.includes("\"") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export async function GET(_req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session || !isClawOpsAdmin(session.user.email)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const rows = await db
    .select({
      id: productEvents.id,
      createdAt: productEvents.createdAt,
      name: productEvents.name,
      userId: productEvents.userId,
      userEmail: users.email,
      projectId: productEvents.projectId,
      agentId: productEvents.agentId,
      metadata: productEvents.metadata,
    })
    .from(productEvents)
    .leftJoin(users, eq(productEvents.userId, users.id))
    .orderBy(desc(productEvents.createdAt));

  const header = [
    "id",
    "created_at",
    "name",
    "user_id",
    "user_email",
    "project_id",
    "agent_id",
    "metadata",
  ];

  const csvLines = [header.join(",")];
  for (const row of rows) {
    csvLines.push(
      [
        row.id,
        row.createdAt,
        row.name,
        row.userId ?? "",
        row.userEmail ?? "",
        row.projectId ?? "",
        row.agentId ?? "",
        row.metadata ? JSON.stringify(row.metadata) : "",
      ]
        .map(escapeCsv)
        .join(",")
    );
  }

  return new Response(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=clawops-product-analytics.csv",
    },
  });
}

import { count, eq, max } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";
import { db } from "@/lib/db/drizzle";
import { incidents } from "@/lib/db/migrations/schema";

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
        category: incidents.category,
        count: count(incidents.id),
        lastTriggeredAt: max(incidents.createdAt),
      })
      .from(incidents)
      .where(eq(incidents.projectId, params.projectId))
      .groupBy(incidents.category);

    const stats = rows.map((row) => ({
      category: row.category ?? "other",
      count: Number(row.count),
      lastTriggeredAt: row.lastTriggeredAt,
    }));

    return new Response(JSON.stringify({ items: stats }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching threat protection stats:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

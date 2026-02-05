import { count, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db/drizzle";
import { productEvents, readinessChecks } from "@/lib/db/migrations/schema";

const REQUIRED_PRODUCT_EVENTS = [
  "agent_created",
  "demo_started",
  "runtime_connected",
  "first_message",
  "first_block",
  "first_pause",
  "approval_requested",
  "approval_completed",
  "upgrade_clicked",
];

export async function GET(_req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const envChecks = {
    engineUrl: Boolean(process.env.CLAWOPS_ENGINE_URL),
    engineApiKey: Boolean(process.env.CLAWOPS_ENGINE_API_KEY),
    rateLimitWindow: Number.isFinite(Number(process.env.CLAWOPS_RATE_LIMIT_WINDOW_MS ?? "")),
    rateLimitMax: Number.isFinite(Number(process.env.CLAWOPS_RATE_LIMIT_MAX ?? "")),
  };

  const legacyEnvPresent = Object.keys(process.env).some(
    (key) => key.startsWith("HIPOCAP_") || key.startsWith("HIPO_")
  );

  const eventCounts = await db
    .select({ name: productEvents.name, count: count(productEvents.id) })
    .from(productEvents)
    .groupBy(productEvents.name);

  const eventMap = eventCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.name] = Number(row.count);
    return acc;
  }, {});

  const productChecks = REQUIRED_PRODUCT_EVENTS.map((name) => ({
    name,
    present: (eventMap[name] ?? 0) > 0,
    count: eventMap[name] ?? 0,
  }));

  const checks = [
    {
      name: "branding",
      status: legacyEnvPresent ? "fail" : "pass",
      details: { legacyEnvPresent },
    },
    {
      name: "enforcement",
      status: Object.values(envChecks).every(Boolean) ? "pass" : "fail",
      details: envChecks,
    },
    {
      name: "critical_paths",
      status: productChecks.every((check) => check.present) ? "pass" : "fail",
      details: productChecks,
    },
  ];

  const ready = checks.every((check) => check.status === "pass");
  const status = ready ? "READY" : "NOT READY";
  const label = `ClawOps Readiness: ${status}`;

  await db.insert(readinessChecks).values({
    name: "clawops_readiness",
    status,
    details: { checks, label },
  });

  return new Response(JSON.stringify({ status, label, checks }), {
    status: ready ? 200 : 503,
    headers: { "Content-Type": "application/json" },
  });
}

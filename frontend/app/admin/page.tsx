import { and, count, eq, gte, inArray, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isClawOpsAdmin } from "@/lib/admin/permissions";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db/drizzle";
import { agentActivityEvents, agentApprovals, agents, productEvents, users } from "@/lib/db/migrations/schema";

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(1)}%`;
};

const formatNumber = (value: number | null, fallback = "--") => {
  if (value === null || Number.isNaN(value)) return fallback;
  return value.toLocaleString();
};

const formatMinutes = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "--";
  if (value < 60) return `${value.toFixed(0)} min`;
  const hours = value / 60;
  return `${hours.toFixed(1)} hrs`;
};

export default async function AdminConsolePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in");
  }

  if (!isClawOpsAdmin(session.user.email)) {
    notFound();
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [[usersCount = { count: 0 }], [agentsCount = { count: 0 }]] = await Promise.all([
    db.select({ count: count(users.id) }).from(users),
    db.select({ count: count(agents.id) }).from(agents),
  ]);

  const eventCounts = await db
    .select({ eventType: agentActivityEvents.eventType, count: count(agentActivityEvents.id) })
    .from(agentActivityEvents)
    .where(gte(agentActivityEvents.createdAt, since))
    .groupBy(agentActivityEvents.eventType);

  const eventMap = eventCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.eventType] = Number(row.count);
    return acc;
  }, {});

  const blockedCount24h = eventMap.agent_response_blocked ?? 0;
  const sentCount24h = eventMap.agent_response_sent ?? 0;
  const pausedCount24h = (eventMap.agent_paused_auto ?? 0) + (eventMap.agent_paused_manual ?? 0);
  const guardrailCount24h = eventMap.guardrail_triggered ?? 0;
  const totalEvents24h = Object.values(eventMap).reduce((sum, value) => sum + value, 0);

  const blockRate = blockedCount24h + sentCount24h > 0 ? blockedCount24h / (blockedCount24h + sentCount24h) : null;
  const pauseRate = totalEvents24h > 0 ? pausedCount24h / totalEvents24h : null;
  const errorRate = totalEvents24h > 0 ? (blockedCount24h + guardrailCount24h) / totalEvents24h : null;

  const [[blockedAll = { count: 0 }], [pausedAll = { count: 0 }]] = await Promise.all([
    db
      .select({ count: count(agentActivityEvents.id) })
      .from(agentActivityEvents)
      .where(eq(agentActivityEvents.eventType, "agent_response_blocked")),
    db
      .select({ count: count(agentActivityEvents.id) })
      .from(agentActivityEvents)
      .where(inArray(agentActivityEvents.eventType, ["agent_paused_auto", "agent_paused_manual"])),
  ]);

  const agentRows = await db.select({ id: agents.id, createdAt: agents.createdAt }).from(agents);
  const blockedEvents = await db
    .select({ agentId: agentActivityEvents.agentId, createdAt: agentActivityEvents.createdAt })
    .from(agentActivityEvents)
    .where(eq(agentActivityEvents.eventType, "agent_response_blocked"));

  const firstBlockMap = new Map<string, Date>();
  for (const event of blockedEvents) {
    const created = new Date(event.createdAt);
    const existing = firstBlockMap.get(event.agentId);
    if (!existing || created < existing) {
      firstBlockMap.set(event.agentId, created);
    }
  }

  const timeToFirstBlockMinutes: number[] = [];
  for (const agent of agentRows) {
    const firstBlock = firstBlockMap.get(agent.id);
    if (!firstBlock) continue;
    const createdAt = new Date(agent.createdAt);
    const diff = (firstBlock.getTime() - createdAt.getTime()) / 60000;
    if (diff >= 0) {
      timeToFirstBlockMinutes.push(diff);
    }
  }

  const avgTimeToBlock =
    timeToFirstBlockMinutes.length > 0
      ? timeToFirstBlockMinutes.reduce((sum, value) => sum + value, 0) / timeToFirstBlockMinutes.length
      : null;

  const blocksPerAgent = agentsCount.count > 0 ? Number(blockedAll.count) / agentsCount.count : null;
  const pausesPerAgent = agentsCount.count > 0 ? Number(pausedAll.count) / agentsCount.count : null;

  const approvalRows = await db
    .select({
      requestedAt: agentApprovals.requestedAt,
      respondedAt: agentApprovals.respondedAt,
    })
    .from(agentApprovals)
    .where(and(isNotNull(agentApprovals.respondedAt), gte(agentApprovals.requestedAt, since)));

  const approvalLatencies = approvalRows
    .map((row) => {
      if (!row.respondedAt) return null;
      const requested = new Date(row.requestedAt);
      const responded = new Date(row.respondedAt);
      const diff = (responded.getTime() - requested.getTime()) / 60000;
      return diff >= 0 ? diff : null;
    })
    .filter((value): value is number => value !== null);

  const avgApprovalLatency =
    approvalLatencies.length > 0
      ? approvalLatencies.reduce((sum, value) => sum + value, 0) / approvalLatencies.length
      : null;

  const partnerRows = await db
    .select({
      partnerId: agentActivityEvents.partnerId,
      runtimeType: agentActivityEvents.runtimeType,
      count: count(agentActivityEvents.id),
    })
    .from(agentActivityEvents)
    .where(gte(agentActivityEvents.createdAt, since))
    .groupBy(agentActivityEvents.partnerId, agentActivityEvents.runtimeType);

  const partnerSummary = partnerRows
    .map((row) => ({
      partnerId: row.partnerId ?? "Unspecified",
      runtimeType: row.runtimeType ?? "Unknown",
      count: Number(row.count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const productEventCounts = await db
    .select({ name: productEvents.name, count: count(productEvents.id) })
    .from(productEvents)
    .groupBy(productEvents.name);

  const productEventMap = productEventCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.name] = Number(row.count);
    return acc;
  }, {});

  const demoEvents = await db
    .select({ userId: productEvents.userId, createdAt: productEvents.createdAt })
    .from(productEvents)
    .where(eq(productEvents.name, "demo_started"));

  const agentCreatedEvents = await db
    .select({ userId: productEvents.userId, createdAt: productEvents.createdAt })
    .from(productEvents)
    .where(eq(productEvents.name, "agent_created"));

  const demoByUser = new Map<string, Date>();
  for (const event of demoEvents) {
    if (!event.userId) continue;
    const createdAt = new Date(event.createdAt);
    const existing = demoByUser.get(event.userId);
    if (!existing || createdAt < existing) {
      demoByUser.set(event.userId, createdAt);
    }
  }

  const createdByUser = new Map<string, Date>();
  for (const event of agentCreatedEvents) {
    if (!event.userId) continue;
    const createdAt = new Date(event.createdAt);
    const existing = createdByUser.get(event.userId);
    if (!existing || createdAt < existing) {
      createdByUser.set(event.userId, createdAt);
    }
  }

  let demoConversions = 0;
  for (const [userId, demoDate] of demoByUser.entries()) {
    const createdDate = createdByUser.get(userId);
    if (createdDate && createdDate >= demoDate) {
      demoConversions += 1;
    }
  }

  const demoCount = demoByUser.size;
  const demoConversionRate = demoCount > 0 ? demoConversions / demoCount : null;

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">ClawOps Admin Console</h1>
          <p className="text-sm text-muted-foreground">
            Internal monitoring for beta operations, growth signals, and product health.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Total registered users</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatNumber(Number(usersCount.count))}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Agents</CardTitle>
              <CardDescription>Total connected agents</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatNumber(Number(agentsCount.count))}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Event volume</CardTitle>
              <CardDescription>Agent activity (last 24h)</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatNumber(totalEvents24h)}</CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Block rate</CardTitle>
              <CardDescription>Blocked responses / total responses (24h)</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatPercent(blockRate)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pause rate</CardTitle>
              <CardDescription>Paused events / total events (24h)</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatPercent(pauseRate)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Error rate</CardTitle>
              <CardDescription>Guardrail triggers + blocks (24h)</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatPercent(errorRate)}</CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Time to first block</CardTitle>
              <CardDescription>Average time from agent creation</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatMinutes(avgTimeToBlock)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Blocks per agent</CardTitle>
              <CardDescription>All-time average</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {blocksPerAgent === null ? "--" : blocksPerAgent.toFixed(2)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pauses per agent</CardTitle>
              <CardDescription>All-time average</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {pausesPerAgent === null ? "--" : pausesPerAgent.toFixed(2)}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Approval latency</CardTitle>
              <CardDescription>Average time to approve or deny (24h)</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatMinutes(avgApprovalLatency)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Partner activity</CardTitle>
              <CardDescription>Top partner/runtime pairs (24h)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {partnerSummary.length === 0 && (
                <div className="text-xs text-muted-foreground">No partner activity yet.</div>
              )}
              {partnerSummary.map((row) => (
                <div key={`${row.partnerId}-${row.runtimeType}`} className="flex items-center justify-between">
                  <span>
                    {row.partnerId} · {row.runtimeType}
                  </span>
                  <span className="font-medium">{formatNumber(row.count)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Demo conversion</CardTitle>
              <CardDescription>Demo started to agent created</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-semibold">{formatPercent(demoConversionRate)}</div>
              <div className="text-xs text-muted-foreground">
                {demoConversions} conversions out of {demoCount} demo sessions
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Product milestones</CardTitle>
              <CardDescription>All-time product analytics counters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>agent_created</span>
                <span className="font-medium">{formatNumber(productEventMap.agent_created ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>runtime_connected</span>
                <span className="font-medium">{formatNumber(productEventMap.runtime_connected ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>first_message</span>
                <span className="font-medium">{formatNumber(productEventMap.first_message ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>first_block</span>
                <span className="font-medium">{formatNumber(productEventMap.first_block ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>first_pause</span>
                <span className="font-medium">{formatNumber(productEventMap.first_pause ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>approval_requested</span>
                <span className="font-medium">{formatNumber(productEventMap.approval_requested ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>approval_completed</span>
                <span className="font-medium">{formatNumber(productEventMap.approval_completed ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>upgrade_clicked</span>
                <span className="font-medium">{formatNumber(productEventMap.upgrade_clicked ?? 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Exports</CardTitle>
            <CardDescription>Download product analytics events as CSV.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/api/admin/analytics/export">
              <Button>Export analytics CSV</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

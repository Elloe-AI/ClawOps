import { and, count, eq, gte, inArray, sql } from "drizzle-orm";

import { getWorkspaceUsage } from "@/lib/actions/workspace";
import { db } from "@/lib/db/drizzle";
import {
  agents,
  datasetExportJobs,
  incidents,
  membersOfWorkspaces,
  projects,
  subscriptionTiers,
  traces,
  workspaces,
} from "@/lib/db/migrations/schema";

import { WorkspaceStats } from "./types";

const bytesToGB = (bytes: number): number => bytes / (1024 * 1024 * 1024);

export async function getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
  // First, get member count for the workspace
  const membersCount = await db
    .select({ count: count() })
    .from(membersOfWorkspaces)
    .where(eq(membersOfWorkspaces.workspaceId, workspaceId));

  const members = membersCount[0]?.count || 0;

  const limitsRows = await db
    .select({
      tierName: subscriptionTiers.name,
      seatsIncludedInTier: subscriptionTiers.membersPerWorkspace,
      membersLimit: sql<number>`${subscriptionTiers.membersPerWorkspace} + ${workspaces.additionalSeats}`,
      storageLimit: subscriptionTiers.storageMib,
      bytesLimit: subscriptionTiers.bytesIngested,
    })
    .from(workspaces)
    .innerJoin(subscriptionTiers, eq(subscriptionTiers.id, workspaces.tierId))
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!limitsRows[0]) {
    throw new Error(`Workspace stats not found for workspace ${workspaceId}`);
  }

  const limits = limitsRows[0];

  const usage = await getWorkspaceUsage(workspaceId);
  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId));
  const projectIds = projectRows.map((row) => row.id);
  const resetTime = usage.resetTime.toISOString();

  let activeAgents = 0;
  let sessionCount = 0;
  let incidentCount = 0;
  let exportCount = 0;

  if (projectIds.length > 0) {
    const [agentCountResult, sessionCountResult, incidentCountResult, exportCountResult] = await Promise.all([
      db
        .select({ count: count(agents.id) })
        .from(agents)
        .where(and(inArray(agents.projectId, projectIds), eq(agents.status, "running"))),
      db
        .select({
          count: sql<number>`count(distinct ${traces.sessionId})`,
        })
        .from(traces)
        .where(
          and(
            inArray(traces.projectId, projectIds),
            gte(traces.createdAt, resetTime),
            sql`${traces.sessionId} IS NOT NULL`
          )
        ),
      db
        .select({ count: count(incidents.id) })
        .from(incidents)
        .where(and(inArray(incidents.projectId, projectIds), gte(incidents.createdAt, resetTime))),
      db
        .select({ count: count(datasetExportJobs.id) })
        .from(datasetExportJobs)
        .where(and(inArray(datasetExportJobs.projectId, projectIds), gte(datasetExportJobs.createdAt, resetTime))),
    ]);

    activeAgents = Number(agentCountResult?.[0]?.count ?? 0);
    sessionCount = Number(sessionCountResult?.[0]?.count ?? 0);
    incidentCount = Number(incidentCountResult?.[0]?.count ?? 0);
    exportCount = Number(exportCountResult?.[0]?.count ?? 0);
  }

  const gbUsedThisMonth = bytesToGB(usage.totalBytesIngested);
  const gbLimit = bytesToGB(Number(limits.bytesLimit));

  // Calculate GB overages
  const gbOverLimit = Math.max(gbUsedThisMonth - gbLimit, 0);
  const gbOverLimitCost = gbOverLimit * 2; // $2 per GB overage based on pricing

  return {
    tierName: limits.tierName,
    seatsIncludedInTier: Number(limits.seatsIncludedInTier),
    members: Number(members),
    membersLimit: Number(limits.membersLimit),
    resetTime: usage.resetTime.toISOString(),
    activeAgents,
    sessionCount,
    incidentCount,
    exportCount,
    gbUsedThisMonth,
    gbLimit,
    gbOverLimit,
    gbOverLimitCost,
  };
}

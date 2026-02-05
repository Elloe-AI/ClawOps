import { eq } from "drizzle-orm";

import { requireWorkspaceRoleAtLeast } from "@/lib/actions/workspace/utils";
import { db } from "@/lib/db/drizzle";
import { projects } from "@/lib/db/migrations/schema";
import { WorkspaceRole } from "@/lib/workspaces/types";

export async function requireProjectRoleAtLeast(projectId: string, minimumRole: WorkspaceRole) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { workspaceId: true },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return requireWorkspaceRoleAtLeast(project.workspaceId, minimumRole);
}

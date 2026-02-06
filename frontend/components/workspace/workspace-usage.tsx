import { SettingsSection, SettingsSectionHeader } from "@/components/settings/settings-section";
import { WorkspaceStats } from "@/lib/usage/types";
import { cn } from "@/lib/utils";
import { Workspace } from "@/lib/workspaces/types";
import { displayTierName } from "@/lib/billing/tiers";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../ui/dialog";
import PricingDialog from "./pricing-dialog";

interface WorkspaceUsageProps {
  workspace: Workspace;
  workspaceStats: WorkspaceStats;
  isOwner: boolean;
}

export default function WorkspaceUsage({ workspace, workspaceStats, isOwner }: WorkspaceUsageProps) {
  const resetTime = workspaceStats.resetTime;
  const tierLabel = displayTierName(workspaceStats.tierName);
  const usageMetrics = [
    { label: "Active agents", value: workspaceStats.activeAgents },
    { label: "Sessions", value: workspaceStats.sessionCount },
    { label: "Incidents", value: workspaceStats.incidentCount },
    { label: "Exports", value: workspaceStats.exportCount },
  ];

  return (
    <>
      <SettingsSectionHeader title="Usage & Billing" description="Manage your workspace plan and monitor usage" />
      <SettingsSection>
        <SettingsSectionHeader
          size="sm"
          title="Workspace plan"
          description={`Monthly billing cycle started ${new Date(resetTime).toLocaleDateString()}`}
        />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary-foreground">Current tier:</span>
            <span
              className={cn(
                "text-xs text-secondary-foreground p-0.5 px-1.5 rounded-md bg-secondary/40 font-mono border border-secondary-foreground/20",
                {
                  "border-primary bg-primary/10 text-primary": tierLabel === "Pro",
                }
              )}
            >
              {tierLabel}
            </span>
          </div>
        </div>
        {isOwner && (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-fit" variant="default">
                {workspaceStats.tierName.toLowerCase().trim() === "free" ? "Upgrade" : "Manage billing"}
              </Button>
            </DialogTrigger>
            <DialogTitle className="sr-only">Manage billing</DialogTitle>
            <DialogContent className="max-w-[90vw] p-0 border-none">
              <PricingDialog
                workspaceTier={workspaceStats.tierName.toLowerCase().trim()}
                workspaceId={workspace.id}
                workspaceName={workspace.name}
              />
            </DialogContent>
          </Dialog>
        )}
      </SettingsSection>

      <SettingsSection>
        <SettingsSectionHeader
          size="sm"
          title="Operational usage"
          description="Metering is based on active agents, sessions, incidents, and exports (never tokens)."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {usageMetrics.map((metric) => (
            <div key={metric.label} className="border rounded-md p-4 bg-secondary">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</div>
              <div className="text-lg font-semibold text-foreground">{metric.value}</div>
            </div>
          ))}
        </div>
      </SettingsSection>
    </>
  );
}

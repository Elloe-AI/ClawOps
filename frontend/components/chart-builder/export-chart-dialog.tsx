import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { PropsWithChildren, useState } from "react";

import { useChartBuilderStoreContext } from "@/components/chart-builder/chart-builder-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useProjectContext } from "@/contexts/project-context";
import { useProductAnalytics } from "@/lib/analytics/use-product-analytics";
import { useToast } from "@/lib/hooks/use-toast";

const ExportChartDialog = ({ children }: PropsWithChildren) => {
  const { projectId } = useParams();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { project, workspace } = useProjectContext();
  const { track } = useProductAnalytics();
  const { query, chartConfig, setChartName, name, isValidChartConfiguration } = useChartBuilderStoreContext(
    (state) => ({
      query: state.query,
      chartConfig: state.chartConfig,
      name: state.name,
      setChartName: state.setChartName,
      isValidChartConfiguration: state.isValidChartConfiguration,
    })
  );

  const isFreeTier = Boolean(project?.isFreeTier);
  const handleUpgradeClick = () => {
    if (!projectId) return;
    track({ name: "upgrade_clicked", projectId: String(projectId), metadata: { source: "audit_exports" } });
    const target = workspace?.id ? `/workspace/${workspace.id}?tab=usage` : "/pricing";
    window.location.assign(target);
  };

  const handleExport = async () => {
    if (!name || isFreeTier) {
      return;
    }

    if (!chartConfig.type || !chartConfig.x || !chartConfig.y) {
      return;
    }

    setIsLoading(true);
    try {
      await fetch(`/api/projects/${projectId}/dashboard-charts`, {
        method: "PUT",
        body: JSON.stringify({
          query,
          name,
          config: chartConfig,
        }),
      });

      setOpen(false);
      toast({
        title: "Success",
        description: (
          <span>
            Successfully exported chart to Data / Audit.{" "}
            <Link className="text-primary" href={`/project/${projectId}/audit`}>
              Go to Data / Audit.
            </Link>
          </span>
        ),
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to export chart. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = isValidChartConfiguration() && (name?.trim().length || 0) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left">Export Chart to Data / Audit</DialogTitle>
        </DialogHeader>
        <Separator />
        {isFreeTier && (
          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            <div className="font-medium text-foreground">Audit exports are locked</div>
            <p className="text-muted-foreground">
              Upgrade to export audit charts and share CSV reports with your team.
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={handleUpgradeClick}>
              Upgrade
            </Button>
          </div>
        )}
        <Input
          id="chart-name"
          value={name || ""}
          onChange={(e) => setChartName(e.target.value || undefined)}
          placeholder="Enter chart name"
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button handleEnter onClick={handleExport} disabled={!isValid || isLoading || isFreeTier}>
            {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportChartDialog;

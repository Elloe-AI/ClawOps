"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectContext } from "@/contexts/project-context";
import { useProductAnalytics } from "@/lib/analytics/use-product-analytics";
import { useToast } from "@/lib/hooks/use-toast";

type ComplianceMode = "general" | "regulated";

export default function AuditTools() {
  const { projectId } = useParams();
  const router = useRouter();
  const { project, workspace } = useProjectContext();
  const { toast } = useToast();
  const { track } = useProductAnalytics();
  const [complianceMode, setComplianceMode] = useState<ComplianceMode>(
    (project?.complianceMode as ComplianceMode | undefined) ?? "general"
  );
  const [isSaving, setIsSaving] = useState(false);

  const isFreeTier = Boolean(project?.isFreeTier);

  const handleUpgradeClick = (source: string) => {
    if (!projectId) return;
    track({ name: "upgrade_clicked", projectId: String(projectId), metadata: { source } });
    const target = workspace?.id ? `/workspace/${workspace.id}?tab=usage` : "/pricing";
    router.push(target);
  };

  const handleComplianceChange = async (value: string) => {
    if (!projectId) return;
    if (value !== "general" && value !== "regulated") return;
    setComplianceMode(value);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/compliance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complianceMode: value }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update compliance mode");
      }
      toast({ title: "Compliance mode updated" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to update compliance mode",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Audit exports</CardTitle>
          <CardDescription>Download audit logs and evidence bundles for compliance reviews.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={isFreeTier}
            onClick={() => window.open(`/api/projects/${projectId}/audit/export?format=csv`, "_blank")}
          >
            Export audit CSV
          </Button>
          <Button
            variant="outline"
            disabled={isFreeTier}
            onClick={() => window.open(`/api/projects/${projectId}/audit/export?format=json`, "_blank")}
          >
            Export audit JSON
          </Button>
          <Button
            variant="outline"
            disabled={isFreeTier}
            onClick={() => window.open(`/api/projects/${projectId}/audit/evidence`, "_blank")}
          >
            Evidence bundle
          </Button>
          {isFreeTier && (
            <div className="text-xs text-muted-foreground w-full flex items-center gap-2">
              Audit exports unlock on Pro or Enterprise plans.
              <Button size="sm" variant="link" onClick={() => handleUpgradeClick("audit_exports")}>
                Upgrade
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance mode</CardTitle>
          <CardDescription>Choose the audit posture for this environment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Select value={complianceMode} onValueChange={handleComplianceChange} disabled={isSaving}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select compliance mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="regulated">Regulated</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Regulated mode increases audit retention expectations and evidence granularity.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Cloud, Globe, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/hooks/use-toast";
import { cn, swrFetcher } from "@/lib/utils";

import { SettingsSection, SettingsSectionHeader } from "./settings-section";

const DEPLOYMENT_MODES = [
  {
    id: "hosted",
    label: "Hosted ClawOps (SaaS)",
    description: "Fastest launch. ClawOps control plane is fully managed.",
    detail: "Default metadata-only telemetry with opt-in full fidelity.",
    icon: Cloud,
  },
  {
    id: "hybrid",
    label: "Hybrid (Recommended)",
    description: "Hosted control plane with self-hosted Edge connector.",
    detail: "Raw data stays local; SaaS receives metadata + incidents.",
    icon: ShieldCheck,
  },
  {
    id: "self_hosted",
    label: "Fully self-hosted",
    description: "Control plane + Edge deployed on your infrastructure.",
    detail: "No external dependencies; enterprise support hooks only.",
    icon: Globe,
  },
] as const;

const DATA_HANDLING_MODES = [
  {
    id: "metadata_only",
    label: "Metadata only (default)",
    description: "Counts, timings, and incident summaries only.",
  },
  {
    id: "redacted",
    label: "Redacted payloads",
    description: "Payloads are redacted before leaving your environment.",
  },
  {
    id: "full_fidelity",
    label: "Full-fidelity (opt-in)",
    description: "Full payloads stored with explicit approval and audit trails.",
  },
] as const;

type ProjectSettingsResponse = {
  deploymentMode: string;
  dataHandlingMode: string;
};

export default function ProjectDeploymentSettings() {
  const { projectId } = useParams();
  const projectKey = Array.isArray(projectId) ? projectId[0] : projectId;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const { data, mutate } = useSWR<ProjectSettingsResponse>(
    projectKey ? `/api/projects/${projectKey}/settings` : null,
    swrFetcher
  );

  const currentDeploymentMode = data?.deploymentMode ?? "hybrid";
  const currentDataHandlingMode = data?.dataHandlingMode ?? "metadata_only";

  const updateSettings = async (payload: Partial<ProjectSettingsResponse>) => {
    if (!projectKey) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectKey}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update settings");
      }

      const updated = (await res.json()) as ProjectSettingsResponse;
      mutate(updated, { revalidate: false });
      toast({ title: "Settings updated", description: "Deployment preferences saved." });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Unable to update settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deploymentOptions = useMemo(() => DEPLOYMENT_MODES, []);
  const dataHandlingOptions = useMemo(() => DATA_HANDLING_MODES, []);

  return (
    <>
      <SettingsSectionHeader
        title="Deployment & data handling"
        description="Choose how ClawOps is deployed and what telemetry leaves your environment."
      />
      <SettingsSection>
        <Card>
          <CardHeader>
            <CardTitle>Deployment mode</CardTitle>
            <CardDescription>All modes preserve the same guardrails, RBAC, and audit guarantees.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {deploymentOptions.map((mode) => {
              const Icon = mode.icon;
              const isActive = currentDeploymentMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => updateSettings({ deploymentMode: mode.id })}
                  disabled={isSaving}
                  className={cn(
                    "rounded-lg border p-4 text-left transition",
                    isActive ? "border-primary bg-primary/5" : "border-muted"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{mode.label}</span>
                    </div>
                    {mode.id === "hybrid" && <Badge variant="outlinePrimary">Recommended</Badge>}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{mode.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{mode.detail}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data handling</CardTitle>
            <CardDescription>Metadata-only is the safe default for hosted and hybrid deployments.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {dataHandlingOptions.map((mode) => {
              const isActive = currentDataHandlingMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => updateSettings({ dataHandlingMode: mode.id })}
                  disabled={isSaving}
                  className={cn(
                    "rounded-lg border p-4 text-left transition",
                    isActive ? "border-primary bg-primary/5" : "border-muted"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{mode.label}</span>
                    {mode.id === "metadata_only" && <Badge variant="outline">Default</Badge>}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{mode.description}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </SettingsSection>
    </>
  );
}

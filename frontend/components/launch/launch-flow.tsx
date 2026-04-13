"use client";

import { CheckCircle2, ClipboardCheck, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";

import AgentOnboarding from "@/components/agents/agent-onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjectContext } from "@/contexts/project-context";
import { useProductAnalytics } from "@/lib/analytics/use-product-analytics";
import { Agent } from "@/lib/agents/types";
import { useToast } from "@/lib/hooks/use-toast";
import { cn, swrFetcher } from "@/lib/utils";

type SafetyTemplate = {
  id: string;
  name: string;
  description?: string | null;
};

type TemplateApplication = {
  id: string;
  templateId: string;
  templateName: string;
  appliedAt: string;
  revertedAt: string | null;
};

type ReadinessCheck = {
  name: string;
  status: "pass" | "fail";
  details: Record<string, any>;
};

type ReadinessResponse = {
  status: "READY" | "NOT READY";
  label: string;
  checks: ReadinessCheck[];
};

const PRESET_OPTIONS = [
  {
    id: "general",
    name: "General Agent",
    description: "Balanced protection for most public-channel agents.",
    recommended: true,
  },
  {
    id: "healthcare",
    name: "Healthcare",
    description: "Strict controls for regulated or patient-facing workflows.",
    recommended: false,
  },
  {
    id: "finance",
    name: "Finance",
    description: "High-scrutiny preset for financial workflows and PII.",
    recommended: false,
  },
] as const;

export default function LaunchFlow() {
  const router = useRouter();
  const { projectId } = useParams();
  const { project } = useProjectContext();
  const { toast } = useToast();
  const { track } = useProductAnalytics();
  const projectKey = Array.isArray(projectId) ? projectId[0] : projectId;

  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [presetLoading, setPresetLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [reviewedPlans, setReviewedPlans] = useState(false);

  const { data: templatesData } = useSWR<{ items: SafetyTemplate[] }>(
    projectKey ? `/api/projects/${projectKey}/safety-templates?includeMarketplace=true` : null,
    swrFetcher
  );

  const { data: applicationsData } = useSWR<{ items: TemplateApplication[] }>(
    projectKey ? `/api/projects/${projectKey}/safety-templates/applications` : null,
    swrFetcher
  );

  const { data: agentsData } = useSWR<{ items: Agent[] }>(
    projectKey ? `/api/projects/${projectKey}/agents` : null,
    swrFetcher
  );

  const templates = templatesData?.items ?? [];
  const applications = applicationsData?.items ?? [];
  const agents = agentsData?.items ?? [];

  const activeApplication = useMemo(
    () =>
      applications.find(
        (item) => !item.revertedAt && PRESET_OPTIONS.some((preset) => preset.name === item.templateName)
      ) ?? null,
    [applications]
  );

  useEffect(() => {
    if (activeApplication?.templateName) {
      setActivePreset(activeApplication.templateName);
    }
  }, [activeApplication]);

  const hasAgent = agents.length > 0;
  const connectedAgent = agents.find((agent) => agent.connectionStatus === "connected");
  const demoAgent = agents.find((agent) => {
    const channelConfig = agent.channelConfig as Record<string, any> | null | undefined;
    return Boolean(channelConfig?.demo) || agent.externalBotId?.startsWith("demo-");
  });

  const handleApplyPreset = async (presetName: string) => {
    if (!projectKey || presetLoading) return;
    const template = templates.find((item) => item.name === presetName);
    if (!template) {
      toast({ title: "Preset not available yet", description: "Refresh and try again in a moment." });
      return;
    }

    setPresetLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectKey}/safety-templates/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to apply preset");
      }

      setActivePreset(presetName);
      mutate(`/api/projects/${projectKey}/safety-templates/applications`);
      toast({ title: "Preset applied", description: `${presetName} guardrails are now active.` });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Unable to apply preset",
        variant: "destructive",
      });
    } finally {
      setPresetLoading(false);
    }
  };

  const handleRunDemo = async () => {
    if (!projectKey || demoLoading) return;
    setDemoLoading(true);
    try {
      await fetch(`/api/projects/${projectKey}/demo/seed`, { method: "POST" });
      track({ name: "demo_started", projectId: projectKey });
      mutate(`/api/projects/${projectKey}/agents`);
      mutate(`/api/projects/${projectKey}/agents/activity`);
      toast({ title: "Demo activity seeded", description: "Mission Control now includes realistic activity." });
      await handleReadinessCheck();
    } catch (error) {
      toast({
        title: "Unable to run demo",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDemoLoading(false);
    }
  };

  const handleReadinessCheck = async () => {
    if (readinessLoading) return;
    setReadinessLoading(true);
    try {
      const res = await fetch("/api/readiness");
      const data = (await res.json()) as ReadinessResponse;
      setReadiness(data);
    } catch (error) {
      toast({
        title: "Readiness check failed",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setReadinessLoading(false);
    }
  };

  const handleReviewPlans = () => {
    if (!projectKey) return;
    track({ name: "upgrade_clicked", projectId: projectKey, metadata: { source: "launch_readiness" } });
    setReviewedPlans(true);
    router.push("/pricing");
  };

  useEffect(() => {
    if (demoAgent && hasAgent && reviewedPlans) {
      void handleReadinessCheck();
    }
  }, [demoAgent, hasAgent, reviewedPlans]);

  return (
    <div className="flex flex-col gap-6 px-6 pb-16">
      <div className="space-y-2">
        <Badge variant="outline" className="text-xs uppercase tracking-wide">
          5-minute agent protection
        </Badge>
        <h1 className="text-2xl font-semibold text-foreground">Launch TruthChecker in minutes</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          TruthChecker connects to your runtime and applies guardrails without changing agent logic. Complete the steps below
          to move into a verified ready state.
        </p>
        <p className="text-xs text-muted-foreground max-w-2xl">
          No Docker or CLI required for hosted or hybrid deployments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Create org + project</CardTitle>
          <CardDescription>Your workspace and project are ready.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Project <span className="text-foreground font-medium">{project?.name ?? "TruthChecker Project"}</span> is live.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Choose a policy preset</CardTitle>
          <CardDescription>Pick a guardrail preset tailored to your use case.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {PRESET_OPTIONS.map((preset) => {
            const isSelected = activePreset === preset.name;
            return (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  "rounded-lg border p-4 text-left transition",
                  isSelected ? "border-primary bg-primary/5" : "border-muted"
                )}
                onClick={() => handleApplyPreset(preset.name)}
                disabled={presetLoading}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{preset.name}</div>
                  {preset.recommended && <Badge variant="outlinePrimary">Recommended</Badge>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{preset.description}</p>
                {isSelected && (
                  <div className="mt-3 text-xs text-emerald-600 flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" /> Active preset
                  </div>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Connect your first agent</CardTitle>
          <CardDescription>
            Register your runtime, choose guardrails, and generate the copy-paste snippet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AgentOnboarding />
          <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            {hasAgent ? (
              <>
                {connectedAgent ? (
                  <span>
                    Connection status: <span className="text-foreground font-medium">Connected</span>
                  </span>
                ) : (
                  <span>
                    Connection status: <span className="text-foreground font-medium">Configured</span> · Paste the
                    snippet into your runtime to receive live activity.
                  </span>
                )}
              </>
            ) : (
              <>No agents registered yet. Completing the form above will create your first agent.</>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Run the mandatory demo</CardTitle>
          <CardDescription>Demo mode proves TruthChecker blocks and incidents without touching production.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={handleRunDemo} disabled={demoLoading}>
            <Rocket className="mr-2 h-4 w-4" />
            {demoAgent ? "Demo completed" : "Run demo now"}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/project/${projectKey}/mission-control?demo=1`)}>
            View demo in Mission Control
          </Button>
          {demoAgent && (
            <Badge variant="outline" className="text-emerald-700 border-emerald-200">
              Demo complete
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Readiness label</CardTitle>
          <CardDescription>Issue a readiness label once demo activity and controls are verified.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleReviewPlans}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Review plans
            </Button>
            <Button onClick={handleReadinessCheck} disabled={readinessLoading || !demoAgent}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate readiness label
            </Button>
            {!demoAgent && <span className="text-xs text-muted-foreground">Demo required before readiness.</span>}
          </div>

          {readiness && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{readiness.label}</div>
                <Badge variant={readiness.status === "READY" ? "outlinePrimary" : "outline"}>
                  {readiness.status}
                </Badge>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground">
                {readiness.checks.map((check) => (
                  <div key={check.name} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        check.status === "pass" ? "bg-emerald-500" : "bg-amber-500"
                      )}
                    />
                    <span className="capitalize">{check.name.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            TruthChecker readiness is emitted only after demo validation, runtime connection, and upgrade visibility checks.
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => router.push(`/project/${projectKey}/mission-control`)}>
          <ShieldCheck className="mr-2 h-4 w-4" />
          Go to Mission Control
        </Button>
        <Button variant="ghost" onClick={() => router.push(`/project/${projectKey}/agents`)}>
          Manage agents
        </Button>
      </div>
    </div>
  );
}

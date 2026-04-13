"use client";

import { ShieldCheck, ShieldAlert } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useProjectContext } from "@/contexts/project-context";
import { useProductAnalytics } from "@/lib/analytics/use-product-analytics";
import { useToast } from "@/lib/hooks/use-toast";
import { swrFetcher } from "@/lib/utils";
import { Policy, updatePolicy } from "@/lib/actions/policies";

const DEFAULT_GUARDRAILS = {
  blockInstructionOverrides: true,
  askBeforeRiskyActions: true,
  limitResponseFrequency: true,
  pauseOnUncertainty: true,
  disableExternalTools: false,
};

type GuardrailsConfig = typeof DEFAULT_GUARDRAILS;

const GUARDRAIL_RULE_TAG = "clawops_guardrails";

const GUARDRAIL_PRESETS = [
  {
    id: "safe",
    label: "Safe",
    description: "Strict guardrails with frequent pauses on risk.",
    config: {
      blockInstructionOverrides: true,
      askBeforeRiskyActions: true,
      limitResponseFrequency: true,
      pauseOnUncertainty: true,
      disableExternalTools: true,
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Recommended mix of autonomy and oversight.",
    config: {
      blockInstructionOverrides: true,
      askBeforeRiskyActions: true,
      limitResponseFrequency: true,
      pauseOnUncertainty: true,
      disableExternalTools: false,
    },
  },
  {
    id: "autonomous",
    label: "Autonomous",
    description: "Minimal friction with core safeguards only.",
    config: {
      blockInstructionOverrides: true,
      askBeforeRiskyActions: false,
      limitResponseFrequency: false,
      pauseOnUncertainty: false,
      disableExternalTools: false,
    },
  },
] as const;

type GuardrailPresetId = (typeof GUARDRAIL_PRESETS)[number]["id"];

type SafetyTemplate = {
  id: string;
  name: string;
  description?: string | null;
  version: number;
  guardrailsConfig: Record<string, any>;
  threatProtectionConfig: Record<string, any>;
  visibility: string;
  isPublished: boolean;
};

type TemplateApplication = {
  id: string;
  templateId: string;
  appliedAt: string;
  revertedAt?: string | null;
  templateName: string;
  templateVersion: number;
};

const parseGuardrailsConfig = (policy?: Policy | null): GuardrailsConfig => {
  const config = policy?.custom_prompts?.guardrails_config;
  if (!config) return DEFAULT_GUARDRAILS;

  try {
    const parsed = JSON.parse(config);
    return { ...DEFAULT_GUARDRAILS, ...parsed };
  } catch (error) {
    return DEFAULT_GUARDRAILS;
  }
};

const getPresetId = (config: GuardrailsConfig): GuardrailPresetId => {
  const disabled = Object.values(config).filter((value) => value === false).length;
  if (disabled === 0) return "safe";
  if (disabled <= 2) return "balanced";
  return "autonomous";
};

const buildContextRules = (guardrails: GuardrailsConfig, existingRules: any[] = []) => {
  const preservedRules = existingRules.filter((rule) => rule?.source !== GUARDRAIL_RULE_TAG);

  if (!guardrails.blockInstructionOverrides) {
    return preservedRules;
  }

  const guardrailRules = [
    {
      source: GUARDRAIL_RULE_TAG,
      function: "*",
      condition: {
        contains_keywords: [
          "ignore previous",
          "override system",
          "forget instructions",
          "reveal system prompt",
          "jailbreak",
        ],
        severity: ">=low",
      },
      action: {
        block: true,
        reason: "Instruction override attempt detected",
      },
    },
  ];

  return [...preservedRules, ...guardrailRules];
};

const buildPolicyUpdate = (guardrails: GuardrailsConfig, policy?: Policy | null) => {
  const customPrompts = {
    ...(policy?.custom_prompts ?? {}),
    guardrails_config: JSON.stringify(guardrails),
  };

  const decision_thresholds = {
    block_threshold: guardrails.blockInstructionOverrides ? 0.55 : 0.7,
    allow_threshold: guardrails.askBeforeRiskyActions ? 0.25 : 0.35,
    use_severity_fallback: true,
    pause_on_uncertainty: guardrails.pauseOnUncertainty,
  };

  const severity_rules = {
    safe: { allow_function_calls: true, allow_output_use: true, block: false },
    low: { allow_function_calls: true, allow_output_use: true, block: false },
    medium: {
      allow_function_calls: false,
      allow_output_use: !guardrails.askBeforeRiskyActions,
      block: false,
    },
    high: { allow_function_calls: false, allow_output_use: false, block: true },
    critical: { allow_function_calls: false, allow_output_use: false, block: true },
  };

  const output_restrictions = {
    "*": {
      cannot_trigger_functions: guardrails.disableExternalTools,
      max_responses_per_minute: guardrails.limitResponseFrequency ? 12 : undefined,
    },
  };

  const function_chaining = {
    "*": guardrails.disableExternalTools
      ? {
          allowed_targets: [],
          blocked_targets: ["*"],
          description: "External tools disabled by guardrails.",
        }
      : {
          allowed_targets: ["*"],
          blocked_targets: [],
          description: "External tools allowed by guardrails.",
        },
  };

  const context_rules = buildContextRules(guardrails, policy?.context_rules ?? []);

  return {
    custom_prompts: customPrompts,
    decision_thresholds,
    severity_rules,
    output_restrictions,
    function_chaining,
    context_rules,
  };
};

export default function Guardrails() {
  const { projectId } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { project, workspace } = useProjectContext();
  const { track } = useProductAnalytics();
  const projectKey = Array.isArray(projectId) ? projectId[0] : projectId;
  const controlsLocked = Boolean(project?.isFreeTier);

  const { data: policies, isLoading, mutate: mutatePolicies } = useSWR<Policy[]>(
    projectId ? `/api/projects/${projectId}/policies` : null,
    swrFetcher
  );

  const { data: templatesData, mutate: mutateTemplates } = useSWR<{ items: SafetyTemplate[] }>(
    projectId ? `/api/projects/${projectId}/safety-templates?includeMarketplace=true` : null,
    swrFetcher
  );

  const { data: applicationsData, mutate: mutateApplications } = useSWR<{ items: TemplateApplication[] }>(
    projectId ? `/api/projects/${projectId}/safety-templates/applications` : null,
    swrFetcher
  );

  const policy = useMemo(() => {
    if (!policies || policies.length === 0) return null;
    return policies.find((item) => item.is_default) ?? policies[0];
  }, [policies]);

  const [guardrails, setGuardrails] = useState<GuardrailsConfig>(DEFAULT_GUARDRAILS);
  const [baseline, setBaseline] = useState<GuardrailsConfig>(DEFAULT_GUARDRAILS);
  const [isSaving, setIsSaving] = useState(false);
  const [isTemplateAction, setIsTemplateAction] = useState(false);
  const [presetId, setPresetId] = useState<GuardrailPresetId>("safe");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advancedSummary = useMemo(() => {
    return {
      blockThreshold: guardrails.blockInstructionOverrides ? 0.55 : 0.7,
      allowThreshold: guardrails.askBeforeRiskyActions ? 0.25 : 0.35,
      maxResponsesPerMinute: guardrails.limitResponseFrequency ? 12 : "Unlimited",
      pauseOnUncertainty: guardrails.pauseOnUncertainty ? "Enabled" : "Disabled",
    };
  }, [guardrails]);

  useEffect(() => {
    if (!policy) return;
    const config = parseGuardrailsConfig(policy);
    setGuardrails(config);
    setBaseline(config);
    setPresetId(getPresetId(config));
  }, [policy?.id]);

  const templates = useMemo(() => templatesData?.items ?? [], [templatesData]);
  const applications = useMemo(() => applicationsData?.items ?? [], [applicationsData]);
  const latestApplication = useMemo(
    () => applications.find((app) => !app.revertedAt) ?? applications[0],
    [applications]
  );

  useEffect(() => {
    setPresetId(getPresetId(guardrails));
  }, [guardrails]);

  const isDirty = useMemo(() => JSON.stringify(guardrails) !== JSON.stringify(baseline), [guardrails, baseline]);

  const handlePresetSelect = (preset: (typeof GUARDRAIL_PRESETS)[number]) => {
    setPresetId(preset.id);
    setGuardrails(preset.config);
  };

  const handleUpgradeClick = () => {
    if (!projectKey) return;
    track({ name: "upgrade_clicked", projectId: projectKey, metadata: { source: "guardrails" } });
    const target = workspace?.id ? `/workspace/${workspace.id}?tab=usage` : "/pricing";
    router.push(target);
  };

  const handleSave = async () => {
    if (!policy || !projectId) return;

    setIsSaving(true);
    try {
      const updatePayload = buildPolicyUpdate(guardrails, policy);
      await updatePolicy(projectId as string, policy.id, updatePayload);

      await fetch(`/api/projects/${projectId}/agents/guardrails`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guardrailsConfig: guardrails }),
      });

      setBaseline(guardrails);
      toast({ title: "Guardrails updated" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to update guardrails",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    if (!projectId) return;
    setIsTemplateAction(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/safety-templates/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to apply template");
      }
      await Promise.all([mutateTemplates(), mutateApplications(), mutatePolicies()]);
      toast({ title: "Template applied", description: "Guardrails and threat protections updated." });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to apply template",
        variant: "destructive",
      });
    } finally {
      setIsTemplateAction(false);
    }
  };

  const handleRevertTemplate = async (applicationId: string) => {
    if (!projectId) return;
    setIsTemplateAction(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/safety-templates/applications/${applicationId}/revert`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to revert template");
      }
      await Promise.all([mutateTemplates(), mutateApplications(), mutatePolicies()]);
      toast({ title: "Template reverted", description: "Previous guardrails restored." });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to revert template",
        variant: "destructive",
      });
    } finally {
      setIsTemplateAction(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading guardrails...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="px-6">
        <Card>
          <CardHeader>
            <CardTitle>Guardrails unavailable</CardTitle>
            <CardDescription>Create a guardrail profile to configure guardrails.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <CardTitle>Guardrails</CardTitle>
          </div>
          <CardDescription>
            Toggle the safety behaviors TruthChecker enforces for every agent. These settings map to TruthChecker safety rules under the hood.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="text-sm font-medium">Preset</div>
            <div className="grid gap-3 md:grid-cols-3">
              {GUARDRAIL_PRESETS.map((preset) => {
                const isSelected = presetId === preset.id;
                const isLocked = controlsLocked && preset.id === "autonomous";
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        handleUpgradeClick();
                        return;
                      }
                      handlePresetSelect(preset);
                    }}
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      isSelected ? "border-primary bg-primary/5" : "border-muted"
                    } ${isLocked ? "opacity-60 cursor-not-allowed" : "hover:border-primary/60"}`}
                    aria-disabled={isLocked}
                  >
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-xs text-muted-foreground">{preset.description}</div>
                    {isLocked && <div className="text-xs text-muted-foreground mt-1">Upgrade required</div>}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Advanced</span>
              <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
            </div>
            {showAdvanced && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Advanced thresholds</div>
                <div className="mt-2 space-y-1">
                  <div>
                    Block threshold: <span className="text-foreground">{advancedSummary.blockThreshold}</span>
                  </div>
                  <div>
                    Allow threshold: <span className="text-foreground">{advancedSummary.allowThreshold}</span>
                  </div>
                  <div>
                    Max responses/min: <span className="text-foreground">{advancedSummary.maxResponsesPerMinute}</span>
                  </div>
                  <div>
                    Pause on uncertainty: <span className="text-foreground">{advancedSummary.pauseOnUncertainty}</span>
                  </div>
                </div>
              </div>
            )}
            {controlsLocked && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                <div className="font-medium text-foreground">Upgrade for advanced controls</div>
                <p className="text-muted-foreground">
                  Auto-pause and approval mode unlock on Pro or Enterprise plans to keep operators in the loop.
                </p>
                <Button size="sm" variant="outline" className="mt-2" onClick={handleUpgradeClick}>
                  Upgrade
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Block instruction overrides</p>
              <p className="text-xs text-muted-foreground">Stops users from rewriting system rules.</p>
            </div>
            <Switch
              checked={guardrails.blockInstructionOverrides}
              onCheckedChange={(checked) =>
                setGuardrails((prev) => ({ ...prev, blockInstructionOverrides: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Ask before risky actions</p>
              <p className="text-xs text-muted-foreground">Require confirmation on high-risk replies.</p>
            </div>
            <Switch
              checked={guardrails.askBeforeRiskyActions}
              disabled={controlsLocked}
              onCheckedChange={(checked) =>
                setGuardrails((prev) => ({ ...prev, askBeforeRiskyActions: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Limit response frequency</p>
              <p className="text-xs text-muted-foreground">Helps prevent spam or runaway loops.</p>
            </div>
            <Switch
              checked={guardrails.limitResponseFrequency}
              onCheckedChange={(checked) =>
                setGuardrails((prev) => ({ ...prev, limitResponseFrequency: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Pause on uncertainty</p>
              <p className="text-xs text-muted-foreground">Automatically pause when confidence drops.</p>
            </div>
            <Switch
              checked={guardrails.pauseOnUncertainty}
              disabled={controlsLocked}
              onCheckedChange={(checked) =>
                setGuardrails((prev) => ({ ...prev, pauseOnUncertainty: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Disable external tools</p>
              <p className="text-xs text-muted-foreground">Prevents tool calls or external actions.</p>
            </div>
            <Switch
              checked={guardrails.disableExternalTools}
              onCheckedChange={(checked) =>
                setGuardrails((prev) => ({ ...prev, disableExternalTools: checked }))
              }
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4" />
              Guardrails apply to all agents in this project.
            </div>
            <Button disabled={!isDirty || isSaving} onClick={handleSave}>
              {isSaving ? "Saving..." : "Save guardrails"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safety templates</CardTitle>
          <CardDescription>Apply curated guardrails and threat protections in one click.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestApplication && !latestApplication.revertedAt && (
            <div className="rounded-lg border bg-muted/40 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Active template</div>
                <div className="text-xs text-muted-foreground">
                  {latestApplication.templateName} · v{latestApplication.templateVersion}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isTemplateAction}
                onClick={() => handleRevertTemplate(latestApplication.id)}
              >
                Revert template
              </Button>
            </div>
          )}

          {templates.length === 0 ? (
            <div className="text-sm text-muted-foreground">No templates available yet.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((template) => (
                <div key={template.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{template.name}</div>
                    <Badge variant="outline" className="text-xs">
                      {template.visibility === "marketplace" ? "Marketplace" : "Private"} · v{template.version}
                    </Badge>
                  </div>
                  {template.description && (
                    <div className="text-xs text-muted-foreground">{template.description}</div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isTemplateAction}
                    onClick={() => handleApplyTemplate(template.id)}
                  >
                    Apply template
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

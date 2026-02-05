"use client";

import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Phone,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CodeHighlighter from "@/components/ui/code-highlighter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectContext } from "@/contexts/project-context";
import { useProductAnalytics } from "@/lib/analytics/use-product-analytics";
import { GenerateProjectApiKeyResponse } from "@/lib/api-keys/types";
import { useToast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";

const CHANNELS = [
  { id: "telegram", label: "Telegram", description: "Public chat or support channel", icon: Send },
  { id: "discord", label: "Discord", description: "Community server or private channel", icon: MessageCircle },
  { id: "whatsapp", label: "WhatsApp", description: "Business inbox or support number", icon: MessagesSquare },
  { id: "sms", label: "SMS", description: "Phone-based conversations", icon: Phone },
] as const;

const ENVIRONMENTS = [
  { id: "local", label: "Local", description: "Local machine or dev box" },
  { id: "staging", label: "Staging", description: "Pre-production validation" },
  { id: "prod", label: "Production", description: "Live customer traffic" },
] as const;

const RUNTIME_TYPES = [
  { id: "custom", label: "Custom runtime" },
  { id: "clawbot", label: "ClawBot" },
  { id: "langchain", label: "LangChain" },
  { id: "other", label: "Other" },
] as const;

const GUARDRAIL_PRESETS = [
  {
    id: "safe",
    label: "Safe",
    description: "Tight controls with frequent pauses on risk.",
    allows: "Low-risk responses and safe tool calls",
    blocks: "Instruction overrides and risky actions",
    pauses: "Quickly when confidence drops",
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
    description: "Recommended blend of autonomy and oversight.",
    allows: "Most responses with approval checks",
    blocks: "Instruction overrides and unsafe output",
    pauses: "When risk climbs or guardrails repeat",
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
    description: "Minimal friction with core safety checks.",
    allows: "Faster responses and tooling",
    blocks: "Instruction overrides only",
    pauses: "Only for extreme risk",
    config: {
      blockInstructionOverrides: true,
      askBeforeRiskyActions: false,
      limitResponseFrequency: false,
      pauseOnUncertainty: false,
      disableExternalTools: false,
    },
  },
] as const;

type ChannelId = (typeof CHANNELS)[number]["id"];

type EnvironmentId = (typeof ENVIRONMENTS)[number]["id"];

type GuardrailPresetId = (typeof GUARDRAIL_PRESETS)[number]["id"];

type ConnectionState = "idle" | "loading" | "ready" | "error";

const getPreset = (id: GuardrailPresetId) => GUARDRAIL_PRESETS.find((preset) => preset.id === id)!;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const generateSuffix = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

export default function AgentOnboarding() {
  const router = useRouter();
  const { projectId } = useParams();
  const { toast } = useToast();
  const { project, workspace } = useProjectContext();
  const { track } = useProductAnalytics();
  const projectKey = Array.isArray(projectId) ? projectId[0] : projectId;
  const isFreeTier = Boolean(project?.isFreeTier);

  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<ChannelId>("telegram");
  const [environment, setEnvironment] = useState<EnvironmentId>("local");
  const [agentName, setAgentName] = useState("");
  const [agentRuntimeId, setAgentRuntimeId] = useState("");
  const [runtimeIdTouched, setRuntimeIdTouched] = useState(false);
  const [runtimeType, setRuntimeType] = useState<string>(RUNTIME_TYPES[0].id);
  const [partnerId, setPartnerId] = useState("");
  const [guardrailPreset, setGuardrailPreset] = useState<GuardrailPresetId>("safe");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [agentRecordId, setAgentRecordId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const channelMeta = useMemo(() => CHANNELS.find((item) => item.id === channel), [channel]);

  const handleUpgradeClick = (source: string) => {
    if (!projectKey) return;
    track({ name: "upgrade_clicked", projectId: projectKey, metadata: { source } });
    const target = workspace?.id ? `/workspace/${workspace.id}?tab=usage` : "/pricing";
    router.push(target);
  };

  useEffect(() => {
    if (runtimeIdTouched) return;
    const slug = slugify(agentName);
    if (!slug) return;
    setAgentRuntimeId(slug);
  }, [agentName, runtimeIdTouched]);

  const nextEnabled = useMemo(() => {
    if (step === 0) return agentName.trim().length > 0;
    return true;
  }, [step, agentName]);

  const resolvedRuntimeId = useMemo(() => {
    if (agentRuntimeId.trim()) return agentRuntimeId.trim();
    const slug = slugify(agentName);
    return slug || `agent-${generateSuffix()}`;
  }, [agentRuntimeId, agentName]);

  const runtimeEnvSnippet = useMemo(() => {
    const keyLine = apiKey ? `CLAWOPS_API_KEY=${apiKey}` : "CLAWOPS_API_KEY=<YOUR_API_KEY>";
    const idLine = `AGENT_ID=${resolvedRuntimeId}`;
    const envLine = `CLAWOPS_ENVIRONMENT=${environment}`;
    const runtimeLine = `CLAWOPS_RUNTIME_TYPE=${runtimeType || "custom"}`;
    const partnerLine = partnerId ? `CLAWOPS_PARTNER_ID=${partnerId}` : "CLAWOPS_PARTNER_ID=<OPTIONAL>";
    return `${keyLine}\n${idLine}\n${envLine}\n${runtimeLine}\n${partnerLine}`;
  }, [apiKey, resolvedRuntimeId, environment, runtimeType, partnerId]);

  const typescriptSnippet = useMemo(() => {
    return `import { ClawOps } from "@clawops/runtime";

const clawops = new ClawOps({
  apiKey: process.env.CLAWOPS_API_KEY,
  agentId: "${resolvedRuntimeId}",
  channel: "${channel}",
  environment: "${environment}",
  runtimeType: "${runtimeType}",
  partnerId: ${partnerId ? `"${partnerId}"` : "undefined"}
});

const llm = clawops.wrapLLM(openai);`;
  }, [channel, resolvedRuntimeId, environment, runtimeType, partnerId]);

  const pythonSnippet = useMemo(() => {
    return `from clawops import ClawOps

clawops = ClawOps(
  api_key=os.getenv("CLAWOPS_API_KEY"),
  agent_id="${resolvedRuntimeId}",
  channel="${channel}",
  environment="${environment}",
  runtime_type="${runtimeType}",
  partner_id=${partnerId ? `"${partnerId}"` : "None"}
)

llm = clawops.wrap_llm(openai_client)`;
  }, [channel, resolvedRuntimeId, environment, runtimeType, partnerId]);

  const handleGenerateConnection = async () => {
    if (!projectKey || connectionState === "loading" || connectionState === "ready") return;

    setConnectionState("loading");
    setIsSubmitting(true);

    const runtimeId = resolvedRuntimeId || `agent-${generateSuffix()}`;
    setAgentRuntimeId(runtimeId);

    try {
      const [apiKeyResponse, agentResponse] = await Promise.all([
        fetch(`/api/projects/${projectKey}/api-keys`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `clawops-${runtimeId}-runtime`,
            isIngestOnly: false,
          }),
        }),
        fetch(`/api/projects/${projectKey}/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: agentName,
            channel,
            externalBotId: runtimeId,
            environment,
            partnerId: partnerId || undefined,
            runtimeType: runtimeType || undefined,
            guardrailsConfig: getPreset(guardrailPreset).config,
            channelConfig: {
              label: channelMeta?.label,
              environment,
            },
          }),
        }),
      ]);

      if (!apiKeyResponse.ok) {
        const text = await apiKeyResponse.text();
        throw new Error(text || "Failed to generate API key");
      }

      if (!agentResponse.ok) {
        const text = await agentResponse.text();
        throw new Error(text || "Failed to connect agent");
      }

      const apiKeyData = (await apiKeyResponse.json()) as GenerateProjectApiKeyResponse;
      const agent = await agentResponse.json();

      setApiKey(apiKeyData.value);
      setAgentRecordId(agent.id);
      setConnectionState("ready");

      toast({ title: "Connection ready", description: "Paste the snippet into your runtime." });
    } catch (error) {
      setConnectionState("error");
      toast({
        title: error instanceof Error ? error.message : "Unable to connect agent",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (step === 2) {
      void handleGenerateConnection();
    }
  }, [step]);

  const handleFinish = () => {
    if (!projectKey) return;
    if (agentRecordId) {
      router.push(`/project/${projectKey}/agents/${agentRecordId}`);
      return;
    }
    router.push(`/project/${projectKey}/mission-control`);
  };

  return (
    <div className="px-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Connect your agent runtime</CardTitle>
          <CardDescription>
            Step {step + 1} of 3 · ClawOps connects to your agent runtime. No changes to agent logic required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 0 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="agent_name">Agent name</Label>
                <Input
                  id="agent_name"
                  placeholder="Support concierge"
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">Channel</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {CHANNELS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = channel === item.id;
                    const isLocked = isFreeTier && (item.id === "whatsapp" || item.id === "sms");
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (isLocked) {
                            handleUpgradeClick(`channel_${item.id}`);
                            return;
                          }
                          setChannel(item.id);
                        }}
                        className={cn(
                          "rounded-lg border px-4 py-3 text-left transition",
                          isSelected ? "border-primary bg-primary/5" : "border-muted",
                          isLocked ? "opacity-60 cursor-not-allowed" : "hover:border-primary/60"
                        )}
                        aria-disabled={isLocked}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="mt-1 h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{item.label}</div>
                            <div className="text-xs text-muted-foreground">{item.description}</div>
                            {isLocked && <Badge variant="outline" className="mt-2">Upgrade required</Badge>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {isFreeTier && (
                  <p className="text-xs text-muted-foreground">
                    WhatsApp and SMS connections unlock on paid plans for compliance and carrier approvals.
                  </p>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">Environment</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {ENVIRONMENTS.map((item) => {
                    const isSelected = environment === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setEnvironment(item.id)}
                        className={cn(
                          "rounded-lg border px-4 py-3 text-left transition",
                          isSelected ? "border-primary bg-primary/5" : "border-muted"
                        )}
                      >
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">Runtime type</p>
                <div className="grid gap-3 md:grid-cols-4">
                  {RUNTIME_TYPES.map((item) => {
                    const isSelected = runtimeType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setRuntimeType(item.id)}
                        className={cn(
                          "rounded-lg border px-4 py-3 text-left transition",
                          isSelected ? "border-primary bg-primary/5" : "border-muted"
                        )}
                      >
                        <div className="font-medium">{item.label}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Used for partner reporting and audit exports.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner_id">Partner ID (optional)</Label>
                <Input
                  id="partner_id"
                  placeholder="partner-123"
                  value={partnerId}
                  onChange={(event) => setPartnerId(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Required only for OEM or partner integrations.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent_runtime_id">Agent ID for runtime (AGENT_ID)</Label>
                <Input
                  id="agent_runtime_id"
                  placeholder="support-bot"
                  value={agentRuntimeId}
                  onChange={(event) => {
                    setAgentRuntimeId(event.target.value);
                    setRuntimeIdTouched(true);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  This ID is used in your runtime config. We'll generate one if you leave it blank.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Guardrail preset
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {GUARDRAIL_PRESETS.map((preset) => {
                  const isSelected = guardrailPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setGuardrailPreset(preset.id)}
                      className={cn(
                        "rounded-lg border px-4 py-4 text-left transition",
                        isSelected ? "border-primary bg-primary/5" : "border-muted"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{preset.label}</div>
                        {isSelected && <Badge variant="outlinePrimary">Selected</Badge>}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">{preset.description}</div>
                      <div className="mt-3 space-y-2 text-xs">
                        <div>
                          <span className="font-medium text-foreground">Allows:</span> {preset.allows}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Blocks:</span> {preset.blocks}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Pauses:</span> {preset.pauses}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
                You can tune guardrails later from the Guardrails tab or override for a single agent.
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="outlinePrimary">{agentName || "Agent"}</Badge>
                <span className="text-muted-foreground">{channelMeta?.label}</span>
                <span className="text-muted-foreground">{environment.toUpperCase()}</span>
                <span className="text-muted-foreground">{runtimeType}</span>
                <span className="text-muted-foreground">Guardrails: {getPreset(guardrailPreset).label}</span>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {connectionState === "ready" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Loader2 className={cn("h-4 w-4", connectionState === "loading" ? "animate-spin" : "")} />
                  )}
                  {connectionState === "ready" ? "Connection details" : "Generating connection details"}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Copy these values into your runtime configuration.
                </p>
                <div className="mt-4">
                  <CodeHighlighter
                    language="bash"
                    copyable
                    className="text-xs bg-background p-4 rounded-md border [&_code]:break-all"
                    code={runtimeEnvSnippet}
                  />
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Wrap your LLM client</p>
                <p className="text-xs text-muted-foreground">
                  Replace your LLM client with this wrapped version to stream live activity into ClawOps.
                </p>
                <Tabs defaultValue="ts" className="mt-4">
                  <TabsList>
                    <TabsTrigger value="ts">Node / TypeScript</TabsTrigger>
                    <TabsTrigger value="py">Python</TabsTrigger>
                  </TabsList>
                  <TabsContent value="ts">
                    <CodeHighlighter
                      language="typescript"
                      copyable
                      className="text-xs bg-background p-4 rounded-md border"
                      code={typescriptSnippet}
                    />
                  </TabsContent>
                  <TabsContent value="py">
                    <CodeHighlighter
                      language="python"
                      copyable
                      className="text-xs bg-background p-4 rounded-md border"
                      code={pythonSnippet}
                    />
                  </TabsContent>
                </Tabs>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
                Once your runtime connects, you'll see "Agent connected" and the first activity event in Mission Control.
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              disabled={step === 0 || isSubmitting}
              onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
            >
              Back
            </Button>
            {step < 2 ? (
              <Button disabled={!nextEnabled} onClick={() => setStep((prev) => prev + 1)}>
                Continue
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                {connectionState === "error" && (
                  <Button variant="outline" onClick={handleGenerateConnection} disabled={isSubmitting}>
                    Retry connection
                  </Button>
                )}
                <Button disabled={connectionState !== "ready"} onClick={handleFinish}>
                  View agent
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

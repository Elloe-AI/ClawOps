"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  Slash,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";

import ClientTimestampFormatter from "@/components/client-timestamp-formatter";
import Header from "@/components/ui/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useProjectContext } from "@/contexts/project-context";
import { useProductAnalytics } from "@/lib/analytics/use-product-analytics";
import { useToast } from "@/lib/hooks/use-toast";
import {
  AGENT_CHANNEL_LABELS,
  AGENT_CONNECTION_LABELS,
  AGENT_ENVIRONMENT_LABELS,
  AGENT_STATUS_LABELS,
  Agent,
  AgentActivityEventWithAgent,
} from "@/lib/agents/types";
import { cn, swrFetcher } from "@/lib/utils";

const eventStyles: Record<string, { icon: typeof ShieldCheck; tone: string }> = {
  user_message_received: { icon: Clock, tone: "text-slate-500" },
  agent_response_sent: { icon: CheckCircle2, tone: "text-emerald-500" },
  agent_response_blocked: { icon: Slash, tone: "text-rose-500" },
  guardrail_triggered: { icon: ShieldAlert, tone: "text-amber-500" },
  agent_paused_auto: { icon: PauseCircle, tone: "text-amber-600" },
  agent_paused_manual: { icon: PauseCircle, tone: "text-amber-600" },
  agent_resumed: { icon: PlayCircle, tone: "text-emerald-500" },
  agent_connected: { icon: Bot, tone: "text-slate-500" },
  runtime_disconnected: { icon: AlertTriangle, tone: "text-amber-600" },
};

const statusTone: Record<string, string> = {
  running: "bg-emerald-100 text-emerald-800 border-emerald-200",
  paused: "bg-amber-100 text-amber-800 border-amber-200",
  blocked: "bg-rose-100 text-rose-800 border-rose-200",
};

const DEFAULT_GUARDRAILS = {
  blockInstructionOverrides: true,
  askBeforeRiskyActions: true,
  limitResponseFrequency: true,
  pauseOnUncertainty: true,
  disableExternalTools: false,
};

const getGuardrailPreset = (config: Record<string, any> | null | undefined) => {
  if (config && typeof config.presetLabel === "string" && config.presetLabel.trim().length > 0) {
    return config.presetLabel;
  }
  const merged = { ...DEFAULT_GUARDRAILS, ...(config ?? {}) };
  const disabled = Object.values(merged).filter((value) => value === false).length;
  if (disabled === 0) return "Safe";
  if (disabled <= 2) return "Balanced";
  return "Autonomous";
};

const getRiskLabel = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "Low";
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
};

const getStatusLabel = (status: Agent["status"]) => {
  if (status === "blocked") return "Needs Review";
  return AGENT_STATUS_LABELS[status] ?? status;
};

const buildEventHeadline = (event: AgentActivityEventWithAgent) => {
  const channelLabel = AGENT_CHANNEL_LABELS[event.agentChannel] ?? "Channel";
  const agentLabel = event.agentName || "Agent";
  switch (event.eventType) {
    case "user_message_received":
      return `User messaged ${agentLabel} (${channelLabel})`;
    case "agent_response_sent":
      if ((event.details as Record<string, any>)?.approvalCompleted) {
        return `Approval completed for ${agentLabel}`;
      }
      return `${agentLabel} replied to a user (${channelLabel})`;
    case "agent_response_blocked":
      return `Blocked response from ${agentLabel}`;
    case "guardrail_triggered":
      if ((event.details as Record<string, any>)?.approvalRequested) {
        return `Approval requested for ${agentLabel}`;
      }
      return `Guardrail triggered for ${agentLabel}`;
    case "agent_paused_auto":
      return `${agentLabel} auto-paused`;
    case "agent_paused_manual":
      return `${agentLabel} paused by operator`;
    case "agent_resumed":
      return `${agentLabel} resumed by operator`;
    case "agent_connected":
      return `${agentLabel} connected`;
    case "runtime_disconnected":
      return `${agentLabel} disconnected`;
    default:
      return event.summary || "Activity update";
  }
};

export default function MissionControl() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projectId } = useParams();
  const projectKey = Array.isArray(projectId) ? projectId[0] : projectId;
  const { toast } = useToast();
  const { project, workspace } = useProjectContext();
  const { track } = useProductAnalytics();
  const demoTrackedRef = useRef(false);

  const isDemo = searchParams.get("demo") === "1";
  const isFreeTier = Boolean(project?.isFreeTier);
  const controlsLocked = isFreeTier;
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isUpdatingAgent, setIsUpdatingAgent] = useState(false);

  useEffect(() => {
    if (!isDemo || !projectKey || demoTrackedRef.current) return;
    track({ name: "demo_started", projectId: projectKey });
    demoTrackedRef.current = true;
  }, [isDemo, projectKey, track]);

  const { data: agentsData, isLoading: isAgentsLoading } = useSWR<{ items: Agent[] }>(
    projectId ? `/api/projects/${projectId}/agents` : null,
    swrFetcher
  );

  const { data: eventsData } = useSWR<{ items: AgentActivityEventWithAgent[] }>(
    projectId ? `/api/projects/${projectId}/agents/activity` : null,
    swrFetcher
  );

  const agents = useMemo(() => agentsData?.items ?? [], [agentsData]);
  const events = useMemo(() => eventsData?.items ?? [], [eventsData]);
  const visibleAgents = useMemo(() => (isFreeTier ? agents.slice(0, 1) : agents), [agents, isFreeTier]);
  const hiddenAgentsCount = Math.max(0, agents.length - visibleAgents.length);
  const visibleAgentIds = useMemo(() => new Set(visibleAgents.map((agent) => agent.id)), [visibleAgents]);
  const visibleEvents = useMemo(
    () => (isFreeTier ? events.filter((event) => visibleAgentIds.has(event.agentId)) : events),
    [events, isFreeTier, visibleAgentIds]
  );
  const demoComplete = useMemo(
    () =>
      agents.some((agent) => {
        const channelConfig = agent.channelConfig as Record<string, any> | null | undefined;
        return Boolean(channelConfig?.demo) || agent.externalBotId?.startsWith("demo-");
      }),
    [agents]
  );

  useEffect(() => {
    if (selectedAgentId || visibleAgents.length === 0) return;
    setSelectedAgentId(visibleAgents[0].id);
  }, [visibleAgents, selectedAgentId]);

  useEffect(() => {
    if (!isDemo || !projectKey) return;
    fetch(`/api/projects/${projectKey}/demo/seed`, { method: "POST" })
      .then(() => {
        mutate(`/api/projects/${projectKey}/agents`);
        mutate(`/api/projects/${projectKey}/agents/activity`);
      })
      .catch(() => undefined);
  }, [isDemo, projectKey]);

  const selectedAgent = useMemo(
    () => visibleAgents.find((agent) => agent.id === selectedAgentId) ?? visibleAgents[0],
    [visibleAgents, selectedAgentId]
  );

  const latestBlockedEvent = useMemo(
    () =>
      visibleEvents.find(
        (event) => event.eventType === "agent_response_blocked" || event.eventType === "guardrail_triggered"
      ),
    [visibleEvents]
  );

  const checklist = useMemo(() => {
    const hasAgent = agents.length > 0;
    const runtimeConnected = events.some((event) =>
      ["user_message_received", "agent_response_sent", "agent_response_blocked", "guardrail_triggered"].includes(event.eventType)
    );
    const firstMessage = events.some((event) => event.eventType === "user_message_received");
    const firstBlock = events.some((event) => event.eventType === "agent_response_blocked");
    const firstPause = events.some((event) =>
      ["agent_paused_auto", "agent_paused_manual"].includes(event.eventType)
    );
    const pauseResumeTested = events.some((event) => event.eventType === "agent_resumed");

    return [
      { label: "Agent created", complete: hasAgent },
      { label: "Runtime connected", complete: runtimeConnected },
      { label: "First message received", complete: firstMessage },
      { label: "First block detected", complete: firstBlock },
      { label: "Pause / resume tested", complete: firstPause && pauseResumeTested },
      { label: "Demo run complete", complete: demoComplete },
    ];
  }, [agents.length, demoComplete, events]);

  const handleToggleStatus = async (agent: Agent) => {
    if (!projectId) return;
    const nextStatus = agent.status === "running" ? "paused" : "running";
    setIsUpdatingAgent(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          pauseReason: nextStatus === "paused" ? "Paused from Mission Control" : null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update agent");
      }

      await mutate(`/api/projects/${projectId}/agents`);
      await mutate(`/api/projects/${projectId}/agents/activity`);
      toast({ title: nextStatus === "paused" ? "Agent paused" : "Agent resumed" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Unable to update agent",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingAgent(false);
    }
  };

  const handleToggleGuardrail = async (agent: Agent, updates: Partial<typeof DEFAULT_GUARDRAILS>) => {
    if (controlsLocked) {
      handleUpgradeClick("guardrail_controls");
      return;
    }
    if (!projectId) return;
    const updatedConfig = { ...DEFAULT_GUARDRAILS, ...(agent.guardrailsConfig as Record<string, any>), ...updates };

    setIsUpdatingAgent(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardrailsConfig: updatedConfig,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update guardrails");
      }

      await mutate(`/api/projects/${projectId}/agents`);
      toast({ title: "Guardrails updated" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Unable to update guardrails",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingAgent(false);
    }
  };

  const handleUpgradeClick = (source: string) => {
    if (!projectKey) return;
    track({ name: "upgrade_clicked", projectId: projectKey, metadata: { source } });
    const target = workspace?.id ? `/workspace/${workspace.id}?tab=usage` : "/pricing";
    router.push(target);
  };

  if (!isAgentsLoading && agents.length === 0 && !isDemo) {
    return (
      <div className="flex flex-col h-full">
        <Header path={[{ name: "Mission Control" }]} />
        <div className="flex-1 px-6 pb-10">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Connect your first agent</CardTitle>
              <CardDescription>
                ClawOps watches live agents in public channels. Connect one to start monitoring safety and activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={() => router.push(`/project/${projectId}/launch`)}>
                Start 5-minute launch
              </Button>
              <Button onClick={() => router.push(`/project/${projectId}/agents/new`)}>
                Connect an agent
              </Button>
              <Button variant="outline" onClick={() => router.push(`/project/${projectId}/mission-control?demo=1`)}>
                Try demo
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header path={[{ name: "Mission Control" }]} />
      <div className="flex-1 px-6 pb-10">
        {isDemo && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Demo mode is active. No runtime connection required.
            <Button
              size="sm"
              variant="outline"
              className="ml-3"
              onClick={() => router.push(`/project/${projectId}/mission-control`)}
            >
              Exit demo
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent status</CardTitle>
                <CardDescription>Live status for every connected agent.</CardDescription>
              </CardHeader>
              <CardContent>
                {isFreeTier && hiddenAgentsCount > 0 && (
                  <div className="mb-4 rounded-lg border bg-muted/40 p-3 text-xs">
                    <div className="font-medium text-foreground">Multi-agent monitoring is locked</div>
                    <p className="text-muted-foreground">
                      Upgrade to monitor {hiddenAgentsCount} additional agent{hiddenAgentsCount > 1 ? "s" : ""}.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => handleUpgradeClick("multi_agent_monitoring")}
                    >
                      Upgrade
                    </Button>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {visibleAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className={cn(
                        "rounded-lg border p-4 space-y-3 cursor-pointer transition",
                        selectedAgent?.id === agent.id ? "border-primary bg-primary/5" : "border-muted"
                      )}
                      onClick={() => setSelectedAgentId(agent.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-base font-semibold">{agent.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {AGENT_CHANNEL_LABELS[agent.channel]} · {agent.externalBotId} ·{" "}
                            {AGENT_ENVIRONMENT_LABELS[agent.environment as keyof typeof AGENT_ENVIRONMENT_LABELS] ?? "Prod"}
                          </div>
                        </div>
                        <Badge variant="outline" className={cn("capitalize", statusTone[agent.status])}>
                          {getStatusLabel(agent.status)}
                        </Badge>
                      </div>
                      <div className="grid gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Last activity</span>
                          <span className="text-foreground">
                            {agent.lastActivityAt ? (
                              <ClientTimestampFormatter timestamp={String(agent.lastActivityAt)} />
                            ) : (
                              "No activity"
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Guardrail mode</span>
                          <span className="text-foreground">{getGuardrailPreset(agent.guardrailsConfig as Record<string, any>)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Connection</span>
                          <span className="text-foreground">
                            {AGENT_CONNECTION_LABELS[agent.connectionStatus ?? "configured"]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdatingAgent || controlsLocked}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleStatus(agent);
                          }}
                        >
                          {agent.status === "running" ? "Pause" : "Resume"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/project/${projectId}/agents/${agent.id}`);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Live activity</CardTitle>
                <CardDescription>Human-readable timeline of what agents are doing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {visibleEvents.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                    <AlertTriangle className="h-5 w-5" />
                    No activity yet. Connect your runtime to start streaming updates.
                  </div>
                )}
                {visibleEvents.map((event, index) => {
                  const style = eventStyles[event.eventType] ?? eventStyles.guardrail_triggered;
                  const Icon = style.icon;
                  const showConnector = index < visibleEvents.length - 1;
                  return (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn("rounded-full border bg-background p-2", style.tone)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {showConnector && <div className="h-full w-px bg-border" />}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium text-foreground">{buildEventHeadline(event)}</div>
                          <div className="text-xs text-muted-foreground">
                            <ClientTimestampFormatter timestamp={String(event.createdAt)} />
                          </div>
                        </div>
                        {event.reason && (
                          <div className="text-sm text-muted-foreground">Why: {event.reason}</div>
                        )}
                        {event.action && <div className="text-sm text-foreground">Action: {event.action}</div>}
                        <div className="flex flex-wrap gap-3 text-sm">
                          {event.traceId && (
                            <Button
                              size="sm"
                              variant="link"
                              className="px-0"
                              onClick={() =>
                                router.push(`/project/${projectId}/activity/${event.traceId}`)
                              }
                            >
                              Technical details
                            </Button>
                          )}
                          {event.incidentId && (
                            <Button
                              size="sm"
                              variant="link"
                              className="px-0"
                              onClick={() => router.push(`/project/${projectId}/incidents?incidentId=${event.incidentId}`)}
                            >
                              View incident details
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Onboarding checklist</CardTitle>
                <CardDescription>Track your first milestones in ClawOps.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {checklist.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-sm">
                    <div className={cn("h-2.5 w-2.5 rounded-full", item.complete ? "bg-emerald-500" : "bg-muted")} />
                    <span className={cn(item.complete ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => router.push(`/project/${projectId}/launch`)}
                >
                  Open launch checklist
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Risk & control</CardTitle>
                <CardDescription>Operational controls for the selected agent.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedAgent ? (
                  <>
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Risk level</div>
                      <div className="text-lg font-semibold">{getRiskLabel(selectedAgent.riskScore)}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Guardrail preset</div>
                      <div className="text-sm font-medium">
                        {getGuardrailPreset(selectedAgent.guardrailsConfig as Record<string, any>)}
                      </div>
                    </div>
                    {controlsLocked && (
                      <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                        <div className="font-medium text-foreground">Upgrade for advanced controls</div>
                        <p className="text-muted-foreground">
                          Auto-pause and approval queue are available on Pro or Enterprise plans to keep operators in the loop.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => handleUpgradeClick("guardrail_controls")}
                        >
                          Upgrade
                        </Button>
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Auto-pause on uncertainty</span>
                        <Switch
                          checked={Boolean((selectedAgent.guardrailsConfig as Record<string, any>)?.pauseOnUncertainty ?? true)}
                          disabled={isUpdatingAgent || controlsLocked}
                          onCheckedChange={(checked) =>
                            handleToggleGuardrail(selectedAgent, { pauseOnUncertainty: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Approval mode</span>
                        <Switch
                          checked={Boolean((selectedAgent.guardrailsConfig as Record<string, any>)?.askBeforeRiskyActions ?? true)}
                          disabled={isUpdatingAgent || controlsLocked}
                          onCheckedChange={(checked) =>
                            handleToggleGuardrail(selectedAgent, { askBeforeRiskyActions: checked })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Last blocked action</div>
                      <div className="text-sm text-foreground">
                        {latestBlockedEvent?.summary ?? "No blocks yet"}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        disabled={isUpdatingAgent}
                        onClick={() => handleToggleStatus(selectedAgent)}
                      >
                        {selectedAgent.status === "running" ? "Pause agent" : "Resume agent"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/project/${projectId}/guardrails`)}
                      >
                        Change guardrails
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => router.push(`/project/${projectId}/incidents`)}
                      >
                        View last incident
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Select an agent to manage risk and controls.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

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
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";

import ClientTimestampFormatter from "@/components/client-timestamp-formatter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/hooks/use-toast";
import {
  AGENT_CHANNEL_LABELS,
  AGENT_CONNECTION_LABELS,
  AGENT_ENVIRONMENT_LABELS,
  AGENT_STATUS_LABELS,
  Agent,
  AgentActivityEvent,
} from "@/lib/agents/types";
import { cn, swrFetcher } from "@/lib/utils";

const eventStyles: Record<string, { icon: typeof ShieldCheck; tone: string }> = {
  user_message_received: { icon: Clock, tone: "text-slate-500" },
  agent_response_sent: { icon: CheckCircle2, tone: "text-emerald-500" },
  agent_response_blocked: { icon: Slash, tone: "text-rose-500" },
  guardrail_triggered: { icon: ShieldAlert, tone: "text-amber-500" },
  agent_paused_auto: { icon: PauseCircle, tone: "text-amber-600" },
  agent_paused_manual: { icon: PauseCircle, tone: "text-slate-500" },
  agent_resumed: { icon: PlayCircle, tone: "text-emerald-500" },
  agent_connected: { icon: Bot, tone: "text-slate-500" },
  runtime_disconnected: { icon: AlertTriangle, tone: "text-amber-600" },
};

const statusStyles: Record<string, string> = {
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

const formatDetails = (details: Record<string, any> | null | undefined) => {
  if (!details) return "No technical details available.";
  try {
    return JSON.stringify(details, null, 2);
  } catch (error) {
    return "Unable to render details.";
  }
};

const getRiskLabel = (score?: number | null) => {
  if (score === null || score === undefined) return "Low";
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
};

export default function AgentActivity({ agentId }: { agentId: string }) {
  const router = useRouter();
  const { projectId } = useParams();
  const { toast } = useToast();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { data: agentData, mutate: mutateAgent } = useSWR<Agent>(
    projectId ? `/api/projects/${projectId}/agents/${agentId}` : null,
    swrFetcher
  );

  const { data: eventsData, isLoading, mutate: mutateEvents } = useSWR<{ items: AgentActivityEvent[] }>(
    projectId ? `/api/projects/${projectId}/agents/${agentId}/activity` : null,
    swrFetcher
  );

  const events = useMemo(() => eventsData?.items ?? [], [eventsData]);
  const isPaused = agentData?.status !== "running";
  const blockedCount = events.filter((event) => event.eventType === "agent_response_blocked").length;
  const guardrailCount = events.filter((event) => event.eventType === "guardrail_triggered").length;
  const pauseCount = events.filter((event) =>
    ["agent_paused_auto", "agent_paused_manual"].includes(event.eventType)
  ).length;
  const lastIncident = events.find((event) =>
    ["agent_response_blocked", "guardrail_triggered", "agent_paused_auto", "agent_paused_manual"].includes(
      event.eventType
    )
  );
  const riskLabel = getRiskLabel(agentData?.riskScore);
  const guardrailLabel = getGuardrailPreset(agentData?.guardrailsConfig as Record<string, any>);

  const handleToggleStatus = async () => {
    if (!agentData) return;
    const nextStatus = agentData.status === "running" ? "paused" : "running";

    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          pauseReason: nextStatus === "paused" ? "Paused by operator" : null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update agent");
      }

      await Promise.all([mutateAgent(), mutateEvents()]);
      toast({ title: nextStatus === "paused" ? "Agent paused" : "Agent resumed" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Unable to update agent",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const scorecardText = `TruthChecker-Protected\nAgent: ${agentData?.name ?? "Agent"}\nChannel: ${
    agentData?.channel ? AGENT_CHANNEL_LABELS[agentData.channel] : "Channel"
  }\nRisk: ${riskLabel}\nGuardrails: ${guardrailLabel}\nBlocks: ${blockedCount}\nGuardrails triggered: ${guardrailCount}\nLast incident: ${
    lastIncident?.createdAt ? new Date(lastIncident.createdAt).toISOString() : "None"
  }`;
  const badgeSnippet = `<span class="truthchecker-protected">TruthChecker-Protected</span>`;

  const handleCopyScorecard = async () => {
    try {
      await navigator.clipboard.writeText(scorecardText);
      toast({ title: "Scorecard copied", description: "Shareable safety summary copied to clipboard." });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy scorecard. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopyBadge = async () => {
    try {
      await navigator.clipboard.writeText(badgeSnippet);
      toast({ title: "Badge snippet copied", description: "Embed the TruthChecker-Protected badge anywhere." });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy badge snippet. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="px-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{agentData?.name ?? "Agent"}</CardTitle>
            <CardDescription>
              {agentData?.channel ? AGENT_CHANNEL_LABELS[agentData.channel] : "Channel"} · {agentData?.externalBotId}
            </CardDescription>
          </div>
          {agentData && (
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={cn("capitalize", statusStyles[agentData.status] ?? "")}
              >
                {AGENT_STATUS_LABELS[agentData.status] ?? agentData.status}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleStatus}
                disabled={isUpdatingStatus}
                className="gap-1"
              >
                {isPaused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/project/${projectId}/agents`)}
              >
                Back to agents
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4 text-sm text-muted-foreground">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Risk score</div>
            <div className="text-lg font-semibold text-foreground">{agentData?.riskScore ?? 0}%</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Status reason</div>
            <div className="text-sm text-foreground">
              {agentData?.pauseReason ? agentData.pauseReason : "No active pause"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Last activity</div>
            <div className="text-sm text-foreground">
              {agentData?.lastActivityAt ? (
                <ClientTimestampFormatter timestamp={String(agentData.lastActivityAt)} />
              ) : (
                "No activity yet"
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Connection</div>
            <div className="text-sm text-foreground">
              {AGENT_CONNECTION_LABELS[agentData?.connectionStatus ?? "configured"]}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {AGENT_ENVIRONMENT_LABELS[agentData?.environment ?? "prod"]} · {getGuardrailPreset(agentData?.guardrailsConfig as Record<string, any>)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safety scorecard</CardTitle>
          <CardDescription>Shareable proof that this agent is running under TruthChecker guardrails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Risk level</div>
              <div className="text-sm font-medium text-foreground">{riskLabel}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Guardrails</div>
              <div className="text-sm font-medium text-foreground">{guardrailLabel}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Blocks</div>
              <div className="text-sm font-medium text-foreground">{blockedCount}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Pauses</div>
              <div className="text-sm font-medium text-foreground">{pauseCount}</div>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">TruthChecker-Protected</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleCopyScorecard}>
                  Copy scorecard
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopyBadge}>
                  Copy badge
                </Button>
              </div>
            </div>
            <div className="mt-2 text-muted-foreground">
              Share this scorecard in proposals, compliance reviews, or partner docs to show active guardrails.
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-background p-2 text-[11px] text-muted-foreground">
              {badgeSnippet}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity timeline</CardTitle>
          <CardDescription>Every user message, guardrail check, and action taken by TruthChecker.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-sm text-muted-foreground">Loading activity...</div>}
          {!isLoading && events.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
              <AlertTriangle className="h-5 w-5" />
              No activity yet. Send a message to this agent to populate the timeline.
            </div>
          )}
          <div className="space-y-6">
            {events.map((event, index) => {
              const style = eventStyles[event.eventType] ?? eventStyles.guardrail_triggered;
              const Icon = style.icon;
              const showConnector = index < events.length - 1;

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
                      <div className="font-medium text-foreground">
                        {event.summary || "Activity update"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <ClientTimestampFormatter timestamp={String(event.createdAt)} />
                      </div>
                    </div>
                    {event.reason && (
                      <div className="text-sm text-muted-foreground">Why: {event.reason}</div>
                    )}
                    {event.action && (
                      <div className="text-sm text-foreground">Action: {event.action}</div>
                    )}
                    {event.traceId && (
                      <Button
                        size="sm"
                        variant="link"
                        className="px-0 text-sm"
                        onClick={() => router.push(`/project/${projectId}/activity/${event.traceId}`)}
                      >
                        Open related activity
                      </Button>
                    )}
                    <Accordion type="single" collapsible>
                      <AccordionItem value={`details-${event.id}`}>
                        <AccordionTrigger className="text-sm">Technical details</AccordionTrigger>
                        <AccordionContent>
                          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                            {formatDetails(event.details as Record<string, any>) }
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

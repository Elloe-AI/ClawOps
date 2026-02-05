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
import { useMemo } from "react";
import useSWR from "swr";

import ClientTimestampFormatter from "@/components/client-timestamp-formatter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/ui/header";
import { AGENT_CHANNEL_LABELS, AgentActivityEventWithAgent } from "@/lib/agents/types";
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

export default function ActivityTimeline() {
  const router = useRouter();
  const { projectId } = useParams();

  const { data, isLoading } = useSWR<{ items: AgentActivityEventWithAgent[] }>(
    projectId ? `/api/projects/${projectId}/agents/activity?limit=200` : null,
    swrFetcher
  );

  const events = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="flex flex-col h-full">
      <Header path={[{ name: "Activity" }]} />
      <div className="flex-1 px-6 pb-10">
        <Card>
          <CardHeader>
            <CardTitle>Activity timeline</CardTitle>
            <CardDescription>Every message, guardrail check, and action taken by ClawOps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading && <div className="text-sm text-muted-foreground">Loading activity...</div>}
            {!isLoading && events.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
                <AlertTriangle className="h-5 w-5" />
                No activity yet. Connect your runtime to start streaming updates.
              </div>
            )}
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
                      <div className="font-medium text-foreground">{buildEventHeadline(event)}</div>
                      <div className="text-xs text-muted-foreground">
                        <ClientTimestampFormatter timestamp={String(event.createdAt)} />
                      </div>
                    </div>
                    {event.reason && <div className="text-sm text-muted-foreground">Why: {event.reason}</div>}
                    {event.action && <div className="text-sm text-foreground">Action: {event.action}</div>}
                    <div className="flex flex-wrap gap-3 text-sm">
                      {event.traceId && (
                        <Button
                          size="sm"
                          variant="link"
                          className="px-0"
                          onClick={() => router.push(`/project/${projectId}/activity/${event.traceId}`)}
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
                      <Badge variant="outline" className="text-xs">
                        {event.agentName}
                      </Badge>
                    </div>
                    <Accordion type="single" collapsible>
                      <AccordionItem value={`details-${event.id}`}>
                        <AccordionTrigger className="text-sm">Technical details</AccordionTrigger>
                        <AccordionContent>
                          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                            {JSON.stringify(event.details ?? {}, null, 2)}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

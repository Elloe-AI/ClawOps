"use client";

import { Bot, MessageCircle, MessagesSquare, Phone, Send, PauseCircle, PlayCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type MouseEvent, useMemo } from "react";
import useSWR, { mutate } from "swr";

import ClientTimestampFormatter from "@/components/client-timestamp-formatter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/lib/hooks/use-toast";
import { swrFetcher } from "@/lib/utils";
import {
  AGENT_CHANNEL_LABELS,
  AGENT_CONNECTION_LABELS,
  AGENT_ENVIRONMENT_LABELS,
  AGENT_STATUS_LABELS,
  Agent,
} from "@/lib/agents/types";
import { cn } from "@/lib/utils";

const channelIcons = {
  telegram: Send,
  discord: MessageCircle,
  whatsapp: MessagesSquare,
  sms: Phone,
};

const statusStyles: Record<string, string> = {
  running: "bg-emerald-100 text-emerald-800 border-emerald-200",
  paused: "bg-amber-100 text-amber-800 border-amber-200",
  blocked: "bg-rose-100 text-rose-800 border-rose-200",
};

const riskTone = (score: number) => {
  if (score >= 70) return "bg-rose-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-emerald-500";
};

const DEFAULT_GUARDRAILS = {
  blockInstructionOverrides: true,
  askBeforeRiskyActions: true,
  limitResponseFrequency: true,
  pauseOnUncertainty: true,
  disableExternalTools: false,
};

const getGuardrailPreset = (config: Record<string, any> | null | undefined) => {
  const merged = { ...DEFAULT_GUARDRAILS, ...(config ?? {}) };
  const disabled = Object.values(merged).filter((value) => value === false).length;
  if (disabled === 0) return "Safe";
  if (disabled <= 2) return "Balanced";
  return "Autonomous";
};

export default function Agents() {
  const router = useRouter();
  const { projectId } = useParams();
  const { toast } = useToast();

  const { data, error, isLoading } = useSWR<{ items: Agent[] }>(
    projectId ? `/api/projects/${projectId}/agents` : null,
    swrFetcher
  );

  const agents = useMemo(() => data?.items ?? [], [data]);

  const handleToggleStatus = async (agent: Agent, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const nextStatus = agent.status === "running" ? "paused" : "running";

    try {
      const res = await fetch(`/api/projects/${projectId}/agents/${agent.id}`, {
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

      await mutate(`/api/projects/${projectId}/agents`);
      toast({
        title: nextStatus === "paused" ? "Agent paused" : "Agent resumed",
      });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Unable to update agent",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <div className="px-6">
        <Card>
          <CardHeader>
            <CardTitle>Agents unavailable</CardTitle>
            <CardDescription>We couldn't load your agents. Please try again.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isLoading && agents.length === 0) {
    return (
      <div className="px-6">
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full border bg-muted p-2">
                <Bot className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle>Connect your first agent</CardTitle>
                <CardDescription>
                  Connect a Telegram, Discord, WhatsApp, or SMS runtime to start tracking live activity.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/project/${projectId}/agents/new`)}>
              Connect agent runtime
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Agents</h2>
          <p className="text-sm text-muted-foreground">
            Monitor status, risk, and safety controls for every live agent.
          </p>
        </div>
        <Button onClick={() => router.push(`/project/${projectId}/agents/new`)}>Connect agent runtime</Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Guardrails</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead className="text-right">Controls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-sm text-muted-foreground">
                  Loading agents...
                </TableCell>
              </TableRow>
            )}
            {agents.map((agent) => {
              const Icon = channelIcons[agent.channel as keyof typeof channelIcons] ?? Bot;
              return (
                <TableRow
                  key={agent.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/project/${projectId}/agents/${agent.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="rounded-md border bg-muted p-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">{agent.externalBotId}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{AGENT_CHANNEL_LABELS[agent.channel as keyof typeof AGENT_CHANNEL_LABELS]}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("capitalize", statusStyles[agent.status] ?? "")}
                    >
                      {AGENT_STATUS_LABELS[agent.status] ?? agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-muted">
                        <div
                          className={cn("h-2 rounded-full", riskTone(agent.riskScore ?? 0))}
                          style={{ width: `${Math.min(agent.riskScore ?? 0, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{agent.riskScore ?? 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {getGuardrailPreset(agent.guardrailsConfig as Record<string, any>)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {AGENT_CONNECTION_LABELS[agent.connectionStatus ?? "configured"]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {AGENT_ENVIRONMENT_LABELS[agent.environment as keyof typeof AGENT_ENVIRONMENT_LABELS] ?? "Production"}
                  </TableCell>
                  <TableCell>
                    {agent.lastActivityAt ? (
                      <ClientTimestampFormatter timestamp={String(agent.lastActivityAt)} />
                    ) : (
                      <span className="text-xs text-muted-foreground">No activity</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => handleToggleStatus(agent, event)}
                      className="gap-1"
                    >
                      {agent.status === "running" ? (
                        <PauseCircle className="h-4 w-4" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}
                      {agent.status === "running" ? "Pause" : "Resume"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";

import {
  AlertTriangle,
  ShieldAlert,
  Slash,
  PauseCircle,
  Bot,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";

import ClientTimestampFormatter from "@/components/client-timestamp-formatter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/ui/header";
import { useToast } from "@/lib/hooks/use-toast";
import { AGENT_CHANNEL_LABELS } from "@/lib/agents/types";
import { cn, swrFetcher } from "@/lib/utils";

const incidentStyles: Record<
  string,
  { icon: typeof ShieldAlert; tone: string; label: string }
> = {
  blocked_response: { icon: Slash, tone: "text-rose-500", label: "Blocked response" },
  guardrail_triggered: { icon: ShieldAlert, tone: "text-amber-500", label: "Guardrail triggered" },
  auto_paused: { icon: PauseCircle, tone: "text-amber-600", label: "Auto-paused" },
  manual_paused: { icon: PauseCircle, tone: "text-slate-500", label: "Paused by operator" },
  approval_requested: { icon: Clock, tone: "text-amber-500", label: "Approval requested" },
  approval_completed: { icon: CheckCircle2, tone: "text-emerald-500", label: "Approval completed" },
  runtime_disconnected: { icon: AlertTriangle, tone: "text-slate-500", label: "Runtime disconnected" },
};

const decisionSummary = (incidentType: string) => {
  switch (incidentType) {
    case "blocked_response":
      return "Blocked before sending";
    case "guardrail_triggered":
      return "Guardrail flagged the action";
    case "auto_paused":
      return "Agent auto-paused";
    case "manual_paused":
      return "Agent paused by operator";
    case "approval_requested":
      return "Approval required";
    case "approval_completed":
      return "Approval completed";
    case "runtime_disconnected":
      return "Runtime disconnected";
    default:
      return "Incident recorded";
  }
};

const explainImpact = (incidentType: string) => {
  switch (incidentType) {
    case "blocked_response":
      return "Without ClawOps, this response would have been delivered.";
    case "guardrail_triggered":
      return "Without ClawOps, this action could have been executed unchecked.";
    case "auto_paused":
      return "Without ClawOps, risky behavior would have continued.";
    case "manual_paused":
      return "Manual pause prevented further risky actions.";
    case "approval_requested":
      return "Without ClawOps, the action would have executed without review.";
    case "approval_completed":
      return "The action proceeded only after human approval.";
    case "runtime_disconnected":
      return "Without ClawOps, the disconnect might have gone unnoticed.";
    default:
      return "ClawOps prevented a risky outcome.";
  }
};

type IncidentRecord = {
  id: string;
  incidentType: string;
  status: string;
  summary: string | null;
  reason: string | null;
  action: string | null;
  createdAt: string;
  traceId: string | null;
  agentName: string;
  agentChannel: string;
  agentStatus: string;
};

type ApprovalRecord = {
  id: string;
  incidentId: string;
  status: string;
  agentId: string;
};

export default function Incidents() {
  const router = useRouter();
  const { projectId } = useParams();
  const searchParams = useSearchParams();
  const highlightIncidentId = searchParams.get("incidentId");
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR<{ items: IncidentRecord[] }>(
    projectId ? `/api/projects/${projectId}/incidents?status=open` : null,
    swrFetcher
  );

  const { data: approvalsData, mutate: mutateApprovals } = useSWR<{ items: ApprovalRecord[] }>(
    projectId ? `/api/projects/${projectId}/approvals?status=pending` : null,
    swrFetcher
  );

  const incidents = useMemo(() => data?.items ?? [], [data]);
  const approvals = useMemo(() => approvalsData?.items ?? [], [approvalsData]);

  const approvalMap = useMemo(() => {
    const map = new Map<string, ApprovalRecord>();
    approvals.forEach((approval) => map.set(approval.incidentId, approval));
    return map;
  }, [approvals]);

  const handleApproval = async (approvalId: string, status: "approved" | "denied") => {
    if (!projectId) return;
    setIsUpdating(approvalId);
    try {
      const res = await fetch(`/api/projects/${projectId}/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update approval");
      }

      await Promise.all([mutate(), mutateApprovals()]);
      toast({
        title: status === "approved" ? "Approval granted" : "Approval denied",
        description: "Activity and incidents have been updated.",
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Unable to update approval",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header path={[{ name: "Incidents" }]} />
      <div className="flex-1 px-6 pb-10">
        <Card>
          <CardHeader>
            <CardTitle>Incidents</CardTitle>
            <CardDescription>Blocked, risky, or paused events that require attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading && <div className="text-sm text-muted-foreground">Loading incidents...</div>}
            {!isLoading && incidents.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
                <AlertTriangle className="h-5 w-5" />
                No incidents yet. ClawOps will surface risky actions here.
              </div>
            )}

            {incidents.map((incident) => {
              const style = incidentStyles[incident.incidentType] ?? {
                icon: Bot,
                tone: "text-slate-500",
                label: "Incident",
              };
              const Icon = style.icon;
              const channelLabel = AGENT_CHANNEL_LABELS[incident.agentChannel as keyof typeof AGENT_CHANNEL_LABELS] ?? "Channel";
              const isHighlighted = highlightIncidentId && incident.id === highlightIncidentId;
              const approval = approvalMap.get(incident.id);

              return (
                <div
                  key={incident.id}
                  className={cn(
                    "rounded-lg border p-4 space-y-3 transition",
                    isHighlighted ? "border-primary bg-primary/5" : "border-muted"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={cn("rounded-full border bg-background p-2", style.tone)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
                          {incident.summary || style.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {incident.agentName} · {channelLabel}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <ClientTimestampFormatter timestamp={String(incident.createdAt)} />
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <div>Decision: {decisionSummary(incident.incidentType)}</div>
                    {incident.reason && <div>Why: {incident.reason}</div>}
                    {incident.action && <div>Action taken: {incident.action}</div>}
                    <div>{explainImpact(incident.incidentType)}</div>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    <Badge variant="outline" className="text-xs">
                      {style.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {incident.status === "resolved" ? "Resolved" : "Open"}
                    </Badge>
                    {incident.traceId && (
                      <Button
                        size="sm"
                        variant="link"
                        className="px-0"
                        onClick={() => router.push(`/project/${projectId}/activity/${incident.traceId}`)}
                      >
                        Technical details
                      </Button>
                    )}
                  </div>

                  {approval && approval.status === "pending" && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isUpdating === approval.id}
                        onClick={() => handleApproval(approval.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isUpdating === approval.id}
                        onClick={() => handleApproval(approval.id, "denied")}
                      >
                        Deny
                      </Button>
                    </div>
                  )}

                  <Accordion type="single" collapsible>
                    <AccordionItem value={`details-${incident.id}`}>
                      <AccordionTrigger className="text-sm">Technical details</AccordionTrigger>
                      <AccordionContent>
                        <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                          {JSON.stringify(incident, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

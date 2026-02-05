"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
  ShieldAlert,
  Slash,
} from "lucide-react";
import { useMemo } from "react";

import ClientTimestampFormatter from "@/components/client-timestamp-formatter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TraceViewSpan, useTraceViewStoreContext } from "@/components/traces/trace-view/trace-view-store";
import { extractHipocapAnalysis } from "@/components/traces/trace-view/utils";
import { cn } from "@/lib/utils";

type TimelineEventType =
  | "user_message_received"
  | "agent_response_sent"
  | "agent_response_blocked"
  | "guardrail_triggered"
  | "agent_paused_auto";

type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  summary: string;
  reason?: string;
  action?: string;
  details?: Record<string, any>;
  spanId?: string;
};

const eventStyles: Record<TimelineEventType, { icon: typeof Clock; tone: string }> = {
  user_message_received: { icon: Clock, tone: "text-slate-500" },
  agent_response_sent: { icon: CheckCircle2, tone: "text-emerald-500" },
  agent_response_blocked: { icon: Slash, tone: "text-rose-500" },
  guardrail_triggered: { icon: ShieldAlert, tone: "text-amber-500" },
  agent_paused_auto: { icon: PauseCircle, tone: "text-amber-600" },
};

const formatDetails = (details: Record<string, any> | null | undefined) => {
  if (!details) return "No technical details available.";
  try {
    return JSON.stringify(details, null, 2);
  } catch (error) {
    return "Unable to render details.";
  }
};

const normalizeDecision = (decision?: string | null) => {
  if (!decision) return "";
  return String(decision).trim().toUpperCase();
};

const isBlockedDecision = (decision: string) =>
  ["BLOCK", "BLOCKED", "DENY", "DENIED", "REJECT"].includes(decision);

const isAllowedDecision = (decision: string) =>
  ["ALLOW", "ALLOWED", "PASS", "APPROVED"].includes(decision);

const isReviewDecision = (decision: string) =>
  ["REVIEW", "REVIEW_REQUIRED", "NEEDS_REVIEW"].includes(decision);

const formatRiskLabel = (severity?: string | null) => {
  if (!severity) return "Unknown risk";
  const severityLower = severity.toLowerCase();
  switch (severityLower) {
    case "critical":
      return "High risk";
    case "high":
      return "Elevated risk";
    case "medium":
      return "Medium risk";
    case "low":
      return "Low risk";
    case "safe":
      return "Safe";
    default:
      return "Unknown risk";
  }
};

const formatDecisionLabel = (decision: string) => {
  if (isBlockedDecision(decision)) return "Blocked";
  if (isAllowedDecision(decision)) return "Allowed";
  if (isReviewDecision(decision)) return "Needs review";
  return decision || "Unknown";
};

const hasGuardrailSignal = (decision: string, severity?: string | null, eventName?: string) => {
  if (eventName === "hipocap.security.threat_detected") return true;
  if (isBlockedDecision(decision) || isReviewDecision(decision)) return true;
  if (!severity) return false;
  return severity.toLowerCase() !== "safe";
};

const buildGuardrailEvents = (span: TraceViewSpan): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  const spanEvents = span.events || [];

  const securityEvents = spanEvents.filter((event) =>
    ["hipocap.security.threat_detected", "hipocap.security.analysis_complete"].includes(event.name)
  );

  const spanAnalysis = extractHipocapAnalysis(span);

  const derivedEvents = securityEvents.length > 0 ? securityEvents : spanAnalysis ? [null] : [];

  derivedEvents.forEach((event, index) => {
    const source = event
      ? {
          timestamp: event.timestamp,
          attributes: event.attributes || {},
          id: event.id,
          name: event.name,
        }
      : {
          timestamp: span.endTime || span.startTime,
          attributes: {},
          id: `${span.spanId}-analysis`,
          name: "span_analysis",
        };

    const decision = normalizeDecision(
      source.attributes?.["hipocap.final_decision"] ??
        source.attributes?.["hipocap.decision"] ??
        spanAnalysis?.finalDecision
    );
    const severity = source.attributes?.["hipocap.severity"] ?? spanAnalysis?.severity ?? null;
    const reason = source.attributes?.["hipocap.reason"] ?? spanAnalysis?.reason ?? undefined;
    const blockedAt = source.attributes?.["hipocap.blocked_at"] ?? spanAnalysis?.blockedAt ?? undefined;
    const score =
      source.attributes?.["hipocap.final_score"] ??
      source.attributes?.["hipocap.score"] ??
      spanAnalysis?.finalScore ??
      null;
    const functionName =
      source.attributes?.["hipocap.function_name"] ?? spanAnalysis?.functionName ?? span.name;

    const guardrailTriggered = hasGuardrailSignal(decision, severity, source.name);

    if (!guardrailTriggered) {
      return;
    }

    const summary = functionName
      ? `Guardrail triggered · ${functionName}`
      : "Guardrail triggered";

    const action = isBlockedDecision(decision)
      ? "Blocked before sending."
      : isReviewDecision(decision)
        ? "Flagged for review."
        : "Logged for review.";

    events.push({
      id: `${span.spanId}-guardrail-${source.id}-${index}`,
      type: "guardrail_triggered",
      timestamp: source.timestamp,
      summary,
      reason: reason || (severity ? `Risk level: ${formatRiskLabel(severity)}` : undefined),
      action,
      spanId: span.spanId,
      details: {
        decision: decision ? formatDecisionLabel(decision) : undefined,
        severity,
        riskLabel: formatRiskLabel(severity),
        score,
        blockedAt,
        functionName,
        eventName: source.name,
        eventId: source.id,
        spanId: span.spanId,
      },
    });

    if (isBlockedDecision(decision)) {
      events.push({
        id: `${span.spanId}-blocked-${source.id}-${index}`,
        type: "agent_response_blocked",
        timestamp: source.timestamp,
        summary: "Agent response blocked",
        reason: reason || (blockedAt ? `Blocked before sending (${blockedAt})` : undefined),
        action: "Response held for safety.",
        spanId: span.spanId,
        details: {
          decision: formatDecisionLabel(decision),
          severity,
          blockedAt,
          reason,
          functionName,
          eventName: source.name,
          eventId: source.id,
          spanId: span.spanId,
        },
      });
    }
  });

  return events;
};

const buildAutoPauseEvents = (span: TraceViewSpan): TimelineEvent[] => {
  const pauseEvents = (span.events || []).filter((event) =>
    [
      "hipocap.agent.auto_paused",
      "hipocap.agent.paused.auto",
      "clawops.agent.auto_paused",
      "clawops.agent.paused.auto",
    ].includes(event.name)
  );

  return pauseEvents.map((event) => {
    const reason = event.attributes?.reason || event.attributes?.message || "Guardrails triggered repeatedly.";

    return {
      id: `${span.spanId}-auto-pause-${event.id}`,
      type: "agent_paused_auto",
      timestamp: event.timestamp,
      summary: "Agent paused automatically",
      reason,
      action: "Agent status set to paused.",
      spanId: span.spanId,
      details: {
        eventId: event.id,
        spanId: span.spanId,
        ...event.attributes,
      },
    };
  });
};

const buildTimelineEvents = (trace: { id?: string; startTime?: string; endTime?: string } | undefined, spans: TraceViewSpan[]) => {
  const events: TimelineEvent[] = [];
  const startTime = trace?.startTime ?? spans[0]?.startTime;
  const endTime = trace?.endTime ?? spans[spans.length - 1]?.endTime;

  if (startTime) {
    events.push({
      id: `trace-${trace?.id ?? "unknown"}-user-message`,
      type: "user_message_received",
      timestamp: startTime,
      summary: "User message received",
      reason: "New message arrived from the channel.",
      action: "Started processing.",
      details: {
        traceId: trace?.id,
        startedAt: startTime,
      },
    });
  }

  spans.forEach((span) => {
    events.push(...buildGuardrailEvents(span));
    events.push(...buildAutoPauseEvents(span));
  });

  const hasBlocked = events.some((event) => event.type === "agent_response_blocked");

  if (!hasBlocked && endTime) {
    events.push({
      id: `trace-${trace?.id ?? "unknown"}-response-sent`,
      type: "agent_response_sent",
      timestamp: endTime,
      summary: "Agent response sent",
      reason: "No guardrails blocked this response.",
      action: "Delivered to the channel.",
      details: {
        traceId: trace?.id,
        completedAt: endTime,
      },
    });
  }

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

export default function Timeline() {
  const { spans, trace, setSelectedSpan, isSpansLoading } = useTraceViewStoreContext((state) => ({
    spans: state.spans,
    trace: state.trace,
    setSelectedSpan: state.setSelectedSpan,
    isSpansLoading: state.isSpansLoading,
  }));

  const spanLookup = useMemo(() => new Map(spans.map((span) => [span.spanId, span])), [spans]);

  const events = useMemo(() => buildTimelineEvents(trace, spans), [trace, spans]);

  if (isSpansLoading) {
    return <div className="text-sm text-muted-foreground p-4">Loading activity...</div>;
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
        <AlertTriangle className="h-5 w-5" />
        No activity details yet.
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-4">
      <div>
        <h3 className="text-sm font-semibold">Activity timeline</h3>
        <p className="text-xs text-muted-foreground">
          Human-readable summary of what happened in this activity.
        </p>
      </div>
      <div className="space-y-6">
        {events.map((event, index) => {
          const style = eventStyles[event.type];
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
                  <div className="font-medium text-foreground">{event.summary}</div>
                  <div className="text-xs text-muted-foreground">
                    <ClientTimestampFormatter timestamp={String(event.timestamp)} />
                  </div>
                </div>
                {event.reason && <div className="text-sm text-muted-foreground">Why: {event.reason}</div>}
                {event.action && <div className="text-sm text-foreground">Action: {event.action}</div>}
                {event.details?.decision && (
                  <Badge variant="outline" className="text-xs">
                    {event.details.decision}
                  </Badge>
                )}
                {event.spanId && spanLookup.has(event.spanId) && (
                  <Button
                    size="sm"
                    variant="link"
                    className="px-0 text-sm"
                    onClick={() => setSelectedSpan(spanLookup.get(event.spanId))}
                  >
                    Open technical details
                  </Button>
                )}
                <Accordion type="single" collapsible>
                  <AccordionItem value={`details-${event.id}`}>
                    <AccordionTrigger className="text-sm">Technical details</AccordionTrigger>
                    <AccordionContent>
                      <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                        {formatDetails(event.details)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

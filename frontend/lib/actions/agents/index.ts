import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod/v4";

import { createApproval } from "@/lib/actions/approvals";
import { logAuditEntry } from "@/lib/actions/audit-log";
import { createIncident } from "@/lib/actions/incidents";
import { createProductEvent } from "@/lib/actions/product-events";
import { getProjectDetails } from "@/lib/actions/project";
import { db } from "@/lib/db/drizzle";
import { agentActivityEvents, agents, incidents } from "@/lib/db/migrations/schema";

const AgentChannelSchema = z.enum(["telegram", "discord", "whatsapp", "sms"]);
const AgentStatusSchema = z.enum(["running", "paused", "blocked"]);
const AgentEnvironmentSchema = z.enum(["local", "staging", "prod"]);
const AgentActivityTypeSchema = z.enum([
  "user_message_received",
  "agent_response_sent",
  "agent_response_blocked",
  "guardrail_triggered",
  "agent_paused_auto",
  "agent_paused_manual",
  "agent_resumed",
  "agent_connected",
  "runtime_disconnected",
]);

const CreateAgentSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  channel: AgentChannelSchema,
  externalBotId: z.string().min(1),
  environment: AgentEnvironmentSchema.optional(),
  userId: z.string().optional(),
  partnerId: z.string().optional(),
  runtimeType: z.string().optional(),
  guardrailsConfig: z.record(z.any()).optional(),
  channelConfig: z.record(z.any()).optional(),
});

const UpdateAgentSchema = z.object({
  projectId: z.string(),
  agentId: z.string(),
  userId: z.string().optional(),
  name: z.string().min(1).optional(),
  status: AgentStatusSchema.optional(),
  pauseReason: z.string().nullable().optional(),
  environment: AgentEnvironmentSchema.optional(),
  connectionStatus: z.enum(["configured", "connected", "inactive"]).optional(),
  lastHeartbeatAt: z.string().optional(),
  partnerId: z.string().nullable().optional(),
  runtimeType: z.string().nullable().optional(),
  guardrailsConfig: z.record(z.any()).optional(),
  channelConfig: z.record(z.any()).optional(),
});

const GetAgentSchema = z.object({
  projectId: z.string(),
  agentId: z.string(),
});

const GetAgentsSchema = z.object({
  projectId: z.string(),
  environment: AgentEnvironmentSchema.optional(),
});

const CreateAgentEventSchema = z.object({
  projectId: z.string(),
  agentId: z.string(),
  userId: z.string().optional(),
  traceId: z.string().optional(),
  eventType: AgentActivityTypeSchema,
  summary: z.string().optional(),
  reason: z.string().optional(),
  action: z.string().optional(),
  details: z.record(z.any()).optional(),
  environment: AgentEnvironmentSchema.optional(),
  partnerId: z.string().optional(),
  runtimeType: z.string().optional(),
  createdAt: z.string().optional(),
});

const GetAgentEventsSchema = z.object({
  projectId: z.string(),
  agentId: z.string(),
  limit: z.number().int().min(1).max(500).optional(),
});

const GetProjectAgentEventsSchema = z.object({
  projectId: z.string(),
  limit: z.number().int().min(1).max(500).optional(),
  eventTypes: z.array(AgentActivityTypeSchema).optional(),
  traceId: z.string().optional(),
  environment: AgentEnvironmentSchema.optional(),
});

const UpdateAgentsGuardrailsSchema = z.object({
  projectId: z.string(),
  guardrailsConfig: z.record(z.any()),
});

const AUTO_PAUSE_RULES = {
  blockBurstCount: 3,
  blockBurstMinutes: 10,
  guardrailBurstCount: 5,
  guardrailBurstMinutes: 15,
  riskScoreThreshold: 70,
};

const CONNECTION_INACTIVE_MINUTES = 10;

const RISK_WEIGHTS: Record<string, number> = {
  guardrail_triggered: 12,
  agent_response_blocked: 20,
  agent_paused_auto: 10,
  agent_paused_manual: 5,
  runtime_disconnected: 8,
};

const DEFAULT_EVENT_COPY: Record<string, { summary: string; action: string }> = {
  user_message_received: {
    summary: "User message received",
    action: "Queued for response",
  },
  agent_response_sent: {
    summary: "Agent response sent",
    action: "Delivered to channel",
  },
  agent_response_blocked: {
    summary: "Agent response blocked",
    action: "Blocked before sending",
  },
  guardrail_triggered: {
    summary: "Guardrail triggered",
    action: "Checked for safe response",
  },
  agent_paused_auto: {
    summary: "Agent paused automatically",
    action: "Paused for safety",
  },
  agent_paused_manual: {
    summary: "Agent paused",
    action: "Paused by operator",
  },
  agent_resumed: {
    summary: "Agent resumed",
    action: "Back online",
  },
  agent_connected: {
    summary: "Agent connected",
    action: "Channel ready",
  },
  runtime_disconnected: {
    summary: "Runtime disconnected",
    action: "Awaiting heartbeat",
  },
};

const toDate = (value?: string | Date | null) => {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const calculateRiskScore = (events: { eventType: string; createdAt: string | Date | null }[]) => {
  const total = events.reduce((sum, event) => sum + (RISK_WEIGHTS[event.eventType] ?? 2), 0);
  return Math.min(100, Math.round(total));
};

const determineAutoPauseReason = (
  events: { eventType: string; createdAt: string | Date | null; details?: Record<string, any> | null }[],
  riskScore: number,
  guardrailsConfig?: Record<string, any> | null
) => {
  const blockBurstWindow = minutesAgo(AUTO_PAUSE_RULES.blockBurstMinutes);
  const guardrailBurstWindow = minutesAgo(AUTO_PAUSE_RULES.guardrailBurstMinutes);
  const responseBurstWindow = minutesAgo(5);

  const recentBlocked = events.filter(
    (event) => event.eventType === "agent_response_blocked" && toDate(event.createdAt)! >= blockBurstWindow
  ).length;
  if (recentBlocked >= AUTO_PAUSE_RULES.blockBurstCount) {
    return "Multiple responses were blocked in a short time.";
  }

  const recentGuardrails = events.filter(
    (event) => event.eventType === "guardrail_triggered" && toDate(event.createdAt)! >= guardrailBurstWindow
  ).length;
  if (recentGuardrails >= AUTO_PAUSE_RULES.guardrailBurstCount) {
    return "Guardrails were triggered repeatedly.";
  }

  if (riskScore >= AUTO_PAUSE_RULES.riskScoreThreshold) {
    return "Risk score exceeded the safety threshold.";
  }

  if (guardrailsConfig?.pauseOnUncertainty) {
    const lowConfidenceEvents = events.filter((event) => {
      const confidence = event.details?.confidence;
      const confidenceScore = event.details?.confidenceScore;
      return confidence === "low" || (typeof confidenceScore === "number" && confidenceScore < 0.4);
    });

    if (lowConfidenceEvents.length >= 3) {
      return "Confidence degraded over time.";
    }
  }

  if (guardrailsConfig?.limitResponseFrequency) {
    const recentResponses = events.filter(
      (event) => event.eventType === "agent_response_sent" && toDate(event.createdAt)! >= responseBurstWindow
    ).length;
    if (recentResponses >= 20) {
      return "Response frequency exceeded safe limits.";
    }
  }

  const spikeEvent = events.find((event) => event.details?.tokenSpike || event.details?.costSpike);
  if (spikeEvent) {
    return "Token or cost spike detected.";
  }

  return null;
};

export async function createAgent(input: z.infer<typeof CreateAgentSchema>) {
  const { projectId, name, channel, externalBotId, guardrailsConfig, channelConfig, userId, environment, partnerId, runtimeType } =
    CreateAgentSchema.parse(input);

  const now = new Date().toISOString();

  const [agent] = await db
    .insert(agents)
    .values({
      projectId,
      name,
      channel,
      externalBotId,
      environment: environment ?? "prod",
      connectionStatus: "configured",
      lastHeartbeatAt: null,
      partnerId: partnerId ?? null,
      runtimeType: runtimeType ?? null,
      guardrailsConfig: guardrailsConfig ?? {},
      channelConfig: channelConfig ?? {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!agent) {
    throw new Error("Failed to create agent");
  }

  return agent;
}

export async function getAgent(input: z.infer<typeof GetAgentSchema>) {
  const { projectId, agentId } = GetAgentSchema.parse(input);
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.projectId, projectId), eq(agents.id, agentId)),
  });

  if (!agent) {
    return null;
  }

  const project = await getProjectDetails(projectId);
  return await refreshAgentSafety(agent, { isFreeTier: project.isFreeTier });
}

export async function getAgents(input: z.infer<typeof GetAgentsSchema>) {
  const { projectId, environment } = GetAgentsSchema.parse(input);

  const list = await db.query.agents.findMany({
    where: environment
      ? and(eq(agents.projectId, projectId), eq(agents.environment, environment))
      : eq(agents.projectId, projectId),
    orderBy: desc(agents.updatedAt),
  });

  const project = await getProjectDetails(projectId);
  const refreshed = await Promise.all(list.map((agent) => refreshAgentSafety(agent, { isFreeTier: project.isFreeTier })));
  return refreshed;
}

export async function updateAgent(input: z.infer<typeof UpdateAgentSchema>) {
  const {
    projectId,
    agentId,
    status,
    pauseReason,
    name,
    guardrailsConfig,
    channelConfig,
    userId,
    environment,
    connectionStatus,
    lastHeartbeatAt,
    partnerId,
    runtimeType,
  } =
    UpdateAgentSchema.parse(input);

  const now = new Date().toISOString();

  const updates: Partial<typeof agents.$inferInsert> = {
    updatedAt: now,
  };

  if (name !== undefined) updates.name = name;
  if (status !== undefined) updates.status = status;
  if (pauseReason !== undefined) updates.pauseReason = pauseReason;
  if (guardrailsConfig !== undefined) updates.guardrailsConfig = guardrailsConfig;
  if (channelConfig !== undefined) updates.channelConfig = channelConfig;
  if (environment !== undefined) updates.environment = environment;
  if (connectionStatus !== undefined) updates.connectionStatus = connectionStatus;
  if (lastHeartbeatAt !== undefined) updates.lastHeartbeatAt = lastHeartbeatAt;
  if (partnerId !== undefined) updates.partnerId = partnerId;
  if (runtimeType !== undefined) updates.runtimeType = runtimeType;

  if (status === "paused") {
    updates.pausedAt = now;
  }
  if (status === "running") {
    updates.pausedAt = null;
    if (pauseReason === undefined) {
      updates.pauseReason = null;
    }
  }

  const [agent] = await db
    .update(agents)
    .set(updates)
    .where(and(eq(agents.projectId, projectId), eq(agents.id, agentId)))
    .returning();

  if (!agent) {
    throw new Error("Agent not found");
  }

  if (status === "paused") {
    await createAgentEvent({
      projectId,
      agentId,
      eventType: "agent_paused_manual",
      reason: pauseReason,
      userId,
    });
  }

  if (status === "running") {
    await createAgentEvent({
      projectId,
      agentId,
      eventType: "agent_resumed",
      userId,
    });
  }

  return agent;
}

export async function createAgentEvent(input: z.infer<typeof CreateAgentEventSchema>) {
  const {
    projectId,
    agentId,
    traceId,
    eventType,
    summary,
    reason,
    action,
    details,
    createdAt,
    userId,
    environment,
    partnerId,
    runtimeType,
  } = CreateAgentEventSchema.parse(input);

  const fallback = DEFAULT_EVENT_COPY[eventType];
  const now = createdAt ?? new Date().toISOString();
  const detailPayload = details ?? {};

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.projectId, projectId), eq(agents.id, agentId)),
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  const eventEnvironment = environment ?? agent.environment;
  const eventPartnerId = partnerId ?? agent.partnerId ?? null;
  const eventRuntimeType = runtimeType ?? agent.runtimeType ?? null;

  const shouldCheckFirstMessage = eventType === "user_message_received";
  const shouldCheckFirstBlock = eventType === "agent_response_blocked";
  const shouldCheckFirstPause =
    eventType === "agent_paused_auto" || eventType === "agent_paused_manual";
  const shouldLogApprovalRequested = eventType === "guardrail_triggered" && detailPayload.approvalRequested;
  const shouldLogApprovalCompleted = eventType === "agent_response_sent" && detailPayload.approvalCompleted;

  const [firstMessageResult, firstBlockResult, firstPauseResult] = await Promise.all([
    shouldCheckFirstMessage
      ? db
          .select({ id: agentActivityEvents.id })
          .from(agentActivityEvents)
          .where(
            and(
              eq(agentActivityEvents.projectId, projectId),
              eq(agentActivityEvents.agentId, agentId),
              eq(agentActivityEvents.eventType, "user_message_received")
            )
          )
          .limit(1)
      : Promise.resolve([]),
    shouldCheckFirstBlock
      ? db
          .select({ id: agentActivityEvents.id })
          .from(agentActivityEvents)
          .where(
            and(
              eq(agentActivityEvents.projectId, projectId),
              eq(agentActivityEvents.agentId, agentId),
              eq(agentActivityEvents.eventType, "agent_response_blocked")
            )
          )
          .limit(1)
      : Promise.resolve([]),
    shouldCheckFirstPause
      ? db
          .select({ id: agentActivityEvents.id })
          .from(agentActivityEvents)
          .where(
            and(
              eq(agentActivityEvents.projectId, projectId),
              eq(agentActivityEvents.agentId, agentId),
              inArray(agentActivityEvents.eventType, ["agent_paused_auto", "agent_paused_manual"])
            )
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  const isFirstMessage = shouldCheckFirstMessage && firstMessageResult.length === 0;
  const isFirstBlock = shouldCheckFirstBlock && firstBlockResult.length === 0;
  const isFirstPause = shouldCheckFirstPause && firstPauseResult.length === 0;

  const [event] = await db
    .insert(agentActivityEvents)
    .values({
      projectId,
      agentId,
      traceId: traceId ?? null,
      eventType,
      summary: summary ?? fallback?.summary,
      reason,
      action: action ?? fallback?.action,
      details: detailPayload,
      environment: eventEnvironment,
      partnerId: eventPartnerId,
      runtimeType: eventRuntimeType,
      createdAt: now,
    })
    .returning();

  if (!event) {
    throw new Error("Failed to create agent event");
  }

  await db
    .update(agents)
    .set({
      lastActivityAt: now,
      updatedAt: now,
    })
    .where(and(eq(agents.projectId, projectId), eq(agents.id, agentId)));

  await refreshAgentSafety({ ...agent, lastActivityAt: now });

  const runtimeEventTypes = [
    "user_message_received",
    "agent_response_sent",
    "agent_response_blocked",
    "guardrail_triggered",
  ];
  const hasHeartbeat = Boolean(agent.lastHeartbeatAt);
  const shouldMarkConnected = hasHeartbeat && runtimeEventTypes.includes(eventType) && agent.connectionStatus !== "connected";
  let didConnectNow = false;

  if (shouldMarkConnected) {
    await db
      .update(agents)
      .set({ connectionStatus: "connected", updatedAt: now })
      .where(and(eq(agents.projectId, projectId), eq(agents.id, agentId)));
    didConnectNow = true;

    await db.insert(agentActivityEvents).values({
      projectId,
      agentId,
      traceId: traceId ?? null,
      eventType: "agent_connected",
      summary: DEFAULT_EVENT_COPY.agent_connected.summary,
      action: DEFAULT_EVENT_COPY.agent_connected.action,
      details: { heartbeat: true },
      environment: eventEnvironment,
      partnerId: eventPartnerId,
      runtimeType: eventRuntimeType,
      createdAt: now,
    });
  }

  const threatCategory = detailPayload.threatCategory ?? detailPayload.category ?? null;
  const incidentType = (() => {
    if (eventType === "agent_response_blocked") return "blocked_response";
    if (eventType === "guardrail_triggered") {
      return detailPayload.approvalRequested ? "approval_requested" : "guardrail_triggered";
    }
    if (eventType === "agent_paused_auto") return "auto_paused";
    if (eventType === "agent_paused_manual") return "manual_paused";
    if (eventType === "agent_response_sent" && detailPayload.approvalCompleted) return "approval_completed";
    if (eventType === "runtime_disconnected") return "runtime_disconnected";
    return null;
  })();

  let incidentId: string | null = null;
  if (incidentType) {
    const incident = await createIncident({
      projectId,
      agentId,
      eventId: event.id,
      traceId: traceId ?? null,
      incidentType,
      category: threatCategory,
      summary: summary ?? fallback?.summary,
      reason: reason ?? detailPayload.reason,
      action: action ?? fallback?.action,
    });
    incidentId = incident.id;

    await logAuditEntry({
      projectId,
      actorUserId: userId ?? null,
      action: "incident_created",
      entityType: "incident",
      entityId: incident.id,
      metadata: {
        incidentType,
        eventType,
        agentId,
        traceId: traceId ?? null,
        partnerId: eventPartnerId,
        runtimeType: eventRuntimeType,
        environment: eventEnvironment,
      },
    });

    if (incidentType === "approval_requested") {
      await createApproval({
        projectId,
        agentId,
        incidentId: incident.id,
        requestedBy: userId,
        requestDetails: {
          ...detailPayload,
          reason: reason ?? detailPayload.reason,
          summary: summary ?? fallback?.summary,
        },
      });
    }
  }

  const logProductEvent = async (name: string, metadata?: Record<string, any>) => {
    try {
      await createProductEvent({
        name,
        userId: userId ?? null,
        projectId,
        agentId,
        metadata,
      });
    } catch (error) {
      console.error("Failed to log product event:", error);
    }
  };

  if (didConnectNow) {
    await logProductEvent("runtime_connected", { eventType });
  }
  if (isFirstMessage) {
    await logProductEvent("first_message");
  }
  if (isFirstBlock) {
    await logProductEvent("first_block");
  }
  if (isFirstPause) {
    await logProductEvent("first_pause");
  }
  if (shouldLogApprovalRequested) {
    await logProductEvent("approval_requested", { reason: detailPayload.reason ?? reason });
  }
  if (shouldLogApprovalCompleted) {
    await logProductEvent("approval_completed");
  }

  return event;
}

export async function getAgentEvents(input: z.infer<typeof GetAgentEventsSchema>) {
  const { projectId, agentId, limit } = GetAgentEventsSchema.parse(input);

  return db.query.agentActivityEvents.findMany({
    where: and(eq(agentActivityEvents.projectId, projectId), eq(agentActivityEvents.agentId, agentId)),
    orderBy: desc(agentActivityEvents.createdAt),
    limit: limit ?? 200,
  });
}

export async function getProjectAgentEvents(input: z.infer<typeof GetProjectAgentEventsSchema>) {
  const { projectId, limit, eventTypes, traceId, environment } = GetProjectAgentEventsSchema.parse(input);

  const filters = [eq(agentActivityEvents.projectId, projectId)];
  if (eventTypes && eventTypes.length > 0) {
    filters.push(inArray(agentActivityEvents.eventType, eventTypes));
  }
  if (traceId) {
    filters.push(eq(agentActivityEvents.traceId, traceId));
  }
  if (environment) {
    filters.push(eq(agents.environment, environment));
  }

  return db
    .select({
      id: agentActivityEvents.id,
      agentId: agentActivityEvents.agentId,
      projectId: agentActivityEvents.projectId,
      traceId: agentActivityEvents.traceId,
      eventType: agentActivityEvents.eventType,
      summary: agentActivityEvents.summary,
      reason: agentActivityEvents.reason,
      action: agentActivityEvents.action,
      details: agentActivityEvents.details,
      createdAt: agentActivityEvents.createdAt,
      incidentId: incidents.id,
      agentName: agents.name,
      agentChannel: agents.channel,
      agentStatus: agents.status,
      agentConnectionStatus: agents.connectionStatus,
      agentEnvironment: agents.environment,
      agentPartnerId: agents.partnerId,
      agentRuntimeType: agents.runtimeType,
      agentRiskScore: agents.riskScore,
    })
    .from(agentActivityEvents)
    .innerJoin(agents, eq(agentActivityEvents.agentId, agents.id))
    .leftJoin(incidents, eq(incidents.eventId, agentActivityEvents.id))
    .where(and(...filters))
    .orderBy(desc(agentActivityEvents.createdAt))
    .limit(limit ?? 100);
}

export async function getAgentByExternalId(projectId: string, externalBotId: string) {
  return db.query.agents.findFirst({
    where: and(eq(agents.projectId, projectId), eq(agents.externalBotId, externalBotId)),
  });
}

export async function recordAgentHeartbeat(params: {
  projectId: string;
  agentId: string;
  partnerId?: string;
  runtimeType?: string;
  environment?: "local" | "staging" | "prod";
}) {
  const nowIso = new Date().toISOString();
  const updates: Partial<typeof agents.$inferInsert> = {
    lastHeartbeatAt: nowIso,
    updatedAt: nowIso,
  };

  if (params.partnerId) updates.partnerId = params.partnerId;
  if (params.runtimeType) updates.runtimeType = params.runtimeType;
  if (params.environment) updates.environment = params.environment;

  const [updated] = await db
    .update(agents)
    .set(updates)
    .where(and(eq(agents.projectId, params.projectId), eq(agents.id, params.agentId)))
    .returning();

  if (!updated) {
    throw new Error("Agent not found");
  }

  return updated;
}

export async function refreshAgentSafety(
  agent: typeof agents.$inferSelect,
  options?: { isFreeTier?: boolean }
) {
  const now = new Date();
  const riskWindowStart = hoursAgo(24);
  const isFreeTier = options?.isFreeTier ?? (await getProjectDetails(agent.projectId)).isFreeTier;

  const events = await db
    .select({
      eventType: agentActivityEvents.eventType,
      createdAt: agentActivityEvents.createdAt,
      details: agentActivityEvents.details,
    })
    .from(agentActivityEvents)
    .where(
      and(
        eq(agentActivityEvents.projectId, agent.projectId),
        eq(agentActivityEvents.agentId, agent.id),
        gte(agentActivityEvents.createdAt, riskWindowStart.toISOString())
      )
    )
    .orderBy(desc(agentActivityEvents.createdAt));

  const riskScore = calculateRiskScore(events);
  const latestEvent = events[0];
  const lastActivityAt = latestEvent?.createdAt ?? agent.lastActivityAt;

  let adjustedRisk = riskScore;
  const lastActivityDate = toDate(lastActivityAt);
  if (lastActivityDate && lastActivityDate < daysAgo(7)) {
    adjustedRisk = Math.round(riskScore * 0.3);
  }

  let updatedAgent = agent;

  const hasRuntimeEvents = events.some((event) =>
    ["user_message_received", "agent_response_sent", "agent_response_blocked", "guardrail_triggered"].includes(
      event.eventType
    )
  );
  const lastHeartbeatDate = toDate(agent.lastHeartbeatAt);
  const heartbeatStale =
    lastHeartbeatDate !== null && lastHeartbeatDate < minutesAgo(CONNECTION_INACTIVE_MINUTES);
  const nextConnectionStatus = !lastHeartbeatDate
    ? "configured"
    : heartbeatStale
      ? "inactive"
      : hasRuntimeEvents
        ? "connected"
        : "configured";
  const shouldLogDisconnect =
    agent.connectionStatus !== nextConnectionStatus && nextConnectionStatus === "inactive";

  const autoPauseReason =
    agent.status === "running"
      ? determineAutoPauseReason(events, adjustedRisk, agent.guardrailsConfig as Record<string, any> | null)
      : null;
  const autoPauseLocked = Boolean(isFreeTier);
  const shouldPause = agent.status === "running" && autoPauseReason && !autoPauseLocked;

  if (agent.status === "running" && autoPauseReason && autoPauseLocked) {
    const latestNotice = events.find((event) => event.details?.autoPauseRecommended);
    const lastNoticeDate = latestNotice ? toDate(latestNotice.createdAt) : null;
    const shouldNotify = !lastNoticeDate || lastNoticeDate < minutesAgo(30);

    if (shouldNotify) {
      const nowIso = now.toISOString();
      const [noticeEvent] = await db
        .insert(agentActivityEvents)
        .values({
          projectId: agent.projectId,
          agentId: agent.id,
          eventType: "guardrail_triggered",
          summary: "Auto-pause recommended",
          reason: autoPauseReason ?? "Auto-pause recommended for safety.",
          action: "Upgrade to enable auto-pause or pause manually.",
          details: {
            autoPauseRecommended: true,
            riskScore: adjustedRisk,
          },
          createdAt: nowIso,
          environment: agent.environment,
          partnerId: agent.partnerId ?? null,
          runtimeType: agent.runtimeType ?? null,
        })
        .returning();

      if (noticeEvent) {
        await createIncident({
          projectId: agent.projectId,
          agentId: agent.id,
          eventId: noticeEvent.id,
          traceId: noticeEvent.traceId ?? null,
          incidentType: "guardrail_triggered",
          summary: noticeEvent.summary,
          reason: noticeEvent.reason,
          action: noticeEvent.action,
        });
      }

      await logAuditEntry({
        projectId: agent.projectId,
        actorUserId: null,
        action: "auto_pause_locked",
        entityType: "agent",
        entityId: agent.id,
        metadata: {
          reason: autoPauseReason,
          riskScore: adjustedRisk,
        },
      });

      try {
        await createProductEvent({
          name: "upgrade_clicked",
          projectId: agent.projectId,
          agentId: agent.id,
          metadata: { source: "auto_pause_locked" },
        });
      } catch (error) {
        console.error("Failed to log upgrade intent for auto-pause lock:", error);
      }
    }
  }

  if (
    shouldPause ||
    agent.riskScore !== adjustedRisk ||
    (lastActivityAt && agent.lastActivityAt !== lastActivityAt) ||
    agent.connectionStatus !== nextConnectionStatus
  ) {
    const nowIso = now.toISOString();

    const [updated] = await db
      .update(agents)
      .set({
        riskScore: adjustedRisk,
        lastActivityAt: lastActivityAt ?? agent.lastActivityAt,
        status: shouldPause ? "paused" : agent.status,
        pausedAt: shouldPause ? nowIso : agent.pausedAt,
        pauseReason: shouldPause ? autoPauseReason ?? agent.pauseReason : agent.pauseReason,
        connectionStatus: nextConnectionStatus,
        updatedAt: nowIso,
      })
      .where(and(eq(agents.projectId, agent.projectId), eq(agents.id, agent.id)))
      .returning();

    if (updated) {
      updatedAgent = updated;
    }

    if (shouldPause) {
      const [autoPauseEvent] = await db
        .insert(agentActivityEvents)
        .values({
          projectId: agent.projectId,
          agentId: agent.id,
          eventType: "agent_paused_auto",
          summary: DEFAULT_EVENT_COPY.agent_paused_auto.summary,
          action: DEFAULT_EVENT_COPY.agent_paused_auto.action,
          reason: autoPauseReason ?? undefined,
          details: { riskScore: adjustedRisk },
          createdAt: nowIso,
          environment: agent.environment,
          partnerId: agent.partnerId ?? null,
          runtimeType: agent.runtimeType ?? null,
        })
        .returning();

      if (autoPauseEvent) {
        await createIncident({
          projectId: agent.projectId,
          agentId: agent.id,
          eventId: autoPauseEvent.id,
          traceId: autoPauseEvent.traceId ?? null,
          incidentType: "auto_paused",
          summary: DEFAULT_EVENT_COPY.agent_paused_auto.summary,
          reason: autoPauseReason ?? undefined,
          action: DEFAULT_EVENT_COPY.agent_paused_auto.action,
        });
      }
    }

    if (shouldLogDisconnect) {
      const [disconnectEvent] = await db
        .insert(agentActivityEvents)
        .values({
          projectId: agent.projectId,
          agentId: agent.id,
          eventType: "runtime_disconnected",
          summary: DEFAULT_EVENT_COPY.runtime_disconnected.summary,
          action: DEFAULT_EVENT_COPY.runtime_disconnected.action,
          reason: `No heartbeat received in the last ${CONNECTION_INACTIVE_MINUTES} minutes.`,
          details: {
            lastHeartbeatAt: agent.lastHeartbeatAt,
            inactiveMinutes: CONNECTION_INACTIVE_MINUTES,
          },
          createdAt: nowIso,
          environment: agent.environment,
          partnerId: agent.partnerId ?? null,
          runtimeType: agent.runtimeType ?? null,
        })
        .returning();

      if (disconnectEvent) {
        const incident = await createIncident({
          projectId: agent.projectId,
          agentId: agent.id,
          eventId: disconnectEvent.id,
          traceId: disconnectEvent.traceId ?? null,
          incidentType: "runtime_disconnected",
          summary: disconnectEvent.summary,
          reason: disconnectEvent.reason,
          action: disconnectEvent.action,
        });

        await logAuditEntry({
          projectId: agent.projectId,
          actorUserId: null,
          action: "incident_created",
          entityType: "incident",
          entityId: incident.id,
          metadata: {
            incidentType: "runtime_disconnected",
            eventType: disconnectEvent.eventType,
            agentId: agent.id,
            traceId: disconnectEvent.traceId ?? null,
            partnerId: agent.partnerId ?? null,
            runtimeType: agent.runtimeType ?? null,
            environment: agent.environment,
          },
        });
      }
    }
  }

  return updatedAgent;
}

export async function updateAgentsGuardrailsConfig(input: z.infer<typeof UpdateAgentsGuardrailsSchema>) {
  const { projectId, guardrailsConfig } = UpdateAgentsGuardrailsSchema.parse(input);
  const now = new Date().toISOString();

  await db
    .update(agents)
    .set({ guardrailsConfig, updatedAt: now })
    .where(eq(agents.projectId, projectId));

  return { success: true };
}

export const AgentSchemas = {
  AgentChannelSchema,
  AgentStatusSchema,
  AgentActivityTypeSchema,
  GetProjectAgentEventsSchema,
  AgentEnvironmentSchema,
};

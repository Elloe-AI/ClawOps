import { agentActivityEvents, agents } from "@/lib/db/migrations/schema";

export type Agent = typeof agents.$inferSelect;
export type AgentActivityEvent = typeof agentActivityEvents.$inferSelect;
export type AgentActivityEventWithAgent = AgentActivityEvent & {
  agentName: string;
  agentChannel: AgentChannel;
  agentStatus: AgentStatus;
  agentConnectionStatus?: AgentConnectionStatus;
  agentEnvironment?: AgentEnvironment;
  agentPartnerId?: string | null;
  agentRuntimeType?: string | null;
  agentRiskScore: number | null;
  incidentId?: string | null;
};

export type AgentChannel = "telegram" | "discord" | "whatsapp" | "sms";
export type AgentStatus = "running" | "paused" | "blocked";
export type AgentConnectionStatus = "configured" | "connected" | "inactive";
export type AgentEnvironment = "local" | "staging" | "prod";
export type AgentActivityType =
  | "user_message_received"
  | "agent_response_sent"
  | "agent_response_blocked"
  | "guardrail_triggered"
  | "agent_paused_auto"
  | "agent_paused_manual"
  | "agent_resumed"
  | "agent_connected"
  | "runtime_disconnected";

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  running: "Running",
  paused: "Paused",
  blocked: "Needs Review",
};

export const AGENT_CONNECTION_LABELS: Record<AgentConnectionStatus, string> = {
  configured: "Configured",
  connected: "Connected",
  inactive: "Inactive",
};

export const AGENT_ENVIRONMENT_LABELS: Record<AgentEnvironment, string> = {
  local: "Local",
  staging: "Staging",
  prod: "Production",
};

export const AGENT_CHANNEL_LABELS: Record<AgentChannel, string> = {
  telegram: "Telegram",
  discord: "Discord",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

import { sql } from "drizzle-orm";
import { bigint, boolean, doublePrecision, foreignKey, index, integer, jsonb, pgEnum,pgTable, primaryKey, real, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const agentMachineStatus = pgEnum("agent_machine_status", ['not_started', 'running', 'paused', 'stopped']);
export const agentMessageType = pgEnum("agent_message_type", ['user', 'assistant', 'step', 'error']);
export const agentChannel = pgEnum("agent_channel", ['telegram', 'discord', 'whatsapp', 'sms']);
export const agentOperationalStatus = pgEnum("agent_operational_status", ['running', 'paused', 'blocked']);
export const agentConnectionStatus = pgEnum("agent_connection_status", ['configured', 'connected', 'inactive']);
export const agentEnvironment = pgEnum("agent_environment", ['local', 'staging', 'prod']);
export const approvalStatus = pgEnum("approval_status", ['pending', 'approved', 'denied', 'expired']);
export const incidentStatus = pgEnum("incident_status", ['open', 'resolved']);
export const incidentType = pgEnum("incident_type", [
  'blocked_response',
  'guardrail_triggered',
  'auto_paused',
  'manual_paused',
  'approval_requested',
  'approval_completed',
  'runtime_disconnected',
]);
export const complianceMode = pgEnum("compliance_mode", ['general', 'regulated']);
export const agentActivityType = pgEnum("agent_activity_type", [
  'user_message_received',
  'agent_response_sent',
  'agent_response_blocked',
  'guardrail_triggered',
  'agent_paused_auto',
  'agent_paused_manual',
  'agent_resumed',
  'agent_connected',
  'runtime_disconnected',
]);
export const spanType = pgEnum("span_type", ['DEFAULT', 'LLM', 'PIPELINE', 'EXECUTOR', 'EVALUATOR', 'EVALUATION', 'TOOL', 'HUMAN_EVALUATOR', 'EVENT']);
export const tagSource = pgEnum("tag_source", ['MANUAL', 'AUTO', 'CODE']);
export const traceType = pgEnum("trace_type", ['DEFAULT', 'EVENT', 'EVALUATION', 'PLAYGROUND']);
export const workspaceRole = pgEnum("workspace_role", ['member', 'owner', 'admin', 'viewer', 'operator']);


export const projectSettings = pgTable("project_settings", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text(),
  value: text(),
  projectId: uuid("project_id").defaultRandom().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "project_settings_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const agentMessages = pgTable("agent_messages", {
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  id: uuid().defaultRandom().primaryKey().notNull(),
  sessionId: uuid("session_id").notNull(),
  content: jsonb().default({}),
  messageType: agentMessageType("message_type").notNull(),
  traceId: uuid("trace_id"),
}, (table) => [
  index("agent_messages_session_id_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops"), table.sessionId.asc().nullsLast().op("timestamptz_ops")),
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [agentSessions.sessionId],
    name: "agent_messages_session_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const eventDefinitions = pgTable("event_definitions", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  prompt: text(),
  projectId: uuid("project_id").notNull(),
  isSemantic: boolean("is_semantic").default(false).notNull(),
  structuredOutput: jsonb("structured_output"),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "event_definitions_project_id_fkey"
  }).onDelete("cascade"),
  unique("event_definitions_project_id_name_key").on(table.name, table.projectId),
]);

export const agentChats = pgTable("agent_chats", {
  sessionId: uuid("session_id").defaultRandom().primaryKey().notNull(),
  chatName: text("chat_name").default('New chat').notNull(),
  userId: uuid("user_id").notNull(),
  machineStatus: agentMachineStatus("machine_status").default('not_started'),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  agentStatus: text("agent_status").default('idle').notNull(),
}, (table) => [
  index("agent_chats_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
  index("agent_chats_updated_at_idx").using("btree", table.updatedAt.asc().nullsLast().op("timestamptz_ops")),
  index("agent_chats_user_id_idx").using("hash", table.userId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [agentSessions.sessionId],
    name: "agent_chats_session_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "agent_chats_user_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const agentSessions = pgTable("agent_sessions", {
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  sessionId: uuid("session_id").defaultRandom().primaryKey().notNull(),
  cdpUrl: text("cdp_url"),
  vncUrl: text("vnc_url"),
  machineId: text("machine_id"),
  state: text(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  agentStatus: text("agent_status").default('idle').notNull(),
}, (table) => [
  index("agent_sessions_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
  index("agent_sessions_updated_at_idx").using("btree", table.updatedAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const llmPrices = pgTable("llm_prices", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  provider: text().notNull(),
  model: text().notNull(),
  inputPricePerMillion: doublePrecision("input_price_per_million").notNull(),
  outputPricePerMillion: doublePrecision("output_price_per_million").notNull(),
  inputCachedPricePerMillion: doublePrecision("input_cached_price_per_million"),
  additionalPrices: jsonb("additional_prices").default({}).notNull(),
});

export const eventClusters = pgTable("event_clusters", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
  projectId: uuid("project_id").defaultRandom().notNull(),
  level: integer().notNull(),
  parentId: uuid("parent_id"),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  numChildrenClusters: bigint("num_children_clusters", { mode: "number" }).notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  numEvents: bigint("num_events", { mode: "number" }).notNull(),
  centroid: jsonb().notNull(),
  name: text().notNull(),
  eventName: text("event_name").notNull(),
  eventSource: text("event_source").default('SEMANTIC').notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "event_clusters_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const slackChannelToEvents = pgTable("slack_channel_to_events", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  channelId: text("channel_id").notNull(),
  projectId: uuid("project_id").notNull(),
  eventName: text("event_name").notNull(),
  integrationId: uuid("integration_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.integrationId],
    foreignColumns: [slackIntegrations.id],
    name: "slack_channel_to_events_integration_id_fkey"
  }).onDelete("cascade"),
  unique("slack_channel_to_events_integration_channel_event_key").on(table.channelId, table.eventName, table.integrationId),
]);

export const eventClusterConfigs = pgTable("event_cluster_configs", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  eventName: text("event_name").notNull(),
  valueTemplate: text("value_template").notNull(),
  projectId: uuid("project_id").notNull(),
  eventSource: text("event_source").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "event_cluster_configs_project_id_fkey"
  }).onDelete("cascade"),
  unique("event_cluster_configs_project_id_event_name_source_key").on(table.eventName, table.projectId, table.eventSource),
]);

export const slackIntegrations = pgTable("slack_integrations", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  projectId: uuid("project_id").notNull(),
  token: text().notNull(),
  teamId: text("team_id").notNull(),
  teamName: text("team_name"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  nonceHex: text("nonce_hex").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "slack_integrations_project_id_fkey"
  }).onDelete("cascade"),
  unique("slack_integrations_project_id_key").on(table.projectId),
]);

export const datasets = pgTable("datasets", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  projectId: uuid("project_id").defaultRandom().notNull(),
  indexedOn: text("indexed_on"),
}, (table) => [
  index("datasets_project_id_hash_idx").using("hash", table.projectId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "datasets_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const projects = pgTable("projects", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  complianceMode: complianceMode("compliance_mode").default('general').notNull(),
}, (table) => [
  index("projects_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.workspaceId],
    foreignColumns: [workspaces.id],
    name: "projects_workspace_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const agents = pgTable("agents", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  projectId: uuid("project_id").notNull(),
  name: text().notNull(),
  channel: agentChannel("channel").notNull(),
  externalBotId: text("external_bot_id").notNull(),
  environment: agentEnvironment("environment").default('prod').notNull(),
  status: agentOperationalStatus("status").default('running').notNull(),
  connectionStatus: agentConnectionStatus("connection_status").default('configured').notNull(),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true, mode: 'string' }),
  riskScore: real("risk_score").default(sql`'0'`).notNull(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: 'string' }),
  pausedAt: timestamp("paused_at", { withTimezone: true, mode: 'string' }),
  pauseReason: text("pause_reason"),
  partnerId: text("partner_id"),
  runtimeType: text("runtime_type"),
  guardrailsConfig: jsonb("guardrails_config").default({}).notNull(),
  channelConfig: jsonb("channel_config").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("agents_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
  index("agents_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "agents_project_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  unique("agents_project_channel_bot_unique").on(table.projectId, table.channel, table.externalBotId),
]);

export const agentActivityEvents = pgTable("agent_activity_events", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  agentId: uuid("agent_id").notNull(),
  projectId: uuid("project_id").notNull(),
  traceId: uuid("trace_id"),
  eventType: agentActivityType("event_type").notNull(),
  summary: text(),
  reason: text(),
  action: text(),
  details: jsonb(),
  environment: agentEnvironment("environment"),
  partnerId: text("partner_id"),
  runtimeType: text("runtime_type"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("agent_activity_agent_id_created_at_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
  index("agent_activity_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
  index("agent_activity_type_idx").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
  index("agent_activity_trace_id_idx").using("btree", table.traceId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.agentId],
    foreignColumns: [agents.id],
    name: "agent_activity_events_agent_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "agent_activity_events_project_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.traceId, table.projectId],
    foreignColumns: [traces.id, traces.projectId],
    name: "agent_activity_events_trace_id_fkey",
  }).onUpdate("cascade").onDelete("set null"),
]);

export const incidents = pgTable("incidents", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  projectId: uuid("project_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  eventId: uuid("event_id").notNull(),
  traceId: uuid("trace_id"),
  incidentType: incidentType("incident_type").notNull(),
  status: incidentStatus("status").default('open').notNull(),
  category: text(),
  summary: text(),
  reason: text(),
  action: text(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
  index("incidents_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
  index("incidents_agent_id_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
  index("incidents_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "incidents_project_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.agentId],
    foreignColumns: [agents.id],
    name: "incidents_agent_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.eventId],
    foreignColumns: [agentActivityEvents.id],
    name: "incidents_event_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.traceId, table.projectId],
    foreignColumns: [traces.id, traces.projectId],
    name: "incidents_trace_id_fkey",
  }).onUpdate("cascade").onDelete("set null"),
]);

export const agentApprovals = pgTable("agent_approvals", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  projectId: uuid("project_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  incidentId: uuid("incident_id").notNull(),
  status: approvalStatus("status").default('pending').notNull(),
  requestDetails: jsonb("request_details").default({}).notNull(),
  responseDetails: jsonb("response_details").default({}).notNull(),
  requestedBy: uuid("requested_by"),
  approvedBy: uuid("approved_by"),
  requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true, mode: 'string' }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("agent_approvals_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
  index("agent_approvals_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "agent_approvals_project_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.agentId],
    foreignColumns: [agents.id],
    name: "agent_approvals_agent_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.incidentId],
    foreignColumns: [incidents.id],
    name: "agent_approvals_incident_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.requestedBy],
    foreignColumns: [users.id],
    name: "agent_approvals_requested_by_fkey",
  }).onUpdate("cascade").onDelete("set null"),
  foreignKey({
    columns: [table.approvedBy],
    foreignColumns: [users.id],
    name: "agent_approvals_approved_by_fkey",
  }).onUpdate("cascade").onDelete("set null"),
]);

export const auditLogEntries = pgTable("audit_log_entries", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  projectId: uuid("project_id"),
  workspaceId: uuid("workspace_id"),
  actorUserId: uuid("actor_user_id"),
  action: text().notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  before: jsonb(),
  after: jsonb(),
  metadata: jsonb().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("audit_log_entries_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
  index("audit_log_entries_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "audit_log_entries_project_id_fkey",
  }).onUpdate("cascade").onDelete("set null"),
  foreignKey({
    columns: [table.workspaceId],
    foreignColumns: [workspaces.id],
    name: "audit_log_entries_workspace_id_fkey",
  }).onUpdate("cascade").onDelete("set null"),
  foreignKey({
    columns: [table.actorUserId],
    foreignColumns: [users.id],
    name: "audit_log_entries_actor_user_id_fkey",
  }).onUpdate("cascade").onDelete("set null"),
]);

export const safetyTemplates = pgTable("safety_templates", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  projectId: uuid("project_id"),
  name: text().notNull(),
  description: text(),
  version: integer().default(1).notNull(),
  guardrailsConfig: jsonb("guardrails_config").default({}).notNull(),
  threatProtectionConfig: jsonb("threat_protection_config").default({}).notNull(),
  visibility: text().default('private').notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
  checksum: text().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("safety_templates_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
  index("safety_templates_visibility_idx").using("btree", table.visibility.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "safety_templates_project_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [users.id],
    name: "safety_templates_created_by_fkey",
  }).onUpdate("cascade").onDelete("set null"),
  foreignKey({
    columns: [table.updatedBy],
    foreignColumns: [users.id],
    name: "safety_templates_updated_by_fkey",
  }).onUpdate("cascade").onDelete("set null"),
]);

export const safetyTemplateApplications = pgTable("safety_template_applications", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  projectId: uuid("project_id").notNull(),
  templateId: uuid("template_id").notNull(),
  appliedBy: uuid("applied_by"),
  appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  previousGuardrailsConfig: jsonb("previous_guardrails_config").default({}).notNull(),
  previousThreatProtectionConfig: jsonb("previous_threat_protection_config").default({}).notNull(),
  newGuardrailsConfig: jsonb("new_guardrails_config").default({}).notNull(),
  newThreatProtectionConfig: jsonb("new_threat_protection_config").default({}).notNull(),
  revertedAt: timestamp("reverted_at", { withTimezone: true, mode: 'string' }),
  revertedBy: uuid("reverted_by"),
}, (table) => [
  index("safety_template_applications_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "safety_template_applications_project_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.templateId],
    foreignColumns: [safetyTemplates.id],
    name: "safety_template_applications_template_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.appliedBy],
    foreignColumns: [users.id],
    name: "safety_template_applications_applied_by_fkey",
  }).onUpdate("cascade").onDelete("set null"),
  foreignKey({
    columns: [table.revertedBy],
    foreignColumns: [users.id],
    name: "safety_template_applications_reverted_by_fkey",
  }).onUpdate("cascade").onDelete("set null"),
]);

export const readinessChecks = pgTable("readiness_checks", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  status: text().notNull(),
  details: jsonb().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("readiness_checks_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const workspaceDeployments = pgTable("workspace_deployments", {
  workspaceId: uuid("workspace_id").primaryKey().notNull(),
  mode: text().default('CLOUD').notNull(),
  privateKey: text("private_key"),
  privateKeyNonce: text("private_key_nonce"),
  publicKey: text("public_key"),
  dataPlaneUrl: text("data_plane_url"),
  dataPlaneUrlNonce: text("data_plane_url_nonce"),
});

export const membersOfWorkspaces = pgTable("members_of_workspaces", {
  workspaceId: uuid("workspace_id").notNull(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  id: uuid().defaultRandom().primaryKey().notNull(),
  memberRole: workspaceRole("member_role").default('owner').notNull(),
}, (table) => [
  index("members_of_workspaces_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "members_of_workspaces_user_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.workspaceId],
    foreignColumns: [workspaces.id],
    name: "members_of_workspaces_workspace_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
  unique("members_of_workspaces_user_workspace_unique").on(table.workspaceId, table.userId),
]);

export const providerApiKeys = pgTable("provider_api_keys", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  projectId: uuid("project_id").defaultRandom().notNull(),
  nonceHex: text("nonce_hex").notNull(),
  value: text().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "provider_api_keys_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const projectApiKeys = pgTable("project_api_keys", {
  value: text(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text(),
  projectId: uuid("project_id").notNull(),
  shorthand: text(),
  hash: text(),
  id: uuid().defaultRandom().primaryKey().notNull(),
  isIngestOnly: boolean("is_ingest_only").default(false).notNull(),
}, (table) => [
  index("project_api_keys_hash_idx").using("hash", table.hash.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "public_project_api_keys_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const userSubscriptionInfo = pgTable("user_subscription_info", {
  userId: uuid("user_id").defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  activated: boolean().default(false).notNull(),
}, (table) => [
  index("user_subscription_info_stripe_customer_id_idx").using("btree", table.stripeCustomerId.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "user_subscription_info_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const datasetExportJobs = pgTable("dataset_export_jobs", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  datasetId: uuid("dataset_id").notNull(),
  projectId: uuid("project_id").notNull(),
  status: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.datasetId],
    foreignColumns: [datasets.id],
    name: "dataset_export_jobs_dataset_id_fkey"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "dataset_export_jobs_project_id_fkey"
  }).onDelete("cascade"),
  unique("dataset_export_jobs_project_dataset_key").on(table.datasetId, table.projectId),
]);

export const datasetParquets = pgTable("dataset_parquets", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  datasetId: uuid("dataset_id").notNull(),
  parquetPath: text("parquet_path").notNull(),
  jobId: uuid("job_id").notNull(),
  name: text(),
  projectId: uuid("project_id").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.datasetId],
    foreignColumns: [datasets.id],
    name: "dataset_parquets_dataset_id_fkey"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "dataset_parquets_project_id_fkey"
  }).onDelete("cascade"),
]);

export const apiKeys = pgTable("api_keys", {
  apiKey: text("api_key").primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  userId: uuid("user_id").notNull(),
  name: text().default('default').notNull(),
}, (table) => [
  index("api_keys_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "api_keys_user_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const events = pgTable("events", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  spanId: uuid("span_id").notNull(),
  timestamp: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
  name: text().notNull(),
  attributes: jsonb().default({}).notNull(),
  projectId: uuid("project_id").notNull(),
}, (table) => [
  index("events_span_id_idx").using("btree", table.spanId.asc().nullsLast().op("uuid_ops")),
  index("events_span_id_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops"), table.spanId.asc().nullsLast().op("uuid_ops")),
]);

export const renderTemplates = pgTable("render_templates", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  projectId: uuid("project_id").defaultRandom().notNull(),
  code: text().notNull(),
  name: text().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "render_templates_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const workspaceInvitations = pgTable("workspace_invitations", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  workspaceId: uuid("workspace_id").defaultRandom().notNull(),
  email: text(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId],
    foreignColumns: [workspaces.id],
    name: "workspace_invitations_workspace_id_fkey"
  }).onDelete("cascade"),
]);

export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  email: text().notNull(),
  subscriptionId: text("subscription_id"),
  avatarUrl: text("avatar_url"),
}, (table) => [
  unique("users_email_key").on(table.email),
]);

export const productEvents = pgTable("product_events", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  userId: uuid("user_id"),
  projectId: uuid("project_id"),
  agentId: uuid("agent_id"),
  metadata: jsonb().default({}).notNull(),
}, (table) => [
  index("product_events_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
  index("product_events_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
  index("product_events_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
  index("product_events_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
  index("product_events_agent_id_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "product_events_user_id_fkey",
  }).onUpdate("cascade").onDelete("set null"),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "product_events_project_id_fkey",
  }).onUpdate("cascade").onDelete("set null"),
  foreignKey({
    columns: [table.agentId],
    foreignColumns: [agents.id],
    name: "product_events_agent_id_fkey",
  }).onUpdate("cascade").onDelete("set null"),
]);

export const labelingQueueItems = pgTable("labeling_queue_items", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  queueId: uuid("queue_id").defaultRandom().notNull(),
  metadata: jsonb().default({}),
  payload: jsonb().default({}),
}, (table) => [
  foreignKey({
    columns: [table.queueId],
    foreignColumns: [labelingQueues.id],
    name: "labelling_queue_items_queue_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const evaluationResults = pgTable("evaluation_results", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  evaluationId: uuid("evaluation_id").notNull(),
  data: jsonb().default({}).notNull(),
  target: jsonb().default({}).notNull(),
  executorOutput: jsonb("executor_output"),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  indexInBatch: bigint("index_in_batch", { mode: "number" }),
  traceId: uuid("trace_id").notNull(),
  index: integer().default(0).notNull(),
  metadata: jsonb(),
}, (table) => [
  index("evaluation_results_evaluation_id_idx").using("btree", table.evaluationId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.evaluationId],
    foreignColumns: [evaluations.id],
    name: "evaluation_results_evaluation_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const evaluators = pgTable("evaluators", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  projectId: uuid("project_id").notNull(),
  name: text().notNull(),
  evaluatorType: text("evaluator_type").notNull(),
  definition: jsonb().default({}),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "evaluators_project_id_fkey"
  }).onDelete("cascade"),
]);

export const evaluatorSpanPaths = pgTable("evaluator_span_paths", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  evaluatorId: uuid("evaluator_id").notNull(),
  projectId: uuid("project_id").notNull(),
  spanPath: jsonb("span_path").default({}),
}, (table) => [
  foreignKey({
    columns: [table.evaluatorId],
    foreignColumns: [evaluators.id],
    name: "evaluator_span_paths_evaluator_id_fkey"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "evaluator_span_paths_project_id_fkey"
  }).onDelete("cascade"),
]);

export const subscriptionTiers = pgTable("subscription_tiers", {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "subscription_tiers_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  storageMib: bigint("storage_mib", { mode: "number" }).notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  logRetentionDays: bigint("log_retention_days", { mode: "number" }).notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  membersPerWorkspace: bigint("members_per_workspace", { mode: "number" }).default(sql`'-1'`).notNull(),
  stripeProductId: text("stripe_product_id"),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  steps: bigint({ mode: "number" }).default(sql`'0'`).notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  spans: bigint({ mode: "number" }),
  extraSpanPrice: doublePrecision("extra_span_price"),
  extraStepPrice: doublePrecision("extra_step_price").default(sql`'0'`).notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  bytesIngested: bigint("bytes_ingested", { mode: "number" }).default(sql`'0'`).notNull(),
  extraBytePrice: doublePrecision("extra_byte_price").default(sql`'0'`).notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  tierId: bigint("tier_id", { mode: "number" }).default(sql`'1'`).notNull(),
  subscriptionId: text("subscription_id"),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  additionalSeats: bigint("additional_seats", { mode: "number" }).default(sql`'0'`).notNull(),
  resetTime: timestamp("reset_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tierId],
    foreignColumns: [subscriptionTiers.id],
    name: "workspaces_tier_id_fkey"
  }).onUpdate("cascade"),
]);

export const evaluations = pgTable("evaluations", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  projectId: uuid("project_id").notNull(),
  name: text().notNull(),
  groupId: text("group_id").default('default').notNull(),
  metadata: jsonb(),
}, (table) => [
  index("evaluations_project_id_hash_idx").using("hash", table.projectId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "evaluations_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const sharedPayloads = pgTable("shared_payloads", {
  payloadId: uuid("payload_id").defaultRandom().primaryKey().notNull(),
  projectId: uuid("project_id").defaultRandom().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "shared_payloads_project_id_fkey"
  }).onDelete("cascade"),
]);

export const playgrounds = pgTable("playgrounds", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  projectId: uuid("project_id").notNull(),
  promptMessages: jsonb("prompt_messages").default([{"role":"user","content":""}]).notNull(),
  modelId: text("model_id"),
  outputSchema: text("output_schema"),
  tools: jsonb().default({}),
  toolChoice: jsonb("tool_choice").default("none"),
  maxTokens: integer("max_tokens").default(1024),
  temperature: real().default(sql`'1'`),
  providerOptions: jsonb("provider_options").default({}),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "playgrounds_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const evaluatorScores = pgTable("evaluator_scores", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  evaluatorId: uuid("evaluator_id"),
  projectId: uuid("project_id").notNull(),
  spanId: uuid("span_id").notNull(),
  score: doublePrecision().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  source: text().notNull(),
  metadata: jsonb().default({}),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "evaluator_scores_project_id_fkey"
  }).onDelete("cascade"),
]);

export const sqlTemplates = pgTable("sql_templates", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  query: text().notNull(),
  projectId: uuid("project_id").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "sql_templates_project_id_fkey"
  }).onDelete("cascade"),
]);

export const dashboardCharts = pgTable("dashboard_charts", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  query: text().notNull(),
  settings: jsonb().notNull(),
  projectId: uuid("project_id").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "dashboard_charts_project_id_fkey"
  }).onDelete("cascade"),
]);

export const labelingQueues = pgTable("labeling_queues", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  projectId: uuid("project_id").notNull(),
  annotationSchema: jsonb("annotation_schema"),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "labeling_queues_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const tracesAgentChats = pgTable("traces_agent_chats", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  traceId: uuid("trace_id").notNull(),
  projectId: uuid("project_id").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "traces_agent_chats_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const tracesAgentMessages = pgTable("traces_agent_messages", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  role: text().notNull(),
  parts: jsonb().notNull(),
  chatId: uuid("chat_id").notNull(),
  traceId: uuid("trace_id").notNull(),
  projectId: uuid("project_id").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "traces_agent_messages_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const sharedTraces = pgTable("shared_traces", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  projectId: uuid("project_id").defaultRandom().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "shared_traces_project_id_fkey"
  }).onDelete("cascade"),
]);

export const semanticEventTriggerSpans = pgTable("semantic_event_trigger_spans", {
  id: uuid().defaultRandom().notNull(),
  projectId: uuid("project_id").defaultRandom().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  spanName: text("span_name").notNull(),
  eventDefinitionId: uuid("event_definition_id").defaultRandom().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId, table.eventDefinitionId],
    foreignColumns: [semanticEventDefinitions.id, semanticEventDefinitions.projectId],
    name: "semantic_event_trigger_spans_event_definition_id_project_i_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
  primaryKey({ columns: [table.id, table.projectId], name: "semantic_event_trigger_spans_pkey"}),
  unique("semantic_event_trigger_spans_project_event_definition_span_key").on(table.projectId, table.spanName, table.eventDefinitionId),
]);

export const tagClasses = pgTable("tag_classes", {
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  projectId: uuid("project_id").notNull(),
  color: text().default('rgb(190, 194, 200)').notNull(),
  description: text(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "tag_classes_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
  primaryKey({ columns: [table.name, table.projectId], name: "tag_classes_pkey"}),
  unique("label_classes_name_project_id_unique").on(table.name, table.projectId),
  unique("tag_classes_name_project_id_unique").on(table.name, table.projectId),
]);

export const semanticEventDefinitions = pgTable("semantic_event_definitions", {
  id: uuid().defaultRandom().notNull(),
  projectId: uuid("project_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  prompt: text().notNull(),
  structuredOutputSchema: jsonb("structured_output_schema").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "semantic_event_definitions_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
  primaryKey({ columns: [table.id, table.projectId], name: "semantic_event_definitions_pkey"}),
  unique("semantic_event_definitions_project_id_name_key").on(table.projectId, table.name),
]);

export const clusters = pgTable("clusters", {
  id: uuid().defaultRandom().notNull(),
  projectId: uuid("project_id").defaultRandom().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
  name: text().notNull(),
  parentId: uuid("parent_id").defaultRandom(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  level: bigint({ mode: "number" }).notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  numChildrenClusters: bigint("num_children_clusters", { mode: "number" }).notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  numTraces: bigint("num_traces", { mode: "number" }).notNull(),
  centroid: doublePrecision().array().notNull(),
}, (table) => [
  index("clusters_project_id_level_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops"), table.level.asc().nullsLast().op("int8_ops")),
  index("clusters_project_id_name_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "clusters_project_id_fkey"
  }),
  primaryKey({ columns: [table.id, table.projectId], name: "clusters_pkey"}),
]);

export const traces = pgTable("traces", {
  id: uuid().defaultRandom().notNull(),
  sessionId: text("session_id"),
  metadata: jsonb(),
  projectId: uuid("project_id").notNull(),
  endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
  startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  totalTokenCount: bigint("total_token_count", { mode: "number" }).default(sql`'0'`).notNull(),
  cost: doublePrecision().default(sql`'0'`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  traceType: traceType("trace_type"),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  inputTokenCount: bigint("input_token_count", { mode: "number" }).default(sql`'0'`).notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  outputTokenCount: bigint("output_token_count", { mode: "number" }).default(sql`'0'`).notNull(),
  inputCost: doublePrecision("input_cost").default(sql`'0'`).notNull(),
  outputCost: doublePrecision("output_cost").default(sql`'0'`).notNull(),
  hasBrowserSession: boolean("has_browser_session"),
  topSpanId: uuid("top_span_id"),
  agentSessionId: uuid("agent_session_id"),
  visibility: text().default(''),
  status: text(),
  userId: text("user_id"),
  tags: text().array(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  numSpans: bigint("num_spans", { mode: "number" }),
  topSpanName: text("top_span_name"),
  topSpanType: smallint("top_span_type"),
  type: smallint(),
}, (table) => [
  index("traces_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
  index("traces_session_id_idx").using("btree", table.sessionId.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "new_traces_project_id_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
  primaryKey({ columns: [table.id, table.projectId], name: "traces_pkey"}),
  unique("traces_project_id_id_unique").on(table.id, table.projectId),
]);

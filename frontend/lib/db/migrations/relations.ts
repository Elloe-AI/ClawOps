import { relations } from "drizzle-orm/relations";

import { agentActivityEvents, agentApprovals, agentChats, agentMessages, agentSessions, agents, apiKeys, auditLogEntries, clusters, dashboardCharts, datasetExportJobs, datasetParquets, datasets, evaluationResults, evaluations, evaluators, evaluatorScores, evaluatorSpanPaths, eventClusterConfigs, eventClusters, eventDefinitions, incidents, labelingQueueItems, labelingQueues, membersOfWorkspaces, playgrounds, productEvents, projectApiKeys, projects, projectSettings, providerApiKeys, readinessChecks, renderTemplates, safetyTemplateApplications, safetyTemplates, semanticEventDefinitions, semanticEventTriggerSpans, sharedPayloads, sharedTraces, slackChannelToEvents, slackIntegrations, sqlTemplates, subscriptionTiers, tagClasses, traces,tracesAgentChats, tracesAgentMessages, users, userSubscriptionInfo, workspaceInvitations, workspaces } from "./schema";

export const projectSettingsRelations = relations(projectSettings, ({one}) => ({
  project: one(projects, {
    fields: [projectSettings.projectId],
    references: [projects.id]
  }),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
  projectSettings: many(projectSettings),
  eventDefinitions: many(eventDefinitions),
  eventClusters: many(eventClusters),
  eventClusterConfigs: many(eventClusterConfigs),
  slackIntegrations: many(slackIntegrations),
  datasets: many(datasets),
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id]
  }),
  providerApiKeys: many(providerApiKeys),
  projectApiKeys: many(projectApiKeys),
  datasetExportJobs: many(datasetExportJobs),
  datasetParquets: many(datasetParquets),
  renderTemplates: many(renderTemplates),
  evaluators: many(evaluators),
  evaluatorSpanPaths: many(evaluatorSpanPaths),
  evaluations: many(evaluations),
  sharedPayloads: many(sharedPayloads),
  playgrounds: many(playgrounds),
  evaluatorScores: many(evaluatorScores),
  sqlTemplates: many(sqlTemplates),
  dashboardCharts: many(dashboardCharts),
  labelingQueues: many(labelingQueues),
  tracesAgentChats: many(tracesAgentChats),
  tracesAgentMessages: many(tracesAgentMessages),
  agents: many(agents),
  agentActivityEvents: many(agentActivityEvents),
  incidents: many(incidents),
  agentApprovals: many(agentApprovals),
  auditLogEntries: many(auditLogEntries),
  safetyTemplates: many(safetyTemplates),
  safetyTemplateApplications: many(safetyTemplateApplications),
  productEvents: many(productEvents),
  sharedTraces: many(sharedTraces),
  tagClasses: many(tagClasses),
  semanticEventDefinitions: many(semanticEventDefinitions),
  clusters: many(clusters),
  traces: many(traces),
}));

export const agentMessagesRelations = relations(agentMessages, ({one}) => ({
  agentSession: one(agentSessions, {
    fields: [agentMessages.sessionId],
    references: [agentSessions.sessionId]
  }),
}));

export const agentSessionsRelations = relations(agentSessions, ({many}) => ({
  agentMessages: many(agentMessages),
  agentChats: many(agentChats),
}));

export const agentsRelations = relations(agents, ({one, many}) => ({
  project: one(projects, {
    fields: [agents.projectId],
    references: [projects.id]
  }),
  activityEvents: many(agentActivityEvents),
  incidents: many(incidents),
  approvals: many(agentApprovals),
  productEvents: many(productEvents),
}));

export const agentActivityEventsRelations = relations(agentActivityEvents, ({one}) => ({
  agent: one(agents, {
    fields: [agentActivityEvents.agentId],
    references: [agents.id]
  }),
  project: one(projects, {
    fields: [agentActivityEvents.projectId],
    references: [projects.id]
  }),
  trace: one(traces, {
    fields: [agentActivityEvents.traceId, agentActivityEvents.projectId],
    references: [traces.id, traces.projectId]
  }),
}));

export const incidentsRelations = relations(incidents, ({one, many}) => ({
  agent: one(agents, {
    fields: [incidents.agentId],
    references: [agents.id],
  }),
  project: one(projects, {
    fields: [incidents.projectId],
    references: [projects.id],
  }),
  event: one(agentActivityEvents, {
    fields: [incidents.eventId],
    references: [agentActivityEvents.id],
  }),
  approvals: many(agentApprovals),
}));

export const agentApprovalsRelations = relations(agentApprovals, ({one}) => ({
  agent: one(agents, {
    fields: [agentApprovals.agentId],
    references: [agents.id],
  }),
  project: one(projects, {
    fields: [agentApprovals.projectId],
    references: [projects.id],
  }),
  incident: one(incidents, {
    fields: [agentApprovals.incidentId],
    references: [incidents.id],
  }),
  requestedByUser: one(users, {
    fields: [agentApprovals.requestedBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [agentApprovals.approvedBy],
    references: [users.id],
  }),
}));

export const auditLogEntriesRelations = relations(auditLogEntries, ({one}) => ({
  project: one(projects, {
    fields: [auditLogEntries.projectId],
    references: [projects.id],
  }),
  workspace: one(workspaces, {
    fields: [auditLogEntries.workspaceId],
    references: [workspaces.id],
  }),
  actor: one(users, {
    fields: [auditLogEntries.actorUserId],
    references: [users.id],
  }),
}));

export const safetyTemplatesRelations = relations(safetyTemplates, ({one, many}) => ({
  project: one(projects, {
    fields: [safetyTemplates.projectId],
    references: [projects.id],
  }),
  createdByUser: one(users, {
    fields: [safetyTemplates.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [safetyTemplates.updatedBy],
    references: [users.id],
  }),
  applications: many(safetyTemplateApplications),
}));

export const safetyTemplateApplicationsRelations = relations(safetyTemplateApplications, ({one}) => ({
  project: one(projects, {
    fields: [safetyTemplateApplications.projectId],
    references: [projects.id],
  }),
  template: one(safetyTemplates, {
    fields: [safetyTemplateApplications.templateId],
    references: [safetyTemplates.id],
  }),
  appliedByUser: one(users, {
    fields: [safetyTemplateApplications.appliedBy],
    references: [users.id],
  }),
  revertedByUser: one(users, {
    fields: [safetyTemplateApplications.revertedBy],
    references: [users.id],
  }),
}));

export const readinessChecksRelations = relations(readinessChecks, () => ({}));

export const eventDefinitionsRelations = relations(eventDefinitions, ({one}) => ({
  project: one(projects, {
    fields: [eventDefinitions.projectId],
    references: [projects.id]
  }),
}));

export const agentChatsRelations = relations(agentChats, ({one}) => ({
  agentSession: one(agentSessions, {
    fields: [agentChats.sessionId],
    references: [agentSessions.sessionId]
  }),
  user: one(users, {
    fields: [agentChats.userId],
    references: [users.id]
  }),
}));

export const usersRelations = relations(users, ({many}) => ({
  agentChats: many(agentChats),
  membersOfWorkspaces: many(membersOfWorkspaces),
  userSubscriptionInfos: many(userSubscriptionInfo),
  apiKeys: many(apiKeys),
  productEvents: many(productEvents),
  auditLogEntries: many(auditLogEntries),
  safetyTemplates: many(safetyTemplates),
  safetyTemplateApplications: many(safetyTemplateApplications),
}));

export const productEventsRelations = relations(productEvents, ({one}) => ({
  project: one(projects, {
    fields: [productEvents.projectId],
    references: [projects.id]
  }),
  agent: one(agents, {
    fields: [productEvents.agentId],
    references: [agents.id]
  }),
  user: one(users, {
    fields: [productEvents.userId],
    references: [users.id]
  }),
}));

export const eventClustersRelations = relations(eventClusters, ({one}) => ({
  project: one(projects, {
    fields: [eventClusters.projectId],
    references: [projects.id]
  }),
}));

export const slackChannelToEventsRelations = relations(slackChannelToEvents, ({one}) => ({
  slackIntegration: one(slackIntegrations, {
    fields: [slackChannelToEvents.integrationId],
    references: [slackIntegrations.id]
  }),
}));

export const slackIntegrationsRelations = relations(slackIntegrations, ({one, many}) => ({
  slackChannelToEvents: many(slackChannelToEvents),
  project: one(projects, {
    fields: [slackIntegrations.projectId],
    references: [projects.id]
  }),
}));

export const eventClusterConfigsRelations = relations(eventClusterConfigs, ({one}) => ({
  project: one(projects, {
    fields: [eventClusterConfigs.projectId],
    references: [projects.id]
  }),
}));

export const datasetsRelations = relations(datasets, ({one, many}) => ({
  project: one(projects, {
    fields: [datasets.projectId],
    references: [projects.id]
  }),
  datasetExportJobs: many(datasetExportJobs),
  datasetParquets: many(datasetParquets),
}));

export const workspacesRelations = relations(workspaces, ({one, many}) => ({
  projects: many(projects),
  membersOfWorkspaces: many(membersOfWorkspaces),
  workspaceInvitations: many(workspaceInvitations),
  subscriptionTier: one(subscriptionTiers, {
    fields: [workspaces.tierId],
    references: [subscriptionTiers.id]
  }),
}));

export const membersOfWorkspacesRelations = relations(membersOfWorkspaces, ({one}) => ({
  user: one(users, {
    fields: [membersOfWorkspaces.userId],
    references: [users.id]
  }),
  workspace: one(workspaces, {
    fields: [membersOfWorkspaces.workspaceId],
    references: [workspaces.id]
  }),
}));

export const providerApiKeysRelations = relations(providerApiKeys, ({one}) => ({
  project: one(projects, {
    fields: [providerApiKeys.projectId],
    references: [projects.id]
  }),
}));

export const projectApiKeysRelations = relations(projectApiKeys, ({one}) => ({
  project: one(projects, {
    fields: [projectApiKeys.projectId],
    references: [projects.id]
  }),
}));

export const userSubscriptionInfoRelations = relations(userSubscriptionInfo, ({one}) => ({
  user: one(users, {
    fields: [userSubscriptionInfo.userId],
    references: [users.id]
  }),
}));

export const datasetExportJobsRelations = relations(datasetExportJobs, ({one}) => ({
  dataset: one(datasets, {
    fields: [datasetExportJobs.datasetId],
    references: [datasets.id]
  }),
  project: one(projects, {
    fields: [datasetExportJobs.projectId],
    references: [projects.id]
  }),
}));

export const datasetParquetsRelations = relations(datasetParquets, ({one}) => ({
  dataset: one(datasets, {
    fields: [datasetParquets.datasetId],
    references: [datasets.id]
  }),
  project: one(projects, {
    fields: [datasetParquets.projectId],
    references: [projects.id]
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({one}) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id]
  }),
}));

export const renderTemplatesRelations = relations(renderTemplates, ({one}) => ({
  project: one(projects, {
    fields: [renderTemplates.projectId],
    references: [projects.id]
  }),
}));

export const workspaceInvitationsRelations = relations(workspaceInvitations, ({one}) => ({
  workspace: one(workspaces, {
    fields: [workspaceInvitations.workspaceId],
    references: [workspaces.id]
  }),
}));

export const labelingQueueItemsRelations = relations(labelingQueueItems, ({one}) => ({
  labelingQueue: one(labelingQueues, {
    fields: [labelingQueueItems.queueId],
    references: [labelingQueues.id]
  }),
}));

export const labelingQueuesRelations = relations(labelingQueues, ({one, many}) => ({
  labelingQueueItems: many(labelingQueueItems),
  project: one(projects, {
    fields: [labelingQueues.projectId],
    references: [projects.id]
  }),
}));

export const evaluationResultsRelations = relations(evaluationResults, ({one}) => ({
  evaluation: one(evaluations, {
    fields: [evaluationResults.evaluationId],
    references: [evaluations.id]
  }),
}));

export const evaluationsRelations = relations(evaluations, ({one, many}) => ({
  evaluationResults: many(evaluationResults),
  project: one(projects, {
    fields: [evaluations.projectId],
    references: [projects.id]
  }),
}));

export const evaluatorsRelations = relations(evaluators, ({one, many}) => ({
  project: one(projects, {
    fields: [evaluators.projectId],
    references: [projects.id]
  }),
  evaluatorSpanPaths: many(evaluatorSpanPaths),
}));

export const evaluatorSpanPathsRelations = relations(evaluatorSpanPaths, ({one}) => ({
  evaluator: one(evaluators, {
    fields: [evaluatorSpanPaths.evaluatorId],
    references: [evaluators.id]
  }),
  project: one(projects, {
    fields: [evaluatorSpanPaths.projectId],
    references: [projects.id]
  }),
}));

export const subscriptionTiersRelations = relations(subscriptionTiers, ({many}) => ({
  workspaces: many(workspaces),
}));

export const sharedPayloadsRelations = relations(sharedPayloads, ({one}) => ({
  project: one(projects, {
    fields: [sharedPayloads.projectId],
    references: [projects.id]
  }),
}));

export const playgroundsRelations = relations(playgrounds, ({one}) => ({
  project: one(projects, {
    fields: [playgrounds.projectId],
    references: [projects.id]
  }),
}));

export const evaluatorScoresRelations = relations(evaluatorScores, ({one}) => ({
  project: one(projects, {
    fields: [evaluatorScores.projectId],
    references: [projects.id]
  }),
}));

export const sqlTemplatesRelations = relations(sqlTemplates, ({one}) => ({
  project: one(projects, {
    fields: [sqlTemplates.projectId],
    references: [projects.id]
  }),
}));

export const dashboardChartsRelations = relations(dashboardCharts, ({one}) => ({
  project: one(projects, {
    fields: [dashboardCharts.projectId],
    references: [projects.id]
  }),
}));

export const tracesAgentChatsRelations = relations(tracesAgentChats, ({one}) => ({
  project: one(projects, {
    fields: [tracesAgentChats.projectId],
    references: [projects.id]
  }),
}));

export const tracesAgentMessagesRelations = relations(tracesAgentMessages, ({one}) => ({
  project: one(projects, {
    fields: [tracesAgentMessages.projectId],
    references: [projects.id]
  }),
}));

export const sharedTracesRelations = relations(sharedTraces, ({one}) => ({
  project: one(projects, {
    fields: [sharedTraces.projectId],
    references: [projects.id]
  }),
}));

export const semanticEventTriggerSpansRelations = relations(semanticEventTriggerSpans, ({one}) => ({
  semanticEventDefinition: one(semanticEventDefinitions, {
    fields: [semanticEventTriggerSpans.projectId],
    references: [semanticEventDefinitions.id]
  }),
}));

export const semanticEventDefinitionsRelations = relations(semanticEventDefinitions, ({one, many}) => ({
  semanticEventTriggerSpans: many(semanticEventTriggerSpans),
  project: one(projects, {
    fields: [semanticEventDefinitions.projectId],
    references: [projects.id]
  }),
}));

export const tagClassesRelations = relations(tagClasses, ({one}) => ({
  project: one(projects, {
    fields: [tagClasses.projectId],
    references: [projects.id]
  }),
}));

export const clustersRelations = relations(clusters, ({one}) => ({
  project: one(projects, {
    fields: [clusters.projectId],
    references: [projects.id]
  }),
}));

export const tracesRelations = relations(traces, ({one}) => ({
  project: one(projects, {
    fields: [traces.projectId],
    references: [projects.id]
  }),
}));

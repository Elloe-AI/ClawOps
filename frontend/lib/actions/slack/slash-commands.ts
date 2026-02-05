import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { SlackSlashCommandSchema } from "@/lib/actions/slack/types";
import { db } from "@/lib/db/drizzle";
import { eventDefinitions, slackChannelToEvents, slackIntegrations } from "@/lib/db/migrations/schema";

interface SlackCommandResponse {
  response_type: "ephemeral" | "in_channel";
  text?: string;
  blocks?: unknown[];
}

const availableEvents = ["error_trace_analysis", "warning_trace_analysis"];
const PRIMARY_COMMAND = "/clawops";
const LEGACY_COMMAND = "/hipocap";
const SUPPORTED_COMMANDS = [PRIMARY_COMMAND, LEGACY_COMMAND];

export async function processSlashCommand(
  payload: z.infer<typeof SlackSlashCommandSchema>
): Promise<SlackCommandResponse> {
  const { command, text, team_id, channel_id } = SlackSlashCommandSchema.parse(payload);

  if (!SUPPORTED_COMMANDS.includes(command)) {
    return {
      response_type: "ephemeral",
      text: "Unknown command. Please use `/clawops subscribe <event_name>` or `/clawops unsubscribe [event_name]`.",
    };
  }

  const args = text.trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase();

  if (subcommand === "help" || !subcommand) {
    return {
      response_type: "ephemeral",
      text: "📚 *ClawOps Slack Commands*\n\n• `/clawops subscribe <event_name>` - Subscribe this channel to an event\n• `/clawops unsubscribe [event_name]` - Unsubscribe from an event (or all events if no name provided)\n• `/clawops help` - Show this help message",
    };
  }

  if (subcommand === "subscribe") {
    const eventName = args.slice(1).join(" ").trim();

    if (!eventName) {
      return {
        response_type: "ephemeral",
        text: "❌ Please provide an event name. Usage: `/clawops subscribe <event_name>`",
      };
    }

    return await handleSubscribeCommand(team_id, channel_id, eventName);
  }

  if (subcommand === "unsubscribe") {
    const eventName = args.slice(1).join(" ").trim();
    return await handleUnsubscribeCommand(team_id, channel_id, eventName || null);
  }

  return {
    response_type: "ephemeral",
    text: `❌ Unknown subcommand: \`${subcommand}\`\n\nUse \`/clawops help\` to see available commands.`,
  };
}

async function handleSubscribeCommand(
  teamId: string,
  channelId: string,
  eventName: string
): Promise<SlackCommandResponse> {
  try {
    const integration = await db.query.slackIntegrations.findFirst({
      where: eq(slackIntegrations.teamId, teamId),
      columns: {
        id: true,
        projectId: true,
      },
    });

    if (!integration) {
      return {
        response_type: "ephemeral",
        text: "❌ ClawOps is not connected to this workspace. Please install the ClawOps app first.",
      };
    }

    const dbEvents = (
      await db.query.eventDefinitions.findMany({
        where: eq(eventDefinitions.projectId, integration.projectId),
        columns: { name: true },
      })
    ).map((event) => event.name);

    if (![...availableEvents, ...dbEvents].includes(eventName)) {
      return {
        response_type: "ephemeral",
        text: `❌ Event \`${eventName}\` not found.`,
      };
    }

    await db
      .insert(slackChannelToEvents)
      .values({
        integrationId: integration.id,
        projectId: integration.projectId,
        channelId,
        eventName,
      })
      .onConflictDoNothing();

    return {
      response_type: "in_channel",
      text: `✅ Successfully subscribed to event \`${eventName}\`!\n\nThis channel will receive notifications when this event is triggered.`,
    };
  } catch (error) {
    console.error("Error handling subscribe command:", error);
    return {
      response_type: "ephemeral",
      text: "❌ An error occurred while processing your request. Please try again later.",
    };
  }
}

async function handleUnsubscribeCommand(
  teamId: string,
  channelId: string,
  eventName: string | null
): Promise<SlackCommandResponse> {
  try {
    const integration = await db.query.slackIntegrations.findFirst({
      where: eq(slackIntegrations.teamId, teamId),
      columns: {
        id: true,
      },
    });

    if (!integration) {
      return {
        response_type: "ephemeral",
        text: "❌ ClawOps is not connected to this workspace. Please install the ClawOps app first.",
      };
    }

    if (eventName) {
      await db
        .delete(slackChannelToEvents)
        .where(
          and(
            eq(slackChannelToEvents.integrationId, integration.id),
            eq(slackChannelToEvents.channelId, channelId),
            eq(slackChannelToEvents.eventName, eventName)
          )
        );

      return {
        response_type: "in_channel",
        text: `✅ Successfully unsubscribed from event \`${eventName}\`.`,
      };
    } else {
      await db
        .delete(slackChannelToEvents)
        .where(
          and(eq(slackChannelToEvents.integrationId, integration.id), eq(slackChannelToEvents.channelId, channelId))
        )
        .returning();

      return {
        response_type: "in_channel",
        text: `✅ Successfully unsubscribed from events.`,
      };
    }
  } catch (error) {
    console.error("Error handling unsubscribe command:", error);
    return {
      response_type: "ephemeral",
      text: "❌ An error occurred while processing your request. Please try again later.",
    };
  }
}

CREATE TYPE "public"."agent_channel" AS ENUM('telegram', 'discord', 'whatsapp', 'sms');--> statement-breakpoint
CREATE TYPE "public"."agent_operational_status" AS ENUM('running', 'paused', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."agent_activity_type" AS ENUM('user_message_received', 'agent_response_sent', 'agent_response_blocked', 'guardrail_triggered', 'agent_paused_auto', 'agent_paused_manual', 'agent_resumed', 'agent_connected');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"channel" "agent_channel" NOT NULL,
	"external_bot_id" text NOT NULL,
	"status" "agent_operational_status" DEFAULT 'running' NOT NULL,
	"risk_score" real DEFAULT '0' NOT NULL,
	"last_activity_at" timestamptz,
	"paused_at" timestamptz,
	"pause_reason" text,
	"guardrails_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"channel_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "agents_project_channel_bot_unique" UNIQUE("project_id","channel","external_bot_id")
);
--> statement-breakpoint
CREATE TABLE "agent_activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"trace_id" uuid,
	"event_type" "agent_activity_type" NOT NULL,
	"summary" text,
	"reason" text,
	"action" text,
	"details" jsonb,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_activity_events" ADD CONSTRAINT "agent_activity_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_activity_events" ADD CONSTRAINT "agent_activity_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_activity_events" ADD CONSTRAINT "agent_activity_events_trace_id_fkey" FOREIGN KEY ("trace_id","project_id") REFERENCES "public"."traces"("id","project_id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "agents_project_id_idx" ON "agents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agents_status_idx" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_activity_agent_id_created_at_idx" ON "agent_activity_events" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_activity_project_id_idx" ON "agent_activity_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_activity_type_idx" ON "agent_activity_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "agent_activity_trace_id_idx" ON "agent_activity_events" USING btree ("trace_id");

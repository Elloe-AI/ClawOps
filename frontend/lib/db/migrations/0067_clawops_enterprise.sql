CREATE TYPE "public"."agent_connection_status" AS ENUM('configured', 'connected', 'inactive');
--> statement-breakpoint
CREATE TYPE "public"."agent_environment" AS ENUM('local', 'staging', 'prod');
--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'denied', 'expired');
--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('open', 'resolved');
--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('blocked_response', 'guardrail_triggered', 'auto_paused', 'manual_paused', 'approval_requested', 'approval_completed', 'runtime_disconnected');
--> statement-breakpoint
CREATE TYPE "public"."compliance_mode" AS ENUM('general', 'regulated');
--> statement-breakpoint
ALTER TYPE "public"."workspace_role" ADD VALUE 'viewer';
--> statement-breakpoint
ALTER TYPE "public"."workspace_role" ADD VALUE 'operator';
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "compliance_mode" "compliance_mode" DEFAULT 'general' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "environment" "agent_environment" DEFAULT 'prod' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "connection_status" "agent_connection_status" DEFAULT 'configured' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "last_heartbeat_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "partner_id" text;
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "runtime_type" text;
--> statement-breakpoint
ALTER TABLE "agent_activity_events" ADD COLUMN "environment" "agent_environment";
--> statement-breakpoint
ALTER TABLE "agent_activity_events" ADD COLUMN "partner_id" text;
--> statement-breakpoint
ALTER TABLE "agent_activity_events" ADD COLUMN "runtime_type" text;
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"trace_id" uuid,
	"incident_type" "incident_type" NOT NULL,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"category" text,
	"summary" text,
	"reason" text,
	"action" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"resolved_at" timestamptz
);
--> statement-breakpoint
CREATE TABLE "agent_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"request_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requested_by" uuid,
	"approved_by" uuid,
	"requested_at" timestamptz DEFAULT now() NOT NULL,
	"responded_at" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"workspace_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"guardrails_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"threat_protection_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamptz,
	"checksum" text NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_template_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"applied_by" uuid,
	"applied_at" timestamptz DEFAULT now() NOT NULL,
	"previous_guardrails_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"previous_threat_protection_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"new_guardrails_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"new_threat_protection_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reverted_at" timestamptz,
	"reverted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "readiness_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."agent_activity_events"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "public"."traces"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "safety_templates" ADD CONSTRAINT "safety_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "safety_templates" ADD CONSTRAINT "safety_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "safety_templates" ADD CONSTRAINT "safety_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "safety_template_applications" ADD CONSTRAINT "safety_template_applications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "safety_template_applications" ADD CONSTRAINT "safety_template_applications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."safety_templates"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "safety_template_applications" ADD CONSTRAINT "safety_template_applications_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "safety_template_applications" ADD CONSTRAINT "safety_template_applications_reverted_by_fkey" FOREIGN KEY ("reverted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "incidents_project_id_idx" ON "incidents" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "incidents_agent_id_idx" ON "incidents" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "agent_approvals_project_id_idx" ON "agent_approvals" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "agent_approvals_status_idx" ON "agent_approvals" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "audit_log_entries_project_id_idx" ON "audit_log_entries" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "audit_log_entries_workspace_id_idx" ON "audit_log_entries" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "safety_templates_project_id_idx" ON "safety_templates" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "safety_templates_visibility_idx" ON "safety_templates" USING btree ("visibility");
--> statement-breakpoint
CREATE INDEX "safety_template_applications_project_id_idx" ON "safety_template_applications" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "readiness_checks_name_idx" ON "readiness_checks" USING btree ("name");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clawops_prevent_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Append-only table: %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER clawops_no_mutation_agent_activity_events
  BEFORE UPDATE OR DELETE ON "agent_activity_events"
  FOR EACH ROW EXECUTE FUNCTION clawops_prevent_mutation();
--> statement-breakpoint
CREATE TRIGGER clawops_no_mutation_incidents
  BEFORE UPDATE OR DELETE ON "incidents"
  FOR EACH ROW EXECUTE FUNCTION clawops_prevent_mutation();
--> statement-breakpoint
CREATE TRIGGER clawops_no_mutation_audit_log_entries
  BEFORE UPDATE OR DELETE ON "audit_log_entries"
  FOR EACH ROW EXECUTE FUNCTION clawops_prevent_mutation();
--> statement-breakpoint
CREATE TRIGGER clawops_no_mutation_product_events
  BEFORE UPDATE OR DELETE ON "product_events"
  FOR EACH ROW EXECUTE FUNCTION clawops_prevent_mutation();
--> statement-breakpoint
CREATE TRIGGER clawops_no_mutation_safety_template_applications
  BEFORE UPDATE OR DELETE ON "safety_template_applications"
  FOR EACH ROW EXECUTE FUNCTION clawops_prevent_mutation();

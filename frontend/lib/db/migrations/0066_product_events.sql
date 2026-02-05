CREATE TABLE "product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"user_id" uuid,
	"project_id" uuid,
	"agent_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "product_events_name_idx" ON "product_events" USING btree ("name");--> statement-breakpoint
CREATE INDEX "product_events_created_at_idx" ON "product_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "product_events_project_id_idx" ON "product_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "product_events_user_id_idx" ON "product_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "product_events_agent_id_idx" ON "product_events" USING btree ("agent_id");

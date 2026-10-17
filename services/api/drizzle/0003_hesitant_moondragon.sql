CREATE TYPE "public"."calendar_status" AS ENUM('sincronizada', 'pendiente', 'no_configurada', 'cancelada');--> statement-breakpoint
ALTER TYPE "public"."meeting_status" ADD VALUE 'rechazada';--> statement-breakpoint
ALTER TYPE "public"."meeting_status" ADD VALUE 'cancelada';--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppressions_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "meetings" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "revisit_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "attendees" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "proposed_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "decision_note" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "calendar_event_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "calendar_status" "calendar_status";--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "calendar_link" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "meet_link" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meetings_lead_idx" ON "meetings" USING btree ("lead_id");
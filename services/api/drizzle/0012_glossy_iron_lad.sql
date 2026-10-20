CREATE TYPE "public"."brief_status" AS ENUM('borrador', 'en_revision', 'aprobado');--> statement-breakpoint
CREATE TYPE "public"."piece_status" AS ENUM('borrador', 'en_revision', 'aprobada', 'publicada', 'pausada');--> statement-breakpoint
CREATE TABLE "campaign_personas" (
	"campaign_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_pieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"network" text NOT NULL,
	"format" text NOT NULL,
	"copy" text NOT NULL,
	"asset_url" text,
	"status" "piece_status" DEFAULT 'borrador' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "objective" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "cta" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "constraints" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "kpis" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "budget_cents" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "networks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "brief_status" "brief_status" DEFAULT 'borrador' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "brief_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaign_personas" ADD CONSTRAINT "campaign_personas_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_personas" ADD CONSTRAINT "campaign_personas_persona_id_buyer_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."buyer_personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_pieces" ADD CONSTRAINT "campaign_pieces_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_personas_uq" ON "campaign_personas" USING btree ("campaign_id","persona_id");--> statement-breakpoint
CREATE INDEX "campaign_pieces_campaign_idx" ON "campaign_pieces" USING btree ("campaign_id");
CREATE TYPE "public"."article_status" AS ENUM('borrador', 'en_revision', 'publicado');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('borrador', 'activa', 'pausada', 'cerrada');--> statement-breakpoint
CREATE TYPE "public"."persona_status" AS ENUM('activo', 'pausado');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"case_ref" text,
	"langs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "article_status" DEFAULT 'borrador' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "landing_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"title" text NOT NULL,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"persona_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"note" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buyer_personas" ADD COLUMN "service" text;--> statement-breakpoint
ALTER TABLE "buyer_personas" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "buyer_personas" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "buyer_personas" ADD COLUMN "status" "persona_status" DEFAULT 'activo' NOT NULL;--> statement-breakpoint
ALTER TABLE "buyer_personas" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "buyer_personas" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "service" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "status" "campaign_status" DEFAULT 'borrador' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_contacts" ADD CONSTRAINT "persona_contacts_persona_id_buyer_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."buyer_personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "persona_contacts_persona_idx" ON "persona_contacts" USING btree ("persona_id");--> statement-breakpoint
CREATE INDEX "persona_contacts_at_idx" ON "persona_contacts" USING btree ("occurred_at");
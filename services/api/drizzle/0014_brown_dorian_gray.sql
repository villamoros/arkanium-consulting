CREATE TYPE "public"."channel_kind" AS ENUM('red_social', 'newsletter', 'landing', 'anuncio_pagado');--> statement-breakpoint
CREATE TABLE "campaign_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"kind" "channel_kind" NOT NULL,
	"platform" text NOT NULL,
	"budget_cents" integer,
	"starts_on" date,
	"ends_on" date,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "campaign_channels" ADD CONSTRAINT "campaign_channels_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_channels_campaign_idx" ON "campaign_channels" USING btree ("campaign_id");
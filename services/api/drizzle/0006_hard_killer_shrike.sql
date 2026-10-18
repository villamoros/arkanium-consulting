CREATE TYPE "public"."proposal_price_status" AS ENUM('por_confirmar', 'confirmado');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('borrador', 'en_aprobacion', 'enviada', 'aceptada', 'rechazada');--> statement-breakpoint
CREATE TABLE "proposal_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"summary" text NOT NULL,
	"price_status" "proposal_price_status" DEFAULT 'por_confirmar' NOT NULL,
	"price_cents" integer,
	"price_note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"lead_id" uuid,
	"title" text NOT NULL,
	"service_family" "service_family" DEFAULT 'unknown' NOT NULL,
	"template_code" text NOT NULL,
	"status" "proposal_status" DEFAULT 'borrador' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_versions_unique_idx" ON "proposal_versions" USING btree ("proposal_id","version");--> statement-breakpoint
CREATE INDEX "proposals_organization_idx" ON "proposals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "proposals_lead_idx" ON "proposals" USING btree ("lead_id");
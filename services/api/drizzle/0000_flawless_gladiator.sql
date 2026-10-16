CREATE TYPE "public"."approval_status" AS ENUM('pendiente', 'aprobada', 'devuelta', 'rechazada');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('nuevo', 'calificado', 'pospuesto', 'descartado', 'convertido');--> statement-breakpoint
CREATE TYPE "public"."organization_kind" AS ENUM('internal', 'client');--> statement-breakpoint
CREATE TYPE "public"."service_family" AS ENUM('architecture', 'strategy', 'product', 'unknown');--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"proposed_by" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "approval_status" DEFAULT 'pendiente' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buyer_personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"segment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"buyer_persona_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"lead_id" uuid,
	"organization_id" uuid,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"priority_choice" text NOT NULL,
	"context" text,
	"locale" text NOT NULL,
	"source" text DEFAULT 'website' NOT NULL,
	"campaign_id" uuid,
	"buyer_persona_id" uuid,
	"status" "lead_status" DEFAULT 'nuevo' NOT NULL,
	"proposed_family" "service_family" DEFAULT 'unknown',
	"proposed_reason" text,
	"decision_note" text,
	"organization_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text,
	"name" text NOT NULL,
	"kind" "organization_kind" DEFAULT 'client' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_buyer_persona_id_buyer_personas_id_fk" FOREIGN KEY ("buyer_persona_id") REFERENCES "public"."buyer_personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_buyer_persona_id_buyer_personas_id_fk" FOREIGN KEY ("buyer_persona_id") REFERENCES "public"."buyer_personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_status_idx" ON "approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_log_subject_idx" ON "audit_log" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "contacts_organization_idx" ON "contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_received_at_idx" ON "leads" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_clerk_org_id_uq" ON "organizations" USING btree ("clerk_org_id");
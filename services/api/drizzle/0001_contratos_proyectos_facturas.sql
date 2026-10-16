CREATE TYPE "public"."correction_status" AS ENUM('abierta', 'resuelta');--> statement-breakpoint
CREATE TYPE "public"."deliverable_status" AS ENUM('en_revision', 'publicado', 'con_correcciones', 'aprobado');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('borrador', 'enviada', 'pagada', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('solicitada', 'confirmada', 'realizada');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('pendiente', 'en_curso', 'completado');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."project_phase" AS ENUM('evaluar', 'arquitectar', 'modernizar', 'escalar');--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"text" text NOT NULL,
	"status" "correction_status" DEFAULT 'abierta' NOT NULL,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"kind" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"text" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_role" text NOT NULL,
	"document_sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "deliverable_status" DEFAULT 'en_revision' NOT NULL,
	"file_name" text,
	"mime_type" text,
	"content" "bytea",
	"content_sha256" text,
	"published_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"number" text NOT NULL,
	"concept" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"due_days" integer DEFAULT 30 NOT NULL,
	"status" "invoice_status" DEFAULT 'borrador' NOT NULL,
	"stripe_invoice_id" text,
	"hosted_url" text,
	"issued_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"topic" text NOT NULL,
	"status" "meeting_status" DEFAULT 'solicitada' NOT NULL,
	"requested_by" text NOT NULL,
	"preferred_windows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"minutes_text" text,
	"minutes_published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "milestone_status" DEFAULT 'pendiente' NOT NULL,
	"planned_date" timestamp with time zone,
	"date_changed_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"service_family" "service_family" DEFAULT 'unknown' NOT NULL,
	"phase" "project_phase" DEFAULT 'evaluar' NOT NULL,
	"progress" text DEFAULT '' NOT NULL,
	"next_step" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "status" "organization_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_email" text;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "corrections_deliverable_idx" ON "corrections" USING btree ("deliverable_id");--> statement-breakpoint
CREATE INDEX "decisions_organization_idx" ON "decisions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "deliverables_project_idx" ON "deliverables" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_uq" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "invoices_organization_idx" ON "invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "meetings_organization_idx" ON "meetings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "milestones_project_idx" ON "milestones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_organization_idx" ON "projects" USING btree ("organization_id");
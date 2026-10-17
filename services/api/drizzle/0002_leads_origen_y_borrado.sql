ALTER TABLE "leads" ADD COLUMN "source_reference" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "deleted_at" timestamp with time zone;
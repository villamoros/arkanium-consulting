ALTER TABLE "leads" ADD COLUMN "consent_text_version" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "consent_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "notify_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "notify_last_error" text;
--> statement-breakpoint
-- Leads anteriores al aviso automático: ya están tratados, no se vuelven a notificar.
UPDATE "leads" SET "notified_at" = "received_at" WHERE "notified_at" IS NULL;

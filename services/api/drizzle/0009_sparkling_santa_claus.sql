CREATE TYPE "public"."agent_department" AS ENUM('arquitectura', 'estrategia', 'producto');--> statement-breakpoint
CREATE TYPE "public"."agent_operation" AS ENUM('sin_operacion', 'operando');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('definido', 'activo', 'pausado');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"service" text NOT NULL,
	"department" "agent_department" NOT NULL,
	"status" "agent_status" DEFAULT 'definido' NOT NULL,
	"operation" "agent_operation" DEFAULT 'sin_operacion' NOT NULL,
	"pause_reason" text,
	"paused_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "emergency_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"reason" text,
	"changed_by" text,
	"changed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agents_code_uq" ON "agents" USING btree ("code");
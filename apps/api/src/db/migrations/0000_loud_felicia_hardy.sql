CREATE TYPE "public"."game_mode" AS ENUM('rush', 'story', 'sorting');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."wish_category" AS ENUM('love', 'money', 'exam', 'ticket', 'health', 'revenge', 'absurd');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"model" varchar(64) NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nickname" varchar(16) NOT NULL,
	"mode" "game_mode" NOT NULL,
	"score" integer NOT NULL,
	"wishes_handled" integer NOT NULL,
	"peak_fatigue" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" varchar(200) NOT NULL,
	"category" "wish_category" NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"auto_flags" jsonb DEFAULT '{"rules":[],"llm":null}'::jsonb NOT NULL,
	"resolutions" jsonb,
	"moderation_note" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scores_mode_score_idx" ON "scores" USING btree ("mode","score");--> statement-breakpoint
CREATE INDEX "submissions_status_created_idx" ON "submissions" USING btree ("status","created_at");
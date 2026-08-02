CREATE TYPE "public"."deity_domain" AS ENUM('yuelao', 'caishen', 'wenchang', 'zhusheng', 'chenghuang', 'nobody');--> statement-breakpoint
CREATE TYPE "public"."wish_pool_type" AS ENUM('official', 'story');--> statement-breakpoint
CREATE TABLE "wish_bank" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" varchar(64) NOT NULL,
	"category" "wish_category" NOT NULL,
	"domain" "deity_domain" NOT NULL,
	"text" varchar(140) NOT NULL,
	"intensity" smallint NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolutions" jsonb NOT NULL,
	"follow_up" varchar(64),
	"pool_type" "wish_pool_type" DEFAULT 'official' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wish_bank_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE INDEX "wish_bank_pool_active_idx" ON "wish_bank" USING btree ("pool_type","active");--> statement-breakpoint
CREATE INDEX "wish_bank_category_active_idx" ON "wish_bank" USING btree ("category","active");
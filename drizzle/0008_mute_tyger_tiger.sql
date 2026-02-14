CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "services_translations_alias" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "services_translations" DROP COLUMN "tags";
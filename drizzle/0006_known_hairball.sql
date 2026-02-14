CREATE TABLE "services_translations" (
	"id" integer PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"language_code" varchar(2) NOT NULL,
	"name" varchar(255),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "services_translations" ADD CONSTRAINT "services_translations_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "descriptionEn";--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "descriptionPl";--> statement-breakpoint
-- ALTER TABLE "services" DROP COLUMN "default_name";
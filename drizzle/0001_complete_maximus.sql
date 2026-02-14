-- ALTER TABLE "services" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "tags" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "descriptionEn" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "descriptionPl" text;--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "default_name";
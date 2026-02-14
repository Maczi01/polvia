CREATE TYPE "public"."category" AS ENUM('others', 'education', 'renovation', 'financial', 'beauty', 'grocery', 'transport', 'law', 'mechanics', 'health');--> statement-breakpoint
CREATE TYPE "public"."county" AS ENUM('Antrim', 'Armagh', 'Derry', 'Down', 'Fermanagh', 'Tyrone', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway', 'Kerry', 'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon', 'Sligo', 'Tipperary', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow');--> statement-breakpoint
CREATE TABLE "promoted_services" (
	"service_id" integer PRIMARY KEY NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_engagements" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"language" varchar(5) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"category" "category" NOT NULL,
	"city" varchar(255),
	"street" varchar(255),
	"county" "county",
	"postcode" varchar(20),
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"openingHours" text NOT NULL,
	"phoneNumber" varchar(50),
	"email" varchar(255),
	"webpage" varchar(255),
	"part" varchar(255),
	"image" varchar(255),
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"embedding" vector(1536),
	"default_name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "tag_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_id" integer NOT NULL,
	"language" varchar(5) NOT NULL,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promoted_services" ADD CONSTRAINT "promoted_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_engagements" ADD CONSTRAINT "service_engagements_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_translations" ADD CONSTRAINT "service_translations_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_translations" ADD CONSTRAINT "tag_translations_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
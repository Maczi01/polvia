CREATE TABLE "service_tags" (
	"service_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "service_tags_service_id_tag_id_pk" PRIMARY KEY("service_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "service_tags" ADD CONSTRAINT "service_tags_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tags" ADD CONSTRAINT "service_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
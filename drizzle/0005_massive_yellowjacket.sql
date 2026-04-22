CREATE TABLE "story_insights" (
	"story_id" integer PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"manuscript_hash" text NOT NULL,
	"model" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "preferred_model" text;--> statement-breakpoint
ALTER TABLE "story_insights" ADD CONSTRAINT "story_insights_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;
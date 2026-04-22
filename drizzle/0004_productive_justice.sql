ALTER TABLE "folders" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Backfill: assign sort_order within each (user_id, parent_path) bucket
-- in alphabetical order, spaced by 10 to leave room for inserts.
WITH numbered AS (
  SELECT "id",
    ROW_NUMBER() OVER (
      PARTITION BY "user_id", CASE
        WHEN "path" LIKE '%/%' THEN regexp_replace("path", '/[^/]+$', '')
        ELSE ''
      END
      ORDER BY "path"
    ) * 10 AS rn
  FROM "folders"
)
UPDATE "folders" f
SET "sort_order" = n.rn
FROM numbered n
WHERE f."id" = n."id";

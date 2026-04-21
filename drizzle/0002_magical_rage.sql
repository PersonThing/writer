ALTER TABLE "files" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Seed sort_order for existing rows: each user gets their files
-- numbered alphabetically by path so we don't start with a giant
-- equal-sort-order pile. New rows keep the default 0 until the
-- client reorders.
WITH seeded AS (
  SELECT id, (row_number() OVER (PARTITION BY user_id ORDER BY path)) * 10 AS so
  FROM "files"
)
UPDATE "files" f SET "sort_order" = seeded.so
FROM seeded WHERE seeded.id = f.id;

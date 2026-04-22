-- Populate files.story_id for all chapters inside `_stories/<slug>/…`.
-- Previously only the special `_plot.md` and `_bible.md` files carried
-- the foreign key; real chapters were matched purely by path prefix.
UPDATE "files" AS f
SET "story_id" = s."id"
FROM "stories" AS s
WHERE f."story_id" IS NULL
  AND f."user_id" = s."user_id"
  AND f."path" LIKE '_stories/' || s."slug" || '/%';
--> statement-breakpoint
-- Remove the now-unused plot-board and bible files. The WYSIWYG editor
-- opens these as regular markdown which isn't the intent; the storylines
-- feature replaces them with a general nested folder tree.
DELETE FROM "files"
WHERE "path" LIKE '_stories/%/_plot.md'
   OR "path" LIKE '_stories/%/_bible.md';

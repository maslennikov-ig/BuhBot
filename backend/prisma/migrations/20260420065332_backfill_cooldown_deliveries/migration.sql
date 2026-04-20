-- Backfill existing cooldown-blocked deliveries that were mis-classified as 'failed'.
-- See buh-lmw2 / survey.worker.ts cooldown gate (gh-292).
UPDATE "public"."survey_deliveries"
SET "status" = 'skipped'
WHERE "status" = 'failed'
  AND "skip_reason" LIKE 'cooldown:%';

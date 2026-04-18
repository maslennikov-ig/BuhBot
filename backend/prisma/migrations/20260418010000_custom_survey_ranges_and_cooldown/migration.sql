-- gh-292: Custom survey date ranges + per-chat cooldown policy.
--
-- Additive migration. No destructive drops (only `DROP NOT NULL` on quarter).
-- Backfills existing rows so legacy quarter-only surveys still work post-deploy.
--
-- Touched by:
--   * backend/src/services/feedback/survey.service.ts (createCampaign, canSendSurveyToChat)
--   * backend/src/queues/survey.worker.ts (cooldown gate + lastSurveySentAt write)
--   * backend/src/api/trpc/routers/survey.ts (discriminatedUnion create + getCooldownStatus)

BEGIN;

-- 1. FeedbackSurvey: add explicit reporting-period columns and loosen `quarter` to nullable.
ALTER TABLE "public"."feedback_surveys"
  ADD COLUMN "start_date" TIMESTAMPTZ(6),
  ADD COLUMN "end_date"   TIMESTAMPTZ(6);

-- Backfill legacy rows from existing scheduled_at / expires_at.
-- For quarter-mode rows these columns approximate the reporting period closely enough
-- for UI display; new range-mode rows always populate start_date/end_date explicitly.
UPDATE "public"."feedback_surveys"
SET "start_date" = "scheduled_at",
    "end_date"   = "expires_at"
WHERE "start_date" IS NULL;

-- Make quarter nullable now that range-mode surveys don't need it.
ALTER TABLE "public"."feedback_surveys"
  ALTER COLUMN "quarter" DROP NOT NULL;

CREATE INDEX "feedback_surveys_start_end_idx"
  ON "public"."feedback_surveys" ("start_date", "end_date");

-- 2. SurveyDelivery: add skip_reason for cooldown-blocked deliveries.
-- When a delivery is skipped (status='failed' + skipReason='cooldown: ...'),
-- the worker RETURNS without throwing — BullMQ does NOT retry.
ALTER TABLE "public"."survey_deliveries"
  ADD COLUMN "skip_reason" TEXT;

-- 3. Chat: add last_survey_sent_at for cooldown enforcement.
ALTER TABLE "public"."chats"
  ADD COLUMN "last_survey_sent_at" TIMESTAMPTZ(6);

CREATE INDEX "chats_last_survey_sent_at_idx"
  ON "public"."chats" ("last_survey_sent_at");

-- Backfill last_survey_sent_at from the most recent delivered timestamp
-- so the cooldown gate behaves correctly on day 1 (prevents re-spamming chats
-- that were surveyed just before deploy).
UPDATE "public"."chats" c
SET "last_survey_sent_at" = sub.max_delivered_at
FROM (
  SELECT "chat_id", MAX("delivered_at") AS max_delivered_at
  FROM "public"."survey_deliveries"
  WHERE "delivered_at" IS NOT NULL
  GROUP BY "chat_id"
) sub
WHERE c.id = sub.chat_id;

-- 4. GlobalSettings: cooldown + max-range knobs. Non-null with sensible defaults
-- so existing rows (there is only `id='default'`) get the defaults on ALTER.
ALTER TABLE "public"."global_settings"
  ADD COLUMN "survey_cooldown_hours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "survey_max_range_days" INTEGER NOT NULL DEFAULT 90;

COMMIT;

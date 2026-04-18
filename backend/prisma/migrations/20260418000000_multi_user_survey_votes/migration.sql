-- gh-294: Multi-user survey voting with vote changes and audit history.
-- Introduces survey_votes (one row per delivery+telegram user) and
-- survey_vote_history (append-only audit trail). The legacy
-- feedback_responses table is intentionally left intact for back-compat —
-- new write paths go through survey_votes instead of feedback_responses.

-- 1. Enums ------------------------------------------------------------------
-- State of a single vote. `removed` rows are preserved but excluded from
-- aggregates; effective vote per (delivery, user) = latest state='active'.
CREATE TYPE "public"."SurveyVoteState" AS ENUM ('active', 'removed');

-- Transition types for the audit log. `update` is emitted both for
-- rating changes on an existing active vote and for flipping `removed`
-- back to `active`.
CREATE TYPE "public"."SurveyVoteAction" AS ENUM ('create', 'update', 'remove');

-- 2. survey_votes ------------------------------------------------------------
CREATE TABLE "public"."survey_votes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "delivery_id" UUID NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "username" VARCHAR(100),
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "state" "public"."SurveyVoteState" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_votes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "survey_votes_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

-- Composite unique index is the concurrency anchor: Prisma upserts on
-- (delivery_id, telegram_user_id) so 10 concurrent submitVote calls for the
-- same user collapse to exactly one row.
CREATE UNIQUE INDEX "survey_votes_delivery_user_unique"
    ON "public"."survey_votes" ("delivery_id", "telegram_user_id");

CREATE INDEX "survey_votes_delivery_id_idx"
    ON "public"."survey_votes" ("delivery_id");

CREATE INDEX "survey_votes_telegram_user_id_idx"
    ON "public"."survey_votes" ("telegram_user_id");

ALTER TABLE "public"."survey_votes"
    ADD CONSTRAINT "survey_votes_delivery_id_fkey"
    FOREIGN KEY ("delivery_id")
    REFERENCES "public"."survey_deliveries" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. survey_vote_history ----------------------------------------------------
-- Append-only log. Rows are created inside the same transaction as the
-- corresponding survey_votes upsert so history and current state never drift.
CREATE TABLE "public"."survey_vote_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vote_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "username" VARCHAR(100),
    "action" "public"."SurveyVoteAction" NOT NULL,
    "old_rating" INTEGER,
    "new_rating" INTEGER,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_vote_history_pkey" PRIMARY KEY ("id")
);

-- (delivery_id, changed_at) index matches the drill-down query used by
-- the manager UI: fetch all history rows for a given delivery ordered by
-- time.
CREATE INDEX "survey_vote_history_delivery_changed_at_idx"
    ON "public"."survey_vote_history" ("delivery_id", "changed_at");

CREATE INDEX "survey_vote_history_vote_id_idx"
    ON "public"."survey_vote_history" ("vote_id");

ALTER TABLE "public"."survey_vote_history"
    ADD CONSTRAINT "survey_vote_history_vote_id_fkey"
    FOREIGN KEY ("vote_id")
    REFERENCES "public"."survey_votes" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

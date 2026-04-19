-- gh-313: Targeted survey audience selection.
--
-- Additive migration. No destructive drops. Adds:
--   * SurveyAudienceType enum (all | specific_chats | segments)
--   * FeedbackSurvey columns: audience_type, audience_chat_ids[], audience_segment_ids[]
--   * ChatSegment + ChatSegmentMember tables (M:N owner→chat join)
--
-- All existing surveys are backfilled with audience_type='all', preserving the
-- historical "blast every active client" behavior.
--
-- Touched by:
--   * backend/src/services/feedback/survey.service.ts (createCampaign accepts audience)
--   * backend/src/services/feedback/segment.service.ts (CRUD + membership)
--   * backend/src/api/trpc/routers/survey.ts (discriminatedUnion create + audience)
--   * backend/src/api/trpc/routers/segment.ts (segment CRUD + membership)

BEGIN;

-- 1. SurveyAudienceType enum.
CREATE TYPE "public"."SurveyAudienceType" AS ENUM ('all', 'specific_chats', 'segments');

-- 2. FeedbackSurvey: add audience selector columns with safe defaults so legacy
--    rows continue to behave like the old "all active clients" rule.
ALTER TABLE "public"."feedback_surveys"
  ADD COLUMN "audience_type"        "public"."SurveyAudienceType" NOT NULL DEFAULT 'all',
  ADD COLUMN "audience_chat_ids"    BIGINT[]                       NOT NULL DEFAULT ARRAY[]::BIGINT[],
  ADD COLUMN "audience_segment_ids" UUID[]                         NOT NULL DEFAULT ARRAY[]::UUID[];

CREATE INDEX "feedback_surveys_audience_type_idx"
  ON "public"."feedback_surveys" ("audience_type");

-- 3. chat_segments: reusable named groups owned by a manager/admin.
--    Uniqueness on (created_by_id, name) lets each owner reuse names independently.
CREATE TABLE "public"."chat_segments" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"          TEXT         NOT NULL,
  "description"   TEXT,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" UUID         NOT NULL,

  CONSTRAINT "chat_segments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_segments_created_by_id_name_key"
  ON "public"."chat_segments" ("created_by_id", "name");
CREATE INDEX "chat_segments_created_by_id_idx"
  ON "public"."chat_segments" ("created_by_id");

ALTER TABLE "public"."chat_segments"
  ADD CONSTRAINT "chat_segments_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. chat_segment_members: M:N join rows. Cascade-deletes from BOTH parents so
--    we never leave dangling memberships when a segment or chat is hard-deleted.
CREATE TABLE "public"."chat_segment_members" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "segment_id"   UUID         NOT NULL,
  "chat_id"      BIGINT       NOT NULL,
  "added_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "added_by_id"  UUID         NOT NULL,

  CONSTRAINT "chat_segment_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_segment_members_segment_id_chat_id_key"
  ON "public"."chat_segment_members" ("segment_id", "chat_id");
CREATE INDEX "chat_segment_members_segment_id_idx"
  ON "public"."chat_segment_members" ("segment_id");
CREATE INDEX "chat_segment_members_chat_id_idx"
  ON "public"."chat_segment_members" ("chat_id");

ALTER TABLE "public"."chat_segment_members"
  ADD CONSTRAINT "chat_segment_members_segment_id_fkey"
  FOREIGN KEY ("segment_id") REFERENCES "public"."chat_segments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."chat_segment_members"
  ADD CONSTRAINT "chat_segment_members_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."chat_segment_members"
  ADD CONSTRAINT "chat_segment_members_added_by_id_fkey"
  FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT;

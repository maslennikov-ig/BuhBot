-- gh-290 follow-up: a second pass at backfilling sla_breached_at.
--
-- Migration 20260417000000_add_sla_breached_at backfilled rows where the
-- legacy sla_breached flag was already true. This pass catches the rows
-- that the live worker never flagged but which are demonstrably breached
-- by elapsed time:
--
--   * Answered breach (response_at IS NOT NULL):
--       response_at - received_at > sla_threshold → backfill breach moment
--       at received_at + sla_threshold (the precise instant the SLA crossed
--       the threshold).
--
--   * Unanswered breach (response_at IS NULL):
--       now() - received_at > sla_threshold → same synthesis,
--       received_at + sla_threshold. We do NOT use now() here because the
--       breach happened at the threshold crossing, not at the moment the
--       backfill runs.
--
-- The threshold per request is, in order of preference:
--   1. The chat's own sla_threshold_minutes (chats.sla_threshold_minutes).
--   2. 60 minutes (default in schema.prisma).
--
-- We deliberately do NOT use sla_working_minutes as the threshold because
-- stopSlaTimer (services/sla/timer.service.ts) overwrites that column with
-- the actual response time when an accountant answers, so it equals
-- (response_at - received_at) on answered rows. Using it would yield a
-- net-zero excess and re-introduce the same +0м display bug we are fixing.
--
-- Idempotent: only touches rows where sla_breached_at IS NULL. Safe to
-- replay in any environment.

UPDATE "public"."client_requests" cr
SET
  "sla_breached" = true,
  "sla_breached_at" = cr."received_at" + make_interval(
    mins => COALESCE(c."sla_threshold_minutes", 60)
  )
FROM "public"."chats" c
WHERE cr."chat_id" = c."id"
  AND cr."sla_breached_at" IS NULL
  AND (
    -- Answered breach: response landed AFTER threshold expired.
    (
      cr."response_at" IS NOT NULL
      AND cr."response_at" > cr."received_at" + make_interval(
        mins => COALESCE(c."sla_threshold_minutes", 60)
      )
    )
    OR
    -- Unanswered breach: still no response, threshold already expired.
    (
      cr."response_at" IS NULL
      AND now() > cr."received_at" + make_interval(
        mins => COALESCE(c."sla_threshold_minutes", 60)
      )
    )
  );

-- Fallback: orphan rows where the chat row is missing or soft-deleted.
-- We cannot join chats reliably, so we use the schema default of 60.
UPDATE "public"."client_requests" cr
SET
  "sla_breached" = true,
  "sla_breached_at" = cr."received_at" + make_interval(mins => 60)
WHERE cr."sla_breached_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "public"."chats" c WHERE c."id" = cr."chat_id"
  )
  AND (
    (
      cr."response_at" IS NOT NULL
      AND cr."response_at" > cr."received_at" + make_interval(mins => 60)
    )
    OR
    (
      cr."response_at" IS NULL
      AND now() > cr."received_at" + make_interval(mins => 60)
    )
  );

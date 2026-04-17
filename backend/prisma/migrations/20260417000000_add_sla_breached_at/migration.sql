-- gh-290: Persist the moment an SLA breach is recorded so the
-- /violations page can compute "time since receipt" even when the
-- request has no response yet (x = responseAt || slaBreachedAt || now).

-- 1. Nullable timestamp column. Nullable because not every ClientRequest
-- is breached; only breached rows receive a value when slaBreached flips
-- to true. The two real write-paths are
--   * backend/src/queues/sla-timer.worker.ts (processSlaTimer transaction)
--   * backend/src/services/sla/timer.service.ts (recoverPendingSlaTimers).
-- accountant.handler.ts only READS slaBreached in a findMany select clause.
ALTER TABLE "public"."client_requests"
  ADD COLUMN "sla_breached_at" TIMESTAMPTZ(6);

-- 2. Backfill existing breached rows so historical data remains usable
-- on /violations immediately after deploy. Priority:
--   a. responseAt — most accurate (breach was resolved at response time).
--   b. sla_timer_started_at + sla_working_minutes minutes — synthesized
--      breach time when we have a timer but no response.
--   c. received_at + 60 minutes — legacy fallback when timer fields are
--      null on old rows; 60 minutes matches the default SLA threshold.
-- Only backfill rows that are actually breached and lack the new value.
UPDATE "public"."client_requests"
SET "sla_breached_at" = COALESCE(
  "response_at",
  "sla_timer_started_at" + make_interval(mins => COALESCE("sla_working_minutes", 60)),
  "received_at" + make_interval(mins => 60)
)
WHERE "sla_breached" = true
  AND "sla_breached_at" IS NULL;

-- 3. Index matches the filter pattern used by sla.getRequests and
-- analytics queries that slice by breach recency.
CREATE INDEX "client_requests_sla_breached_at_idx"
  ON "public"."client_requests" ("sla_breached_at");

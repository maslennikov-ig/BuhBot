-- Migration: add_sla_excess_minutes
-- gh-290: Store SLA excess in working minutes so /violations page shows
-- consistent units across ВРЕМЯ ОТВЕТА and ПРЕВЫШЕНИЕ SLA columns.
-- Populated by stopSlaTimer when an accountant responds (answered state).
-- Open/active breaches continue to use computeSlaExcessMinutes (wall-clock
-- fallback ticking on the frontend).

ALTER TABLE "client_requests" ADD COLUMN "sla_excess_minutes" INTEGER;

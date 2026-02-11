-- Remove deprecated sla_response_minutes column
-- sla_threshold_minutes is the canonical field for SLA breach detection
ALTER TABLE "public"."chats" DROP COLUMN "sla_response_minutes";

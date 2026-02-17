-- gh-140: Add ON DELETE CASCADE on SlaAlert.request
ALTER TABLE "public"."sla_alerts"
DROP CONSTRAINT IF EXISTS "sla_alerts_request_id_fkey";

ALTER TABLE "public"."sla_alerts"
ADD CONSTRAINT "sla_alerts_request_id_fkey"
FOREIGN KEY ("request_id")
REFERENCES "public"."client_requests"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- gh-140: Add ON DELETE SET NULL on SlaAlert.acknowledgedBy
ALTER TABLE "public"."sla_alerts"
DROP CONSTRAINT IF EXISTS "sla_alerts_acknowledged_by_fkey";

ALTER TABLE "public"."sla_alerts"
ADD CONSTRAINT "sla_alerts_acknowledged_by_fkey"
FOREIGN KEY ("acknowledged_by")
REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- gh-153: Add ON DELETE SET NULL on ClientRequest.assignedTo
ALTER TABLE "public"."client_requests"
DROP CONSTRAINT IF EXISTS "client_requests_assigned_to_fkey";

ALTER TABLE "public"."client_requests"
ADD CONSTRAINT "client_requests_assigned_to_fkey"
FOREIGN KEY ("assigned_to")
REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Remove duplicates (keep earliest by receivedAt, tiebreak by id for identical timestamps)
-- NOTE: Cascade deletes will remove linked SlaAlerts, RequestHistory, and
-- ClassificationCorrections for deleted duplicate rows. This is expected —
-- duplicate requests are noise data from webhook retries.
DELETE FROM "public"."client_requests" a
USING "public"."client_requests" b
WHERE a."chat_id" = b."chat_id"
  AND a."message_id" = b."message_id"
  AND (a."received_at" > b."received_at"
       OR (a."received_at" = b."received_at" AND a."id" > b."id"));

-- Add unique constraint
ALTER TABLE "public"."client_requests"
ADD CONSTRAINT "unique_request_per_message" UNIQUE ("chat_id", "message_id");

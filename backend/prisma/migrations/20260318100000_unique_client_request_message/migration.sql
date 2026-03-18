-- Remove duplicates (keep earliest by receivedAt)
DELETE FROM "public"."client_requests" a
USING "public"."client_requests" b
WHERE a."chat_id" = b."chat_id"
  AND a."message_id" = b."message_id"
  AND a."received_at" > b."received_at";

-- Add unique constraint
ALTER TABLE "public"."client_requests"
ADD CONSTRAINT "unique_request_per_message" UNIQUE ("chat_id", "message_id");

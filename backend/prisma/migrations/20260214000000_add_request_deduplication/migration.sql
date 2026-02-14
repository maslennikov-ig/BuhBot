-- Add deduplication fields to client_requests (gh-66)
ALTER TABLE "public"."client_requests"
  ADD COLUMN "content_hash" VARCHAR(64),
  ADD COLUMN "related_request_id" UUID;

-- FK to self for linking duplicates
ALTER TABLE "public"."client_requests"
  ADD CONSTRAINT "client_requests_related_request_id_fkey"
  FOREIGN KEY ("related_request_id") REFERENCES "public"."client_requests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Composite index for dedup lookups: same chat + same hash + recent time
CREATE INDEX "client_requests_chat_id_content_hash_received_at_idx"
  ON "public"."client_requests"("chat_id", "content_hash", "received_at");

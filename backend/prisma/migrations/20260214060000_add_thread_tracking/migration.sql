-- Thread tracking for conversation grouping (gh-75)
ALTER TABLE "public"."client_requests"
  ADD COLUMN "thread_id" UUID,
  ADD COLUMN "parent_message_id" BIGINT;

-- Index for thread queries
CREATE INDEX "client_requests_thread_id_idx" ON "public"."client_requests"("thread_id");

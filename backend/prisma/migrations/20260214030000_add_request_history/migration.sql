-- Create request_history table for audit trail (gh-70)
CREATE TABLE "public"."request_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "request_history_pkey" PRIMARY KEY ("id")
);

-- Foreign key to client_requests
ALTER TABLE "public"."request_history"
  ADD CONSTRAINT "request_history_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "public"."client_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "request_history_request_id_idx" ON "public"."request_history"("request_id");
CREATE INDEX "request_history_changed_at_idx" ON "public"."request_history"("changed_at");

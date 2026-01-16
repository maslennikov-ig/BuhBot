-- Migration: add_error_logs
-- Purpose: Add ErrorLog model for Winston error tracking with fingerprint-based grouping

-- Create ErrorStatus enum
CREATE TYPE "ErrorStatus" AS ENUM ('new', 'in_progress', 'resolved', 'ignored');

-- Create error_logs table
CREATE TABLE IF NOT EXISTS "error_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "level" TEXT NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'buhbot-backend',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "fingerprint" TEXT NOT NULL,
    "metadata" JSONB,

    -- Status tracking
    "status" "ErrorStatus" NOT NULL DEFAULT 'new',
    "assigned_to" UUID,
    "notes" TEXT,

    -- Grouping metadata
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

    -- Foreign key to users table
    CONSTRAINT "error_logs_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX "error_logs_fingerprint_idx" ON "error_logs"("fingerprint");
CREATE INDEX "error_logs_status_idx" ON "error_logs"("status");
CREATE INDEX "error_logs_level_idx" ON "error_logs"("level");
CREATE INDEX "error_logs_timestamp_idx" ON "error_logs"("timestamp" DESC);
CREATE INDEX "error_logs_assigned_to_idx" ON "error_logs"("assigned_to");

-- Add comment
COMMENT ON TABLE "error_logs" IS 'System error logs with fingerprint-based grouping';

-- Enable RLS
ALTER TABLE "error_logs" ENABLE ROW LEVEL SECURITY;

-- Admin users can view error logs
CREATE POLICY "Admin users can view error logs" ON "error_logs"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "users"
      WHERE "users"."id" = auth.uid() AND "users"."role" = 'admin'
    )
  );

-- Admin users can modify error logs
CREATE POLICY "Admin users can modify error logs" ON "error_logs"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "users"
      WHERE "users"."id" = auth.uid() AND "users"."role" = 'admin'
    )
  );

-- Migration: add_sla_monitoring_schema
-- Description: Extends schema for SLA Monitoring System (Tasks T006-T014)
-- Date: 2025-11-22
--
-- Changes:
-- T006: New enums (MessageClassification, AlertDeliveryStatus, AlertAction)
-- T007: Chat model SLA fields
-- T008: ClientRequest model classification and SLA fields (removes isSpam)
-- T009: SlaAlert model delivery and escalation fields
-- T010: WorkingSchedule model timezone field
-- T011: GlobalSettings model
-- T012: GlobalHoliday model
-- T013: ChatHoliday model
-- T014: ClassificationCache model

-- ============================================================================
-- T006: CREATE NEW ENUMS
-- ============================================================================

-- Classification result from AI/keyword-based message analysis
CREATE TYPE "MessageClassification" AS ENUM ('REQUEST', 'SPAM', 'GRATITUDE', 'CLARIFICATION');

-- Alert delivery status for Telegram notifications
CREATE TYPE "AlertDeliveryStatus" AS ENUM ('pending', 'sent', 'delivered', 'failed');

-- Resolution action that closed the alert
CREATE TYPE "AlertAction" AS ENUM ('mark_resolved', 'accountant_responded', 'auto_expired');

-- ============================================================================
-- T007: EXTEND CHAT MODEL
-- ============================================================================

-- Add SLA configuration fields to chats table
ALTER TABLE "chats" ADD COLUMN "sla_threshold_minutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "chats" ADD COLUMN "monitoring_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "chats" ADD COLUMN "is_24x7_mode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chats" ADD COLUMN "manager_telegram_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add index for monitoring_enabled (used in SLA queries)
CREATE INDEX "chats_monitoring_enabled_idx" ON "chats"("monitoring_enabled");

-- ============================================================================
-- T008: EXTEND CLIENT_REQUESTS MODEL
-- ============================================================================

-- Add classification fields (replaces is_spam)
ALTER TABLE "client_requests" ADD COLUMN "classification" "MessageClassification" NOT NULL DEFAULT 'REQUEST';
ALTER TABLE "client_requests" ADD COLUMN "classification_score" DOUBLE PRECISION;
ALTER TABLE "client_requests" ADD COLUMN "classification_model" TEXT;

-- Add SLA timer fields
ALTER TABLE "client_requests" ADD COLUMN "sla_timer_started_at" TIMESTAMPTZ(6);
ALTER TABLE "client_requests" ADD COLUMN "sla_timer_paused_at" TIMESTAMPTZ(6);
ALTER TABLE "client_requests" ADD COLUMN "sla_working_minutes" INTEGER;
ALTER TABLE "client_requests" ADD COLUMN "sla_breached" BOOLEAN NOT NULL DEFAULT false;

-- Add response tracking fields
ALTER TABLE "client_requests" ADD COLUMN "responded_by" UUID;
ALTER TABLE "client_requests" ADD COLUMN "response_message_id" BIGINT;

-- Migrate existing is_spam data to classification
UPDATE "client_requests" SET "classification" = 'SPAM' WHERE "is_spam" = true;

-- Remove old is_spam column and index
DROP INDEX IF EXISTS "idx_client_requests_is_spam";
ALTER TABLE "client_requests" DROP COLUMN IF EXISTS "is_spam";

-- Add new indexes for SLA queries
CREATE INDEX "client_requests_classification_idx" ON "client_requests"("classification");
CREATE INDEX "client_requests_sla_breached_idx" ON "client_requests"("sla_breached");
CREATE INDEX "client_requests_sla_timer_started_at_idx" ON "client_requests"("sla_timer_started_at");

-- ============================================================================
-- T009: EXTEND SLA_ALERTS MODEL
-- ============================================================================

-- Add alert delivery fields
ALTER TABLE "sla_alerts" ADD COLUMN "telegram_message_id" BIGINT;
ALTER TABLE "sla_alerts" ADD COLUMN "delivery_status" "AlertDeliveryStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "sla_alerts" ADD COLUMN "delivered_at" TIMESTAMPTZ(6);

-- Add escalation fields
ALTER TABLE "sla_alerts" ADD COLUMN "escalation_level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "sla_alerts" ADD COLUMN "next_escalation_at" TIMESTAMPTZ(6);

-- Add resolution field
ALTER TABLE "sla_alerts" ADD COLUMN "resolved_action" "AlertAction";

-- Add indexes for escalation queries
CREATE INDEX "sla_alerts_delivery_status_idx" ON "sla_alerts"("delivery_status");
CREATE INDEX "sla_alerts_next_escalation_at_idx" ON "sla_alerts"("next_escalation_at");

-- ============================================================================
-- T010: EXTEND WORKING_SCHEDULES MODEL
-- ============================================================================

-- Add timezone field with default Moscow timezone
ALTER TABLE "working_schedules" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow';

-- ============================================================================
-- T011: CREATE GLOBAL_SETTINGS TABLE
-- ============================================================================

CREATE TABLE "global_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "default_timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "default_working_days" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "default_start_time" TEXT NOT NULL DEFAULT '09:00',
    "default_end_time" TEXT NOT NULL DEFAULT '18:00',
    "default_sla_threshold" INTEGER NOT NULL DEFAULT 60,
    "max_escalations" INTEGER NOT NULL DEFAULT 5,
    "escalation_interval_min" INTEGER NOT NULL DEFAULT 30,
    "global_manager_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ai_confidence_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "message_preview_length" INTEGER NOT NULL DEFAULT 500,
    "data_retention_years" INTEGER NOT NULL DEFAULT 3,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- Insert default settings row
INSERT INTO "global_settings" ("id") VALUES ('default');

-- ============================================================================
-- T012: CREATE GLOBAL_HOLIDAYS TABLE
-- ============================================================================

CREATE TABLE "global_holidays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_holidays_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on date
CREATE UNIQUE INDEX "global_holidays_date_key" ON "global_holidays"("date");

-- Add indexes for queries
CREATE INDEX "global_holidays_year_idx" ON "global_holidays"("year");
CREATE INDEX "global_holidays_date_idx" ON "global_holidays"("date");

-- ============================================================================
-- T013: CREATE CHAT_HOLIDAYS TABLE
-- ============================================================================

CREATE TABLE "chat_holidays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chat_id" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_holidays_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint (one holiday per chat per date)
CREATE UNIQUE INDEX "chat_holidays_chat_id_date_key" ON "chat_holidays"("chat_id", "date");

-- Add indexes
CREATE INDEX "chat_holidays_chat_id_idx" ON "chat_holidays"("chat_id");
CREATE INDEX "chat_holidays_date_idx" ON "chat_holidays"("date");

-- Add foreign key to chats with cascade delete
ALTER TABLE "chat_holidays" ADD CONSTRAINT "chat_holidays_chat_id_fkey"
    FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- T014: CREATE CLASSIFICATION_CACHE TABLE
-- ============================================================================

CREATE TABLE "classification_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_hash" TEXT NOT NULL,
    "classification" "MessageClassification" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "classification_cache_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on message hash
CREATE UNIQUE INDEX "classification_cache_message_hash_key" ON "classification_cache"("message_hash");

-- Add indexes for cache lookups and cleanup
CREATE INDEX "classification_cache_message_hash_idx" ON "classification_cache"("message_hash");
CREATE INDEX "classification_cache_expires_at_idx" ON "classification_cache"("expires_at");

-- ============================================================================
-- VALIDATION CONSTRAINTS (optional, for extra data integrity)
-- ============================================================================

-- Ensure classification_score is between 0 and 1
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_classification_score_check"
    CHECK ("classification_score" IS NULL OR ("classification_score" >= 0 AND "classification_score" <= 1));

-- Ensure escalation_level is between 1 and 10
ALTER TABLE "sla_alerts" ADD CONSTRAINT "sla_alerts_escalation_level_check"
    CHECK ("escalation_level" >= 1 AND "escalation_level" <= 10);

-- Ensure ai_confidence_threshold is between 0 and 1
ALTER TABLE "global_settings" ADD CONSTRAINT "global_settings_ai_confidence_threshold_check"
    CHECK ("ai_confidence_threshold" >= 0 AND "ai_confidence_threshold" <= 1);

-- Ensure message_preview_length is reasonable
ALTER TABLE "global_settings" ADD CONSTRAINT "global_settings_message_preview_length_check"
    CHECK ("message_preview_length" >= 100 AND "message_preview_length" <= 1000);

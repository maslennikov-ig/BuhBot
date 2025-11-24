-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('scheduled', 'sending', 'active', 'closed', 'expired');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'delivered', 'reminded', 'expired', 'failed', 'responded');

-- CreateTable
CREATE TABLE "feedback_surveys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quarter" TEXT NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "sent_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by" UUID,
    "status" "SurveyStatus" NOT NULL DEFAULT 'scheduled',
    "total_clients" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "response_count" INTEGER NOT NULL DEFAULT 0,
    "average_rating" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "survey_id" UUID NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "message_id" BIGINT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "delivered_at" TIMESTAMPTZ(6),
    "reminder_sent_at" TIMESTAMPTZ(6),
    "manager_notified_at" TIMESTAMPTZ(6),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_deliveries_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add survey fields to feedback_responses
ALTER TABLE "feedback_responses" ADD COLUMN "survey_id" UUID;
ALTER TABLE "feedback_responses" ADD COLUMN "delivery_id" UUID;
ALTER TABLE "feedback_responses" ADD COLUMN "client_username" TEXT;

-- AlterTable: Add survey config fields to global_settings
ALTER TABLE "global_settings" ADD COLUMN "survey_validity_days" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "global_settings" ADD COLUMN "survey_reminder_day" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "global_settings" ADD COLUMN "low_rating_threshold" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "global_settings" ADD COLUMN "survey_quarter_day" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "feedback_surveys_quarter_idx" ON "feedback_surveys"("quarter");

-- CreateIndex
CREATE INDEX "feedback_surveys_status_idx" ON "feedback_surveys"("status");

-- CreateIndex
CREATE INDEX "survey_deliveries_survey_id_idx" ON "survey_deliveries"("survey_id");

-- CreateIndex
CREATE INDEX "survey_deliveries_chat_id_idx" ON "survey_deliveries"("chat_id");

-- CreateIndex
CREATE INDEX "survey_deliveries_status_idx" ON "survey_deliveries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "unique_survey_chat" ON "survey_deliveries"("survey_id", "chat_id");

-- CreateIndex (unique on delivery_id)
CREATE UNIQUE INDEX "feedback_responses_delivery_id_key" ON "feedback_responses"("delivery_id");

-- CreateIndex
CREATE INDEX "feedback_responses_survey_id_idx" ON "feedback_responses"("survey_id");

-- AddForeignKey
ALTER TABLE "feedback_surveys" ADD CONSTRAINT "feedback_surveys_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_deliveries" ADD CONSTRAINT "survey_deliveries_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "feedback_surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_deliveries" ADD CONSTRAINT "survey_deliveries_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "feedback_surveys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "survey_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

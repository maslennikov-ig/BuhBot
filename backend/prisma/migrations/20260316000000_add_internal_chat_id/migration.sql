-- Add internal_chat_id to global_settings for SLA breach notifications
-- Replaces per-chat notifyInChatOnBreach with a global internal chat destination
ALTER TABLE "public"."global_settings" ADD COLUMN "internal_chat_id" BIGINT;

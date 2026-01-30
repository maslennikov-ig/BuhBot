-- Add notify_in_chat_on_breach column to chats table
-- Default is true for auto-sending breach notifications to group chat
ALTER TABLE "public"."chats" ADD COLUMN IF NOT EXISTS "notify_in_chat_on_breach" BOOLEAN NOT NULL DEFAULT true;

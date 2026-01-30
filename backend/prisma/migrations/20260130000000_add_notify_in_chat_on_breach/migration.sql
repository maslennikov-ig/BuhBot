-- Add notify_in_chat_on_breach column to chats table
-- Default is true for auto-sending breach notifications to group chat
ALTER TABLE "public"."chats" ADD COLUMN IF NOT EXISTS "notify_in_chat_on_breach" BOOLEAN NOT NULL DEFAULT true;

-- gh-17: Fix existing chats with NULL values (if column was added without NOT NULL constraint previously)
UPDATE "public"."chats" SET "notify_in_chat_on_breach" = true WHERE "notify_in_chat_on_breach" IS NULL;

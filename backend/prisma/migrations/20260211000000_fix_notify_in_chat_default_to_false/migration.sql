-- Fix: Change notifyInChatOnBreach default from true to false
-- Previous fix (buh-2vc/gh-12) incorrectly set default to true,
-- causing SLA breach notifications to leak into client-facing chats.

-- Change the column default
ALTER TABLE "public"."chats"
  ALTER COLUMN "notify_in_chat_on_breach" SET DEFAULT false;

-- Update all existing chats to disable in-chat notifications
-- This prevents breach alerts from leaking into client chats
UPDATE "public"."chats"
  SET "notify_in_chat_on_breach" = false
  WHERE "notify_in_chat_on_breach" = true;

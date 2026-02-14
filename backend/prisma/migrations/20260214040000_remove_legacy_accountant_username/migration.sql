-- Migration: Remove legacy accountant_username column (gh-72)
-- This field has been superseded by accountant_usernames array and accountant_telegram_ids BigInt array.

-- Step 1: Migrate any non-null accountant_username data to accountant_usernames array
UPDATE "public"."chats"
SET "accountant_usernames" = array_append("accountant_usernames", "accountant_username")
WHERE "accountant_username" IS NOT NULL
  AND NOT ("accountant_username" = ANY("accountant_usernames"));

-- Step 2: Drop the legacy column
ALTER TABLE "public"."chats" DROP COLUMN "accountant_username";

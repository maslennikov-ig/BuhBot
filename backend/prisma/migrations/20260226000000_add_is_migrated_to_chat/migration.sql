-- Add is_migrated boolean field to chats table (buh-5xx)
-- Replaces string-based [MIGRATED] title prefix with proper boolean flag

ALTER TABLE "public"."chats"
ADD COLUMN "is_migrated" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark existing migrated chats
UPDATE "public"."chats"
SET "is_migrated" = true
WHERE "title" LIKE '[MIGRATED]%';

-- Index for efficient filtering
CREATE INDEX "idx_chats_is_migrated" ON "public"."chats" ("is_migrated");

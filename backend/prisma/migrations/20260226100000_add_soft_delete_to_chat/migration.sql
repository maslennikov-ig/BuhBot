-- Add soft-delete to chats table (gh-209)
-- Nullable timestamp: NULL = active, set = deleted

ALTER TABLE "public"."chats"
ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

-- Partial index for efficient filtering of active chats
-- Most queries filter WHERE deleted_at IS NULL
CREATE INDEX "idx_chats_not_deleted" ON "public"."chats" ("deleted_at") WHERE "deleted_at" IS NULL;

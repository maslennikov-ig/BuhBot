-- Append-only message store: Telegram as source of truth
-- Adds version tracking, Telegram timestamps, media support, and bot outgoing messages
-- Made idempotent: columns/constraints/indexes may already exist from manual apply

-- Add new columns (IF NOT EXISTS for idempotency)
ALTER TABLE "public"."chat_messages"
ADD COLUMN IF NOT EXISTS "telegram_date" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "edit_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "message_type" VARCHAR(20) NOT NULL DEFAULT 'text',
ADD COLUMN IF NOT EXISTS "media_file_id" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "media_file_name" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "caption" TEXT,
ADD COLUMN IF NOT EXISTS "is_bot_outgoing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);

-- Backfill telegram_date from created_at (best available approximation)
UPDATE "public"."chat_messages" SET "telegram_date" = "created_at" WHERE "telegram_date" IS NULL;

-- Make telegram_date NOT NULL after backfill
ALTER TABLE "public"."chat_messages" ALTER COLUMN "telegram_date" SET NOT NULL;

-- Drop old unique constraint (chat_id, message_id)
ALTER TABLE "public"."chat_messages" DROP CONSTRAINT IF EXISTS "unique_chat_message";

-- Add new unique constraint allowing multiple versions per message
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_chat_message_version'
  ) THEN
    ALTER TABLE "public"."chat_messages"
    ADD CONSTRAINT "unique_chat_message_version" UNIQUE ("chat_id", "message_id", "edit_version");
  END IF;
END $$;

-- Drop old indexes that will be replaced
DROP INDEX IF EXISTS "public"."idx_chat_messages_chat_created";
DROP INDEX IF EXISTS "public"."idx_chat_messages_chat_accountant_created";

-- New indexes for telegramDate-based queries
CREATE INDEX IF NOT EXISTS "idx_chat_messages_chat_telegram_date"
ON "public"."chat_messages" ("chat_id", "telegram_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_chat_messages_chat_msg_version"
ON "public"."chat_messages" ("chat_id", "message_id", "edit_version" DESC);

CREATE INDEX IF NOT EXISTS "idx_chat_messages_chat_accountant_tgdate"
ON "public"."chat_messages" ("chat_id", "is_accountant", "telegram_date");

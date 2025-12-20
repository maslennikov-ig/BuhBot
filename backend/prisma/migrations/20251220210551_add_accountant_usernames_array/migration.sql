-- Add accountantUsernames array field to Chat table
-- Allows multiple @username values for identifying accountants in a chat
-- Applied via Supabase MCP, documented for version control

-- Add column with default empty array
ALTER TABLE "chats" ADD COLUMN "accountant_usernames" TEXT[] NOT NULL DEFAULT '{}';

-- Create GIN index for efficient array search (contains operations)
CREATE INDEX "idx_chats_accountant_usernames" ON "chats" USING GIN ("accountant_usernames");

-- Add comment for documentation
COMMENT ON COLUMN "chats"."accountant_usernames" IS 'Array of Telegram @usernames identifying accountants for this chat. Primary method for accountant detection (priority over legacy accountant_username field).';

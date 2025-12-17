-- Migration: Add composite indexes to chat_messages table for query optimization
-- Issue #3: Optimize message queries with ORDER BY

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_chat_messages_chat_created" ON "public"."chat_messages"("chat_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_chat_messages_chat_accountant_created" ON "public"."chat_messages"("chat_id", "is_accountant", "created_at");

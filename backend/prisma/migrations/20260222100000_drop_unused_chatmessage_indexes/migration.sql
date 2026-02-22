-- Drop unused indexes on chat_messages
-- createdAt index: replaced by telegramDate-based indexes in append-only model
-- isAccountant index: covered by composite idx_chat_messages_chat_accountant_tgdate

DROP INDEX IF EXISTS "public"."idx_chat_messages_created_at";
DROP INDEX IF EXISTS "public"."idx_chat_messages_is_accountant";

-- buh-b4w2 (M-2): Covering index for DISTINCT telegram_user_id query used by
-- aggregateSurveysInternal / aggregateInternal to compute the user-level
-- response-rate denominator (gh-334).
--
-- The query pattern:
--   SELECT DISTINCT telegram_user_id
--   FROM chat_messages
--   WHERE chat_id IN (...) AND is_accountant = false
--
-- The existing idx_chat_messages_chat_accountant_tgdate trails on telegram_date,
-- which forces a heap fetch for telegram_user_id + a sort/hash to compute DISTINCT.
-- Including telegram_user_id in the index makes the DISTINCT computable as an
-- index-only scan, which matters for chats with thousands of messages.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_chat_messages_recipients"
ON "public"."chat_messages"("chat_id", "is_accountant", "telegram_user_id");

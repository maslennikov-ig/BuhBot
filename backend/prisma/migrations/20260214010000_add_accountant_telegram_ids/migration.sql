-- Add accountant_telegram_ids array for secure ID-based verification (gh-68)
ALTER TABLE "public"."chats"
  ADD COLUMN "accountant_telegram_ids" BIGINT[] DEFAULT '{}';

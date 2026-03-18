-- Backfill client_requests.assigned_to from chats.assigned_accountant_id
-- for existing records where assigned_to is NULL.
-- Safe: only updates NULL → non-NULL, idempotent.
UPDATE "public"."client_requests" cr
SET "assigned_to" = c."assigned_accountant_id"
FROM "public"."chats" c
WHERE cr."chat_id" = c."id"
  AND cr."assigned_to" IS NULL
  AND c."assigned_accountant_id" IS NOT NULL;

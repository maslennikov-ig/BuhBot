-- AlterTable: Add ON DELETE SET NULL to chats.assigned_accountant_id (gh-134)
-- When a User is deleted, set assignedAccountantId to NULL instead of erroring

ALTER TABLE "public"."chats"
DROP CONSTRAINT IF EXISTS "chats_assigned_accountant_id_fkey";

ALTER TABLE "public"."chats"
ADD CONSTRAINT "chats_assigned_accountant_id_fkey"
FOREIGN KEY ("assigned_accountant_id")
REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Fix CHECK constraint on users.role to include 'accountant'
-- The previous migration added 'accountant' to the UserRole enum,
-- but the CHECK constraint was not updated to match.
ALTER TABLE "public"."users" DROP CONSTRAINT IF EXISTS "users_role_check";
ALTER TABLE "public"."users" ADD CONSTRAINT "users_role_check"
  CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'accountant'::text, 'observer'::text]));

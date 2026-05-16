-- Add global switch for bot replies confirming received files.
-- Default true preserves existing behavior until admins explicitly disable it.
ALTER TABLE "public"."global_settings"
  ADD COLUMN "file_confirmation_enabled" BOOLEAN NOT NULL DEFAULT true;

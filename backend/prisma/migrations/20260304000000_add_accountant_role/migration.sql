-- Add 'accountant' to UserRole enum
ALTER TYPE "public"."UserRole" ADD VALUE IF NOT EXISTS 'accountant';

-- Add is_active column to users table
ALTER TABLE "public"."users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Add index on is_active
CREATE INDEX "users_is_active_idx" ON "public"."users"("is_active");

-- CreateTable: user_managers (Manager-Accountant M:N join table)
CREATE TABLE "public"."user_managers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "manager_id" UUID NOT NULL,
    "accountant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: verification_tokens
CREATE TABLE "public"."verification_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notification_preferences
CREATE TABLE "public"."notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "notification_type" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "overridden_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: user_managers
CREATE UNIQUE INDEX "unique_manager_accountant" ON "public"."user_managers"("manager_id", "accountant_id");
CREATE INDEX "user_managers_manager_id_idx" ON "public"."user_managers"("manager_id");
CREATE INDEX "user_managers_accountant_id_idx" ON "public"."user_managers"("accountant_id");

-- CreateIndex: verification_tokens
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "public"."verification_tokens"("token");
CREATE INDEX "verification_tokens_token_idx" ON "public"."verification_tokens"("token");
CREATE INDEX "verification_tokens_user_id_idx" ON "public"."verification_tokens"("user_id");

-- CreateIndex: notification_preferences
CREATE UNIQUE INDEX "unique_user_notification_type" ON "public"."notification_preferences"("user_id", "notification_type");
CREATE INDEX "notification_preferences_user_id_idx" ON "public"."notification_preferences"("user_id");

-- AddForeignKey: user_managers
ALTER TABLE "public"."user_managers" ADD CONSTRAINT "user_managers_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."user_managers" ADD CONSTRAINT "user_managers_accountant_id_fkey" FOREIGN KEY ("accountant_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: verification_tokens
ALTER TABLE "public"."verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: notification_preferences
ALTER TABLE "public"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "public"."ClientTier" AS ENUM ('basic', 'standard', 'vip', 'premium');

-- AlterTable: Add client_tier with default 'standard'
ALTER TABLE "public"."chats" ADD COLUMN "client_tier" "public"."ClientTier" NOT NULL DEFAULT 'standard';

-- Add new request status enum values (gh-69)
ALTER TYPE "public"."RequestStatus" ADD VALUE IF NOT EXISTS 'waiting_client';
ALTER TYPE "public"."RequestStatus" ADD VALUE IF NOT EXISTS 'transferred';
ALTER TYPE "public"."RequestStatus" ADD VALUE IF NOT EXISTS 'closed';

-- Fix: user deletion fails due to FK constraints on 6 tables
-- Make 4 previously NOT NULL FK fields nullable, add ON DELETE SET NULL to all 6

-- 1. ChatInvitation.created_by: NOT NULL -> nullable + SET NULL
ALTER TABLE "public"."chat_invitations" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE "public"."chat_invitations" DROP CONSTRAINT "chat_invitations_created_by_fkey";
ALTER TABLE "public"."chat_invitations" ADD CONSTRAINT "chat_invitations_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Template.created_by: NOT NULL -> nullable + SET NULL
ALTER TABLE "public"."templates" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE "public"."templates" DROP CONSTRAINT "templates_created_by_fkey";
ALTER TABLE "public"."templates" ADD CONSTRAINT "templates_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. FaqItem.created_by: NOT NULL -> nullable + SET NULL
ALTER TABLE "public"."faq_items" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE "public"."faq_items" DROP CONSTRAINT "faq_items_created_by_fkey";
ALTER TABLE "public"."faq_items" ADD CONSTRAINT "faq_items_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. ClassificationCorrection.corrected_by: NOT NULL -> nullable + SET NULL
ALTER TABLE "public"."classification_corrections" ALTER COLUMN "corrected_by" DROP NOT NULL;
ALTER TABLE "public"."classification_corrections" DROP CONSTRAINT "classification_corrections_corrected_by_fkey";
ALTER TABLE "public"."classification_corrections" ADD CONSTRAINT "classification_corrections_corrected_by_fkey"
  FOREIGN KEY ("corrected_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. FeedbackSurvey.closed_by: already nullable, just add SET NULL
ALTER TABLE "public"."feedback_surveys" DROP CONSTRAINT "feedback_surveys_closed_by_fkey";
ALTER TABLE "public"."feedback_surveys" ADD CONSTRAINT "feedback_surveys_closed_by_fkey"
  FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. ErrorLog.assigned_to: already nullable, just add SET NULL
ALTER TABLE "public"."error_logs" DROP CONSTRAINT "error_logs_assigned_to_fkey";
ALTER TABLE "public"."error_logs" ADD CONSTRAINT "error_logs_assigned_to_fkey"
  FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

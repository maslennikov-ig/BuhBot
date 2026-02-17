-- Add CASCADE DELETE on Chat relations (gh-110)
-- When a Chat is deleted, cascade to related records

-- ClientRequest.chatId -> Chat.id
ALTER TABLE "public"."client_requests" DROP CONSTRAINT IF EXISTS "client_requests_chat_id_fkey";
ALTER TABLE "public"."client_requests" ADD CONSTRAINT "client_requests_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FeedbackResponse.chatId -> Chat.id
ALTER TABLE "public"."feedback_responses" DROP CONSTRAINT IF EXISTS "feedback_responses_chat_id_fkey";
ALTER TABLE "public"."feedback_responses" ADD CONSTRAINT "feedback_responses_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FeedbackResponse.requestId -> ClientRequest.id (SET NULL on delete)
ALTER TABLE "public"."feedback_responses" DROP CONSTRAINT IF EXISTS "feedback_responses_request_id_fkey";
ALTER TABLE "public"."feedback_responses" ADD CONSTRAINT "feedback_responses_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "public"."client_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SurveyDelivery.chatId -> Chat.id
ALTER TABLE "public"."survey_deliveries" DROP CONSTRAINT IF EXISTS "survey_deliveries_chat_id_fkey";
ALTER TABLE "public"."survey_deliveries" ADD CONSTRAINT "survey_deliveries_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WorkingHoursSchedule.chatId -> Chat.id
ALTER TABLE "public"."working_schedules" DROP CONSTRAINT IF EXISTS "working_schedules_chat_id_fkey";
ALTER TABLE "public"."working_schedules" ADD CONSTRAINT "working_schedules_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

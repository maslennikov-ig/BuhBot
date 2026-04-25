-- Add composite index on (state, delivery_id) for aggregateSurveys() query optimization (H-2)
-- This index improves query performance by allowing efficient filtering on state='active'
-- combined with joins through delivery_id to get surveyId.
--
-- The query in vote.service.ts:aggregateSurveys() filters:
-- WHERE state = 'active' AND delivery.surveyId IN (...)
--
-- This index supports the state filter and delivery_id join condition.

CREATE INDEX CONCURRENTLY idx_survey_votes_state_delivery
ON "public"."survey_votes"(state, "delivery_id")
WHERE state = 'active';

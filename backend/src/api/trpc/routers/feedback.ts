/**
 * Feedback Router - Client Feedback Analytics
 *
 * Procedures:
 * - getAggregates: Get aggregate feedback statistics (all roles)
 * - getAll: Get full feedback details (manager only)
 * - getById: Get single feedback entry (manager only)
 * - submitRating: Record client rating from Telegram callback
 * - addComment: Add comment to existing feedback
 * - exportCsv: Export feedback data as CSV (manager only)
 *
 * @module api/trpc/routers/feedback
 */

import { router, authedProcedure, publicProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  getAggregates,
  getRecentComments,
  getTrendData,
} from '../../../services/feedback/analytics.service.js';
import { recordResponse, getDeliveryById } from '../../../services/feedback/survey.service.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * Feedback router for client satisfaction analytics
 */
export const feedbackRouter = router({
  /**
   * Get aggregate feedback statistics
   *
   * Available to all authenticated users (managers, accountants, observers).
   * Returns anonymized data without client-identifying information.
   *
   * @authorization All authenticated users
   */
  getAggregates: authedProcedure
    .input(
      z
        .object({
          dateFrom: z.date().optional(),
          dateTo: z.date().optional(),
          surveyId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const dateRange =
        input?.dateFrom && input?.dateTo
          ? { from: input.dateFrom, to: input.dateTo }
          : input?.dateFrom
            ? { from: input.dateFrom }
            : input?.dateTo
              ? { to: input.dateTo }
              : undefined;

      const aggregates = await getAggregates(dateRange, input?.surveyId);
      const trendData = await getTrendData(4);
      const recentComments = await getRecentComments(10, false); // Anonymized

      return {
        totalResponses: aggregates.totalResponses,
        averageRating: aggregates.averageRating,
        npsScore: aggregates.nps.score,
        ratingDistribution: aggregates.distribution,
        recentComments: recentComments.map((c) => ({
          comment: c.comment,
          rating: c.rating,
          submittedAt: c.submittedAt,
        })),
        trendData,
      };
    }),

  /**
   * Submit rating from Telegram callback (T018)
   *
   * Internal procedure for bot callback handler.
   * Records client rating and triggers low-rating alert if needed.
   *
   * @authorization Public (called from bot handler)
   */
  submitRating: publicProcedure
    .input(
      z.object({
        deliveryId: z.string().uuid(),
        rating: z.number().min(1).max(5),
        telegramUsername: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { deliveryId, rating, telegramUsername } = input;

      // Verify delivery exists and is valid
      const delivery = await getDeliveryById(deliveryId);
      if (!delivery) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Survey delivery not found',
        });
      }

      if (delivery.status === 'responded') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Already responded to this survey',
        });
      }

      if (delivery.survey.status !== 'active' && delivery.survey.status !== 'sending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Survey is no longer accepting responses',
        });
      }

      // Record the response
      const feedbackId = await recordResponse(deliveryId, rating, telegramUsername);

      // Check if low rating (for alert trigger in T035)
      const shouldTriggerAlert = rating <= 3;

      return {
        success: true,
        feedbackId,
        shouldPromptComment: true,
        shouldTriggerAlert,
        rating,
      };
    }),

  /**
   * Add comment to existing feedback (T019)
   *
   * Internal procedure for bot handler.
   * Adds optional comment to a feedback response.
   *
   * @authorization Public (called from bot handler)
   */
  addComment: publicProcedure
    .input(
      z.object({
        feedbackId: z.string().uuid(),
        comment: z.string().max(2000),
      })
    )
    .mutation(async ({ input }) => {
      const { feedbackId, comment } = input;

      // Verify feedback exists
      const feedback = await prisma.feedbackResponse.findUnique({
        where: { id: feedbackId },
      });

      if (!feedback) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Feedback not found',
        });
      }

      // Update with comment
      await prisma.feedbackResponse.update({
        where: { id: feedbackId },
        data: { comment },
      });

      return {
        success: true,
      };
    }),

  // TODO: T023 - Implement getAll procedure (manager only)
  // TODO: T024 - Implement getById procedure (manager only)
  // TODO: T025 - Implement exportCsv procedure
});

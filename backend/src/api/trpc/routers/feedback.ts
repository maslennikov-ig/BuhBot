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

import { router, authedProcedure } from '../trpc.js';
import { z } from 'zod';
import {
  getAggregates,
  getRecentComments,
  getTrendData,
} from '../../../services/feedback/analytics.service.js';

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

  // TODO: T023 - Implement getAll procedure (manager only)
  // TODO: T024 - Implement getById procedure (manager only)
  // TODO: T018 - Implement submitRating procedure
  // TODO: T019 - Implement addComment procedure
  // TODO: T025 - Implement exportCsv procedure
});

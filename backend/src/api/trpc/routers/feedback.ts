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
 * Role-Based Access Control (RBAC):
 * ┌─────────────────────┬───────────┬─────────┬──────────┐
 * │ Procedure           │ Admin     │ Manager │ Accountant│
 * ├─────────────────────┼───────────┼─────────┼──────────┤
 * │ getAggregates       │ ✓         │ ✓       │ ✓        │
 * │ getAll              │ ✓         │ ✓       │ ✗        │
 * │ getById             │ ✓         │ ✓       │ ✗        │
 * │ exportCsv           │ ✓         │ ✓       │ ✗        │
 * │ submitRating        │ public    │ public  │ public   │
 * │ addComment          │ public    │ public  │ public   │
 * └─────────────────────┴───────────┴─────────┴──────────┘
 *
 * Security Notes:
 * - getAggregates: Returns only anonymized statistics without client identifiers
 * - getAll/getById: Protected by managerProcedure middleware, returns full client data
 * - submitRating/addComment: Public procedures for Telegram bot callbacks
 * - RLS policies on feedback_responses table provide additional DB-level protection
 *
 * @module api/trpc/routers/feedback
 */

import { router, authedProcedure, publicProcedure, managerProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';
import {
  getAggregates,
  getRecentComments,
  getTrendData,
} from '../../../services/feedback/analytics.service.js';
import { recordResponse, getDeliveryById } from '../../../services/feedback/survey.service.js';
import { prisma } from '../../../lib/prisma.js';
import { queueLowRatingAlert } from '../../../queues/setup.js';
import logger from '../../../utils/logger.js';

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

      // Only accept ratings for delivered/reminded surveys (gh-87)
      // Reject: pending (not yet sent), failed, expired, responded
      if (!['delivered', 'reminded'].includes(delivery.status)) {
        const isResponded = delivery.status === 'responded';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: isResponded
            ? 'Already responded to this survey'
            : 'Survey delivery is not in a rateable state',
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

      // Queue low-rating alert if needed (non-blocking)
      if (shouldTriggerAlert) {
        // Don't await - queue asynchronously to not block the response
        queueLowRatingAlert({
          feedbackId,
          chatId: delivery.chatId.toString(),
          rating,
          clientUsername: telegramUsername,
          comment: undefined, // Comment may be added later via addComment
        }).catch((error) => {
          // Log but don't fail the request
          logger.error('Failed to queue low-rating alert', {
            error: error instanceof Error ? error.message : String(error),
            feedbackId,
            deliveryId,
            service: 'feedback-router',
          });
        });
      }

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

  /**
   * Get all feedback entries with full details (T023)
   *
   * Manager-only procedure for viewing feedback with client identifiers.
   * Supports filtering by date, rating, survey, and chat.
   * Returns paginated results with chat and survey details.
   *
   * @authorization Manager only
   */
  getAll: managerProcedure
    .input(
      z
        .object({
          dateFrom: z.date().optional(),
          dateTo: z.date().optional(),
          surveyId: z.string().uuid().optional(),
          minRating: z.number().min(1).max(5).optional(),
          maxRating: z.number().min(1).max(5).optional(),
          chatId: z.string().optional(),
          page: z.number().min(1).default(1),
          pageSize: z.number().min(10).max(100).default(20),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: Prisma.FeedbackResponseWhereInput = {};

      if (input?.dateFrom || input?.dateTo) {
        where.submittedAt = {};
        if (input.dateFrom) {
          where.submittedAt.gte = input.dateFrom;
        }
        if (input.dateTo) {
          where.submittedAt.lte = input.dateTo;
        }
      }

      if (input?.surveyId) {
        where.surveyId = input.surveyId;
      }

      if (input?.minRating || input?.maxRating) {
        where.rating = {};
        if (input.minRating) {
          where.rating.gte = input.minRating;
        }
        if (input.maxRating) {
          where.rating.lte = input.maxRating;
        }
      }

      if (input?.chatId) {
        where.chatId = BigInt(input.chatId);
      }

      // Get total count for pagination
      const totalItems = await prisma.feedbackResponse.count({ where });
      const totalPages = Math.ceil(totalItems / pageSize);

      // Get feedback entries with relations
      const responses = await prisma.feedbackResponse.findMany({
        where,
        include: {
          chat: {
            include: {
              assignedAccountant: {
                select: {
                  fullName: true,
                },
              },
            },
          },
          survey: {
            select: {
              quarter: true,
            },
          },
        },
        orderBy: {
          submittedAt: 'desc',
        },
        skip,
        take: pageSize,
      });

      const items = responses.map((r) => ({
        id: r.id,
        chatId: r.chatId.toString(),
        chatTitle: r.chat?.title ?? null,
        clientUsername: r.clientUsername,
        accountantUsername: r.chat?.assignedAccountant?.fullName ?? null,
        rating: r.rating,
        comment: r.comment,
        submittedAt: r.submittedAt,
        surveyId: r.surveyId,
        surveyQuarter: r.survey?.quarter ?? null,
      }));

      return {
        items,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
        },
      };
    }),

  /**
   * Get single feedback entry by ID (T024)
   *
   * Manager-only procedure for viewing full feedback details.
   * Includes client info, accountant info, survey details, and related request.
   *
   * @authorization Manager only
   */
  getById: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const feedback = await prisma.feedbackResponse.findUnique({
        where: { id: input.id },
        include: {
          chat: {
            include: {
              assignedAccountant: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          survey: {
            select: {
              id: true,
              quarter: true,
              status: true,
            },
          },
        },
      });

      if (!feedback) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Feedback not found',
        });
      }

      // Try to find related request (most recent before feedback submission)
      const relatedRequest = await prisma.clientRequest.findFirst({
        where: {
          chatId: feedback.chatId,
          receivedAt: {
            lte: feedback.submittedAt,
          },
        },
        orderBy: {
          receivedAt: 'desc',
        },
        select: {
          id: true,
          messageText: true,
          receivedAt: true,
        },
      });

      return {
        id: feedback.id,
        chatId: feedback.chatId.toString(),
        chatTitle: feedback.chat?.title ?? null,
        clientUsername: feedback.clientUsername,
        accountant: feedback.chat?.assignedAccountant ?? null,
        rating: feedback.rating,
        comment: feedback.comment,
        submittedAt: feedback.submittedAt,
        survey: feedback.survey,
        relatedRequest,
      };
    }),

  /**
   * Export feedback data as CSV (T025)
   *
   * Manager-only procedure for exporting feedback to CSV.
   * Includes all feedback details with optional date/survey filters.
   *
   * @authorization Manager only
   */
  exportCsv: managerProcedure
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
      // Build where clause
      const where: Prisma.FeedbackResponseWhereInput = {};

      if (input?.dateFrom || input?.dateTo) {
        where.submittedAt = {};
        if (input.dateFrom) {
          where.submittedAt.gte = input.dateFrom;
        }
        if (input.dateTo) {
          where.submittedAt.lte = input.dateTo;
        }
      }

      if (input?.surveyId) {
        where.surveyId = input.surveyId;
      }

      const responses = await prisma.feedbackResponse.findMany({
        where,
        include: {
          chat: {
            include: {
              assignedAccountant: {
                select: {
                  fullName: true,
                },
              },
            },
          },
          survey: {
            select: {
              quarter: true,
            },
          },
        },
        orderBy: {
          submittedAt: 'desc',
        },
      });

      // Build CSV header
      const headers = [
        'ID',
        'Chat ID',
        'Chat Title',
        'Client Username',
        'Accountant',
        'Rating',
        'Comment',
        'Submitted At',
        'Survey ID',
        'Survey Quarter',
      ];

      // Build CSV rows
      const rows = responses.map((r) => [
        r.id,
        r.chatId.toString(),
        escapeCSV(r.chat?.title ?? ''),
        escapeCSV(r.clientUsername ?? ''),
        escapeCSV(r.chat?.assignedAccountant?.fullName ?? ''),
        r.rating.toString(),
        escapeCSV(r.comment ?? ''),
        r.submittedAt.toISOString(),
        r.surveyId ?? '',
        r.survey?.quarter ?? '',
      ]);

      // Combine into CSV content
      const content = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

      // Generate filename with date range
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `feedback-export-${dateStr}.csv`;

      return {
        filename,
        content,
        rowCount: responses.length,
      };
    }),
});

/**
 * Escape a string value for CSV
 * Wraps in quotes if contains comma, newline, or quote.
 * Prefixes formula-triggering characters to prevent CSV injection (gh-114).
 */
function escapeCSV(value: string): string {
  let escaped = value;

  // Prevent CSV injection: prefix formula-triggering characters (gh-114)
  if (/^[=+\-@\t\r]/.test(escaped)) {
    escaped = `'${escaped}`;
  }

  if (
    escaped.includes(',') ||
    escaped.includes('\n') ||
    escaped.includes('"') ||
    escaped !== value
  ) {
    return `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}

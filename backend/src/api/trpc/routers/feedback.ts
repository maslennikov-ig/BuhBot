/**
 * Feedback Router - Client Feedback Analytics
 *
 * Procedures:
 * - getAggregates: Get aggregate feedback statistics (all roles)
 * - getAll: Get full feedback details (manager only)
 * - getById: Get single feedback entry (manager only)
 * - submitRating: Record client rating from Telegram callback (DEPRECATED — ADR-007)
 * - addComment: Add comment to existing feedback
 * - exportCsv: Export feedback data as CSV (manager only)
 *
 * Read-path is unified across `feedbackResponse` (legacy) and
 * `surveyVote (state='active')` (canonical post-gh-294). See ADR-007.
 *
 * Role-Based Access Control (RBAC):
 * ┌─────────────────────┬───────────┬─────────┬──────────┐
 * │ Procedure           │ Admin     │ Manager │ Accountant│
 * ├─────────────────────┼───────────┼─────────┼──────────┤
 * │ getAggregates       │ ✓         │ ✓       │ ✗        │
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

import { router, publicProcedure, managerProcedure, staffProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  getAggregates,
  getRecentComments,
  getTrendData,
  calculateNPS,
  calculateDistribution,
  fetchUnifiedRatings,
  fetchUnifiedEntries,
  fetchUnifiedComments,
} from '../../../services/feedback/analytics.service.js';
import { getScopedChatIds } from '../helpers/scoping.js';
import { recordResponse, getDeliveryById } from '../../../services/feedback/survey.service.js';
import { prisma } from '../../../lib/prisma.js';
import { queueLowRatingAlert } from '../../../queues/setup.js';
import logger from '../../../utils/logger.js';

/**
 * Feedback router for client satisfaction analytics
 */
export const feedbackRouter = router({
  /**
   * Get aggregate feedback statistics.
   *
   * Reads from the unified view (`feedbackResponse ∪ surveyVote(active)`).
   * Scoping is applied to both sources via `getScopedChatIds`.
   *
   * Available to staff: admin, manager, observer (not accountant).
   * Returns anonymized data without client-identifying information.
   *
   * @authorization Staff only (admin, manager, observer)
   */
  getAggregates: staffProcedure
    .input(
      z
        .object({
          dateFrom: z.date().optional(),
          dateTo: z.date().optional(),
          surveyId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // Apply role-based chat scoping. `null` = unrestricted (admin).
      const scopedChatIds = await getScopedChatIds(ctx.prisma, ctx.user.id, ctx.user.role);

      // Unrestricted path uses the existing service functions unchanged so the
      // trend-data behavior is preserved (cross-tenant quarterly buckets).
      if (scopedChatIds === null) {
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
      }

      // Scoped path: unified read restricted to the user's chats.
      const [ratingRows, commentRows] = await Promise.all([
        fetchUnifiedRatings({
          dateFrom: input?.dateFrom,
          dateTo: input?.dateTo,
          surveyId: input?.surveyId,
          scopedChatIds,
        }),
        fetchUnifiedComments({
          dateFrom: input?.dateFrom,
          dateTo: input?.dateTo,
          surveyId: input?.surveyId,
          scopedChatIds,
          limit: 10,
        }),
      ]);

      const ratings = ratingRows.map((r) => r.rating);
      const totalResponses = ratings.length;
      const averageRating =
        totalResponses > 0
          ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / totalResponses) * 10) / 10
          : 0;
      const nps = calculateNPS(ratings);
      const distribution = calculateDistribution(ratings);

      const recentComments = commentRows.map((c) => ({
        comment: c.comment!,
        rating: c.rating,
        submittedAt: c.submittedAt,
      }));

      // Trend data is cross-chat aggregate; return empty for scoped users
      // (per-chat trend would require significant per-quarter queries)
      const trendData: {
        period: string;
        averageRating: number;
        responseCount: number;
        npsScore: number;
      }[] = [];

      return {
        totalResponses,
        averageRating,
        npsScore: nps.score,
        ratingDistribution: distribution,
        recentComments,
        trendData,
      };
    }),

  /**
   * Submit rating from Telegram callback.
   *
   * @deprecated As of ADR-007 / gh-324 the canonical write target for survey
   * responses is `SurveyVote` via the bot voting flow (see
   * `bot/handlers/survey.handler.ts:submitVote`). This mutation continues to
   * write to the legacy `feedbackResponse` table for backward compatibility
   * with any external caller still invoking it. Do NOT use for new features.
   * Scheduled for removal once external callers are audited.
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

      logger.warn('[deprecated] feedback.submitRating called — prefer SurveyVote flow', {
        deliveryId,
        rating,
        service: 'feedback-router',
        adr: 'ADR-007',
      });

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
   * Get all feedback entries with full details.
   *
   * Manager-only procedure for viewing feedback with client identifiers.
   * Supports filtering by date, rating, survey, and chat.
   * Returns paginated results with chat and survey details.
   *
   * Reads from `feedbackResponse ∪ surveyVote(active)` (ADR-007). Pagination
   * is applied in memory after the union + merge-sort — see
   * `fetchUnifiedEntries`. Scoping is forwarded to both sources.
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
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;

      // Apply role-based scoping (admin: null = unrestricted).
      const scopedChatIds = await getScopedChatIds(ctx.prisma, ctx.user.id, ctx.user.role);

      // Parse `chatId` filter (string in, BigInt out). Must be numeric; reject
      // otherwise to mirror the previous BigInt(input.chatId) behavior.
      let chatIdFilter: bigint | undefined;
      if (input?.chatId !== undefined) {
        if (!/^-?\d+$/.test(input.chatId)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'chatId must be a numeric string',
          });
        }
        chatIdFilter = BigInt(input.chatId);
      }

      const { items: rows, total: totalItems } = await fetchUnifiedEntries({
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
        surveyId: input?.surveyId,
        minRating: input?.minRating,
        maxRating: input?.maxRating,
        chatId: chatIdFilter,
        scopedChatIds,
        page,
        pageSize,
      });

      const totalPages = Math.ceil(totalItems / pageSize);

      const items = rows.map((r) => ({
        id: r.id,
        chatId: r.chatId.toString(),
        chatTitle: r.chatTitle,
        clientUsername: r.clientUsername,
        accountantUsername: r.accountantName,
        rating: r.rating,
        comment: r.comment,
        submittedAt: r.submittedAt,
        surveyId: r.surveyId,
        surveyQuarter: r.surveyQuarter,
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
   * Get single feedback entry by ID.
   *
   * Tries the legacy `feedbackResponse` table first (the historically
   * authoritative source for individual DTOs). If not found, falls back to
   * `surveyVote` by UUID — required because post-gh-294 entries live in the
   * vote table. DTO shape is identical for both sources.
   *
   * @authorization Manager only
   */
  getById: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const scopedChatIds = await getScopedChatIds(ctx.prisma, ctx.user.id, ctx.user.role);

      // 1. Legacy path.
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

      if (feedback) {
        if (scopedChatIds && !scopedChatIds.includes(feedback.chatId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Not authorized to access this feedback entry',
          });
        }

        const relatedRequest = await prisma.clientRequest.findFirst({
          where: {
            chatId: feedback.chatId,
            receivedAt: { lte: feedback.submittedAt },
          },
          orderBy: { receivedAt: 'desc' },
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
      }

      // 2. Vote fallback (post-gh-294 canonical source).
      const vote = await prisma.surveyVote.findUnique({
        where: { id: input.id },
        include: {
          delivery: {
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
          },
        },
      });

      if (!vote) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Feedback not found',
        });
      }

      if (scopedChatIds && !scopedChatIds.includes(vote.delivery.chatId)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to access this feedback entry',
        });
      }

      const voteSubmittedAt = vote.updatedAt;
      const relatedRequest = await prisma.clientRequest.findFirst({
        where: {
          chatId: vote.delivery.chatId,
          receivedAt: { lte: voteSubmittedAt },
        },
        orderBy: { receivedAt: 'desc' },
        select: {
          id: true,
          messageText: true,
          receivedAt: true,
        },
      });

      return {
        id: vote.id,
        chatId: vote.delivery.chatId.toString(),
        chatTitle: vote.delivery.chat?.title ?? null,
        clientUsername: vote.username,
        accountant: vote.delivery.chat?.assignedAccountant ?? null,
        rating: vote.rating,
        comment: vote.comment,
        submittedAt: voteSubmittedAt,
        survey: vote.delivery.survey,
        relatedRequest,
      };
    }),

  /**
   * Export feedback data as CSV.
   *
   * Reads from `feedbackResponse ∪ surveyVote(active)` (ADR-007). No
   * pagination — the CSV contains the full filtered set.
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
    .query(async ({ ctx, input }) => {
      const scopedChatIds = await getScopedChatIds(ctx.prisma, ctx.user.id, ctx.user.role);

      const { items: rows } = await fetchUnifiedEntries({
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
        surveyId: input?.surveyId,
        scopedChatIds,
        // No pagination — export all matching rows.
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
      const csvRows = rows.map((r) => [
        r.id,
        r.chatId.toString(),
        escapeCSV(r.chatTitle ?? ''),
        escapeCSV(r.clientUsername ?? ''),
        escapeCSV(r.accountantName ?? ''),
        r.rating.toString(),
        escapeCSV(r.comment ?? ''),
        r.submittedAt.toISOString(),
        r.surveyId ?? '',
        r.surveyQuarter ?? '',
      ]);

      // Combine into CSV content
      const content = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');

      // Generate filename with date range
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `feedback-export-${dateStr}.csv`;

      return {
        filename,
        content,
        rowCount: rows.length,
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

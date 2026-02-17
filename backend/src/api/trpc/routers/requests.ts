/**
 * Requests Router - Client Request Management & SLA Monitoring
 *
 * Procedures:
 * - list: List client requests with filtering and pagination
 * - getById: Get single request with related alerts
 * - update: Update request status or assignment
 * - updateClassification: Update request classification (REQUEST, SPAM, GRATITUDE, CLARIFICATION)
 * - getClassificationFeedback: Analyze correction patterns for classifier improvement (gh-73)
 *
 * @module api/trpc/routers/requests
 */

import { router, authedProcedure, managerProcedure } from '../trpc.js';
import { requireChatAccess } from '../authorization.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { safeNumberFromBigInt } from '../../../utils/bigint.js';
import { FeedbackProcessor } from '../../../services/classifier/feedback.processor.js';
import logger from '../../../utils/logger.js';

/**
 * Request status schema (matches Prisma RequestStatus enum)
 */
const RequestStatusSchema = z.enum([
  'pending',
  'in_progress',
  'waiting_client',
  'transferred',
  'answered',
  'escalated',
  'closed',
]);

/**
 * Alert type schema (matches Prisma AlertType enum)
 */
const AlertTypeSchema = z.enum(['warning', 'breach']);

/**
 * Message classification schema (matches Prisma MessageClassification enum)
 */
const MessageClassificationSchema = z.enum(['REQUEST', 'SPAM', 'GRATITUDE', 'CLARIFICATION']);

/**
 * Requests router for client request management
 */
export const requestsRouter = router({
  /**
   * List client requests with filtering and pagination
   *
   * @param chatId - Filter by chat ID
   * @param assignedTo - Filter by assigned accountant UUID
   * @param status - Filter by request status
   * @param classification - Filter by message classification
   * @param startDate - Filter requests from date (inclusive)
   * @param endDate - Filter requests to date (inclusive)
   * @param limit - Page size (default: 50, max: 100)
   * @param offset - Pagination offset (default: 0)
   * @param sortBy - Sort field (default: received_at)
   * @param sortOrder - Sort order (default: desc)
   * @returns Paginated list of requests with total count
   * @authorization All authenticated users (read-only)
   */
  list: authedProcedure
    .input(
      z.object({
        chatId: z.number().optional(),
        assignedTo: z.string().uuid().optional(),
        status: RequestStatusSchema.optional(),
        classification: MessageClassificationSchema.optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        sortBy: z.enum(['received_at', 'response_time_minutes']).default('received_at'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      })
    )
    .output(
      z.object({
        requests: z.array(
          z.object({
            id: z.string().uuid(),
            chatId: z.number(),
            messageId: z.number(),
            messageText: z.string(),
            clientUsername: z.string().nullable(),
            receivedAt: z.date(),
            assignedTo: z.string().uuid().nullable(),
            responseAt: z.date().nullable(),
            responseTimeMinutes: z.number().int().nullable(),
            status: RequestStatusSchema,
            classification: MessageClassificationSchema,
            threadId: z.string().uuid().nullable(),
            createdAt: z.date(),
            chat: z.object({
              title: z.string().nullable(),
              clientTier: z.string().nullable(),
            }),
            responseMessage: z
              .object({
                messageText: z.string(),
                username: z.string().nullable(),
              })
              .nullable(),
          })
        ),
        total: z.number().int(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build where clause from filters
      const where: Prisma.ClientRequestWhereInput = {};
      if (input.chatId !== undefined) {
        where.chatId = input.chatId;
      }
      if (input.assignedTo !== undefined) {
        where.assignedTo = input.assignedTo;
      }
      if (input.status !== undefined) {
        where.status = input.status;
      }
      if (input.classification !== undefined) {
        where.classification = input.classification;
      }
      if (input.startDate || input.endDate) {
        where.receivedAt = {};
        if (input.startDate) {
          where.receivedAt.gte = input.startDate;
        }
        if (input.endDate) {
          where.receivedAt.lte = input.endDate;
        }
      }

      // Build order by clause
      const orderBy: Prisma.ClientRequestOrderByWithRelationInput = {};
      if (input.sortBy === 'received_at') {
        orderBy.receivedAt = input.sortOrder;
      } else if (input.sortBy === 'response_time_minutes') {
        orderBy.responseTimeMinutes = input.sortOrder;
      }

      // Fetch requests with pagination
      const [requests, total] = await Promise.all([
        ctx.prisma.clientRequest.findMany({
          where,
          select: {
            id: true,
            chatId: true,
            messageId: true,
            messageText: true,
            clientUsername: true,
            receivedAt: true,
            assignedTo: true,
            responseAt: true,
            responseTimeMinutes: true,
            status: true,
            classification: true,
            threadId: true,
            createdAt: true,
            chat: {
              select: {
                title: true,
                clientTier: true,
              },
            },
            responseMessages: {
              select: {
                messageText: true,
                username: true,
              },
              take: 1,
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy,
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.clientRequest.count({ where }),
      ]);

      return {
        requests: requests.map((req) => ({
          ...req,
          chatId: safeNumberFromBigInt(req.chatId),
          messageId: safeNumberFromBigInt(req.messageId),
          responseMessage: req.responseMessages[0] ?? null,
        })),
        total,
      };
    }),

  /**
   * Get single request with related alerts
   *
   * @param id - Request UUID
   * @returns Request details with SLA alerts
   * @throws NOT_FOUND if request doesn't exist
   * @authorization All authenticated users (read-only)
   */
  getById: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .output(
      z.object({
        request: z.object({
          id: z.string().uuid(),
          chatId: z.number(),
          messageId: z.number(),
          messageText: z.string(),
          clientUsername: z.string().nullable(),
          receivedAt: z.date(),
          assignedTo: z.string().uuid().nullable(),
          responseAt: z.date().nullable(),
          responseTimeMinutes: z.number().int().nullable(),
          status: RequestStatusSchema,
          classification: MessageClassificationSchema,
          threadId: z.string().uuid().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
        }),
        alerts: z.array(
          z.object({
            id: z.string().uuid(),
            alertType: AlertTypeSchema,
            minutesElapsed: z.number().int(),
            alertSentAt: z.date(),
            acknowledgedAt: z.date().nullable(),
            acknowledgedBy: z.string().uuid().nullable(),
            resolutionNotes: z.string().nullable(),
          })
        ),
        responseMessage: z
          .object({
            id: z.string().uuid(),
            messageText: z.string(),
            username: z.string().nullable(),
            firstName: z.string().nullable(),
            lastName: z.string().nullable(),
            createdAt: z.date(),
          })
          .nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Fetch request with related alerts and response messages
      const request = await ctx.prisma.clientRequest.findUnique({
        where: { id: input.id },
        include: {
          slaAlerts: {
            select: {
              id: true,
              alertType: true,
              minutesElapsed: true,
              alertSentAt: true,
              acknowledgedAt: true,
              acknowledgedBy: true,
              resolutionNotes: true,
            },
            orderBy: {
              alertSentAt: 'desc',
            },
          },
          responseMessages: {
            select: {
              id: true,
              messageText: true,
              username: true,
              firstName: true,
              lastName: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
            take: 1, // Usually just one response
          },
        },
      });

      if (!request) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Request with ID ${input.id} not found`,
        });
      }

      // Authorization: observers can only view requests in chats assigned to them
      if (!['admin', 'manager'].includes(ctx.user.role)) {
        const chat = await ctx.prisma.chat.findUnique({
          where: { id: request.chatId },
          select: { assignedAccountantId: true },
        });
        if (chat) {
          requireChatAccess(ctx.user, chat);
        }
      }

      return {
        request: {
          id: request.id,
          chatId: safeNumberFromBigInt(request.chatId),
          messageId: safeNumberFromBigInt(request.messageId),
          messageText: request.messageText,
          clientUsername: request.clientUsername,
          receivedAt: request.receivedAt,
          assignedTo: request.assignedTo,
          responseAt: request.responseAt,
          responseTimeMinutes: request.responseTimeMinutes,
          status: request.status,
          classification: request.classification,
          threadId: request.threadId,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        },
        alerts: request.slaAlerts,
        responseMessage: request.responseMessages[0] ?? null,
      };
    }),

  /**
   * Update request status or assignment
   *
   * @param id - Request UUID
   * @param assignedTo - Assign request to accountant (null to unassign)
   * @param status - Update request status
   * @returns Updated request details
   * @throws NOT_FOUND if request doesn't exist
   * @authorization Admins and managers only
   */
  update: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        assignedTo: z.string().uuid().nullable().optional(),
        status: RequestStatusSchema.optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        request: z.object({
          id: z.string().uuid(),
          assignedTo: z.string().uuid().nullable(),
          status: RequestStatusSchema,
          updatedAt: z.date(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify request exists before updating
      const existingRequest = await ctx.prisma.clientRequest.findUnique({
        where: { id: input.id },
      });

      if (!existingRequest) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Request with ID ${input.id} not found`,
        });
      }

      // Build update data from optional fields
      const data: Prisma.ClientRequestUncheckedUpdateInput = {};
      if (input.assignedTo !== undefined) {
        data.assignedTo = input.assignedTo;
      }
      if (input.status !== undefined) {
        data.status = input.status;
      }

      // Update request
      const updatedRequest = await ctx.prisma.clientRequest.update({
        where: { id: input.id },
        data,
        select: {
          id: true,
          assignedTo: true,
          status: true,
          updatedAt: true,
        },
      });

      return {
        success: true,
        request: updatedRequest,
      };
    }),

  /**
   * Update request classification
   *
   * @param id - Request UUID
   * @param classification - Message classification (REQUEST, SPAM, GRATITUDE, CLARIFICATION)
   * @returns Success indicator
   * @throws NOT_FOUND if request doesn't exist
   * @authorization Admins and managers only
   */
  updateClassification: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        classification: z.enum(['REQUEST', 'SPAM', 'GRATITUDE', 'CLARIFICATION']),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify request exists before updating
      const existingRequest = await ctx.prisma.clientRequest.findUnique({
        where: { id: input.id },
        select: { classification: true, messageText: true },
      });

      if (!existingRequest) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Request with ID ${input.id} not found`,
        });
      }

      // Only record correction if classification actually changed
      if (existingRequest.classification !== input.classification) {
        // Record correction for feedback loop (gh-73)
        await ctx.prisma.classificationCorrection
          .create({
            data: {
              requestId: input.id,
              messageText: existingRequest.messageText,
              originalClass: existingRequest.classification,
              correctedClass: input.classification,
              correctedBy: ctx.user.id,
            },
          })
          .catch((err: unknown) => {
            // Non-blocking: don't fail the update if correction recording fails
            logger.error('Failed to record classification correction', {
              error: err instanceof Error ? err.message : String(err),
              requestId: input.id,
              service: 'requests-router',
            });
          });
      }

      // Update classification
      await ctx.prisma.clientRequest.update({
        where: { id: input.id },
        data: {
          classification: input.classification,
        },
      });

      return {
        success: true,
      };
    }),

  /**
   * Delete a client request
   *
   * @param id - Request UUID
   * @returns Success indicator
   * @throws NOT_FOUND if request doesn't exist
   * @authorization Admins only
   */
  delete: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify request exists before deleting
      const existingRequest = await ctx.prisma.clientRequest.findUnique({
        where: { id: input.id },
        include: { slaAlerts: true },
      });

      if (!existingRequest) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Request with ID ${input.id} not found`,
        });
      }

      // Use transaction for consistency
      await ctx.prisma.$transaction(async (tx) => {
        // 1. Delete related SLA alerts
        if (existingRequest.slaAlerts.length > 0) {
          await tx.slaAlert.deleteMany({
            where: { requestId: input.id },
          });
        }

        // 2. Delete client's message from chat history
        await tx.chatMessage.deleteMany({
          where: {
            chatId: existingRequest.chatId,
            messageId: existingRequest.messageId,
          },
        });

        // 3. Delete accountant's response from chat history (if exists)
        if (existingRequest.responseMessageId) {
          await tx.chatMessage.deleteMany({
            where: {
              chatId: existingRequest.chatId,
              messageId: existingRequest.responseMessageId,
            },
          });
        }

        // 4. Delete the request
        await tx.clientRequest.delete({
          where: { id: input.id },
        });
      });

      return {
        success: true,
      };
    }),

  /**
   * Get request history (audit trail) (gh-70)
   */
  getHistory: authedProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          field: z.string(),
          oldValue: z.string().nullable(),
          newValue: z.string().nullable(),
          changedBy: z.string().nullable(),
          changedAt: z.date(),
          reason: z.string().nullable(),
        })
      )
    )
    .query(async ({ ctx, input }) => {
      // Authorization: observers can only view history for requests in their chats
      if (!['admin', 'manager'].includes(ctx.user.role)) {
        const request = await ctx.prisma.clientRequest.findUnique({
          where: { id: input.requestId },
          select: { chatId: true },
        });
        if (request) {
          const chat = await ctx.prisma.chat.findUnique({
            where: { id: request.chatId },
            select: { assignedAccountantId: true },
          });
          if (chat) {
            requireChatAccess(ctx.user, chat);
          }
        }
      }

      return ctx.prisma.requestHistory.findMany({
        where: { requestId: input.requestId },
        orderBy: { changedAt: 'desc' },
        take: input.limit,
      });
    }),

  /**
   * Get all requests in a conversation thread (gh-75)
   *
   * @param threadId - Thread UUID
   * @returns Ordered list of requests in the thread
   * @authorization All authenticated users (read-only)
   */
  getThread: authedProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          messageText: z.string(),
          clientUsername: z.string().nullable(),
          receivedAt: z.date(),
          status: RequestStatusSchema,
          parentMessageId: z.number().nullable(),
        })
      )
    )
    .query(async ({ ctx, input }) => {
      // Authorization: observers can only view threads in their chats
      if (!['admin', 'manager'].includes(ctx.user.role)) {
        const firstRequest = await ctx.prisma.clientRequest.findFirst({
          where: { threadId: input.threadId },
          select: { chatId: true },
        });
        if (firstRequest) {
          const chat = await ctx.prisma.chat.findUnique({
            where: { id: firstRequest.chatId },
            select: { assignedAccountantId: true },
          });
          if (chat) {
            requireChatAccess(ctx.user, chat);
          }
        }
      }

      const requests = await ctx.prisma.clientRequest.findMany({
        where: { threadId: input.threadId },
        orderBy: { receivedAt: 'asc' },
        select: {
          id: true,
          messageText: true,
          clientUsername: true,
          receivedAt: true,
          status: true,
          parentMessageId: true,
        },
      });

      return requests.map((r) => ({
        ...r,
        parentMessageId: r.parentMessageId ? Number(r.parentMessageId) : null,
      }));
    }),

  /**
   * Get classification correction statistics for feedback loop (gh-73)
   *
   * @param startDate - Filter corrections from date (inclusive)
   * @param endDate - Filter corrections to date (inclusive)
   * @returns Total corrections count and breakdown by original -> corrected class
   * @authorization Admins and managers only
   */
  getClassificationStats: managerProcedure
    .input(
      z.object({
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      })
    )
    .output(
      z.object({
        totalCorrections: z.number().int(),
        correctionsByType: z.array(
          z.object({
            originalClass: z.string(),
            correctedClass: z.string(),
            count: z.number().int(),
          })
        ),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, Record<string, Date>> = {};
      if (input.startDate || input.endDate) {
        where['correctedAt'] = {};
        if (input.startDate) where['correctedAt']['gte'] = input.startDate;
        if (input.endDate) where['correctedAt']['lte'] = input.endDate;
      }

      const corrections = await ctx.prisma.classificationCorrection.findMany({
        where,
        select: {
          originalClass: true,
          correctedClass: true,
        },
      });

      // Group by original -> corrected
      const grouped = new Map<string, number>();
      for (const c of corrections) {
        const key = `${c.originalClass}\u2192${c.correctedClass}`;
        grouped.set(key, (grouped.get(key) ?? 0) + 1);
      }

      const correctionsByType = Array.from(grouped.entries())
        .map(([key, count]) => {
          const [originalClass, correctedClass] = key.split('\u2192');
          return { originalClass: originalClass!, correctedClass: correctedClass!, count };
        })
        .sort((a, b) => b.count - a.count);

      return {
        totalCorrections: corrections.length,
        correctionsByType,
      };
    }),

  /**
   * Get classifier feedback analysis with pattern detection and keyword suggestions (gh-73)
   *
   * Analyzes classification corrections to identify misclassification patterns,
   * generate keyword suggestions for the keyword classifier, and calculate
   * accuracy metrics.
   *
   * @param daysSince - Number of days to analyze (default: 30, max: 365)
   * @returns Feedback analysis with patterns, suggestions, and accuracy
   * @authorization Admins and managers only
   */
  getClassificationFeedback: managerProcedure
    .input(
      z
        .object({
          daysSince: z.number().int().min(1).max(365).default(30),
        })
        .default({})
    )
    .output(
      z.object({
        totalCorrections: z.number().int(),
        topMisclassifications: z.array(
          z.object({
            from: z.string(),
            to: z.string(),
            count: z.number().int(),
            examples: z.array(z.string()),
          })
        ),
        suggestedKeywords: z.array(
          z.object({
            category: z.string(),
            keyword: z.string(),
            confidence: z.number(),
            occurrences: z.number().int(),
          })
        ),
        classificationAccuracy: z.number(),
        misclassificationRates: z.array(
          z.object({
            category: z.string(),
            totalMisclassified: z.number().int(),
            mostCommonCorrection: z.string().nullable(),
            rate: z.number(),
          })
        ),
        analyzedDays: z.number().int(),
      })
    )
    .query(async ({ ctx, input }) => {
      const processor = new FeedbackProcessor(ctx.prisma);
      return processor.analyzePatterns(input.daysSince);
    }),
});

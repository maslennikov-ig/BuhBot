/**
 * Requests Router - Client Request Management & SLA Monitoring
 *
 * Procedures:
 * - list: List client requests with filtering and pagination
 * - getById: Get single request with related alerts
 * - update: Update request status or assignment
 * - updateClassification: Update request classification (REQUEST, SPAM, GRATITUDE, CLARIFICATION)
 *
 * @module api/trpc/routers/requests
 */

import { router, authedProcedure, managerProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { safeNumberFromBigInt } from '../../../utils/bigint.js';

/**
 * Request status schema (matches Prisma RequestStatus enum)
 */
const RequestStatusSchema = z.enum(['pending', 'in_progress', 'answered', 'escalated']);

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
            createdAt: z.date(),
            chat: z.object({
              title: z.string().nullable(),
            }),
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
            createdAt: true,
            chat: {
              select: {
                title: true,
              },
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
      });

      if (!existingRequest) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Request with ID ${input.id} not found`,
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

        // 2. Delete corresponding chat message (same chat_id + message_id)
        await tx.chatMessage.deleteMany({
          where: {
            chatId: existingRequest.chatId,
            messageId: existingRequest.messageId,
          },
        });

        // 3. Delete the request
        await tx.clientRequest.delete({
          where: { id: input.id },
        });
      });

      return {
        success: true,
      };
    }),
});

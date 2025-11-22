/**
 * Chats Router - Chat Management & Assignments
 *
 * Procedures:
 * - list: List all chats with optional filtering
 * - getById: Get single chat details
 * - update: Update chat settings (assignment, SLA config)
 *
 * @module api/trpc/routers/chats
 */

import { router, authedProcedure, managerProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

/**
 * Chat type schema (matches Prisma ChatType enum)
 */
const ChatTypeSchema = z.enum(['private', 'group', 'supergroup']);

/**
 * Chats router for chat management
 */
export const chatsRouter = router({
  /**
   * List all chats with optional filtering
   *
   * @param assignedTo - Filter by assigned accountant UUID
   * @param slaEnabled - Filter by SLA enabled status
   * @param limit - Page size (default: 50, max: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Paginated list of chats with total count
   * @authorization All authenticated users (read-only)
   */
  list: authedProcedure
    .input(
      z.object({
        assignedTo: z.string().uuid().optional(),
        slaEnabled: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .output(
      z.object({
        chats: z.array(
          z.object({
            id: z.number(),
            chatType: ChatTypeSchema,
            title: z.string().nullable(),
            accountantUsername: z.string().nullable(),
            assignedAccountantId: z.string().uuid().nullable(),
            slaEnabled: z.boolean(),
            slaResponseMinutes: z.number().int(),
            createdAt: z.date(),
          })
        ),
        total: z.number().int(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build where clause from filters
      const where: any = {};
      if (input.assignedTo !== undefined) {
        where.assignedAccountantId = input.assignedTo;
      }
      if (input.slaEnabled !== undefined) {
        where.slaEnabled = input.slaEnabled;
      }

      // Fetch chats with pagination
      const [chats, total] = await Promise.all([
        ctx.prisma.chat.findMany({
          where,
          select: {
            id: true,
            chatType: true,
            title: true,
            accountantUsername: true,
            assignedAccountantId: true,
            slaEnabled: true,
            slaResponseMinutes: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.chat.count({ where }),
      ]);

      return {
        chats: chats.map((chat: { id: bigint; chatType: 'private' | 'group' | 'supergroup'; title: string | null; accountantUsername: string | null; assignedAccountantId: string | null; slaEnabled: boolean; slaResponseMinutes: number; createdAt: Date }) => ({ ...chat, id: Number(chat.id) })),
        total,
      };
    }),

  /**
   * Get single chat details
   *
   * @param id - Chat ID (Telegram chat ID)
   * @returns Chat details
   * @throws NOT_FOUND if chat doesn't exist
   * @authorization All authenticated users (read-only)
   */
  getById: authedProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .output(
      z.object({
        id: z.number(),
        chatType: ChatTypeSchema,
        title: z.string().nullable(),
        accountantUsername: z.string().nullable(),
        assignedAccountantId: z.string().uuid().nullable(),
        slaEnabled: z.boolean(),
        slaResponseMinutes: z.number().int(),
        createdAt: z.date(),
        updatedAt: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const chat = await ctx.prisma.chat.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          chatType: true,
          title: true,
          accountantUsername: true,
          assignedAccountantId: true,
          slaEnabled: true,
          slaResponseMinutes: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat with ID ${input.id} not found`,
        });
      }

      return { ...chat, id: Number(chat.id) };
    }),

  /**
   * Update chat settings (assignment, SLA config)
   *
   * @param id - Chat ID
   * @param assignedAccountantId - Assign chat to accountant (null to unassign)
   * @param slaEnabled - Enable/disable SLA monitoring
   * @param slaResponseMinutes - SLA response time threshold (15-480 minutes)
   * @returns Updated chat details
   * @throws NOT_FOUND if chat doesn't exist
   * @authorization Admins and managers only
   */
  update: managerProcedure
    .input(
      z.object({
        id: z.number(),
        assignedAccountantId: z.string().uuid().nullable().optional(),
        slaEnabled: z.boolean().optional(),
        slaResponseMinutes: z.number().int().min(15).max(480).optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        chat: z.object({
          id: z.number(),
          assignedAccountantId: z.string().uuid().nullable(),
          slaEnabled: z.boolean(),
          slaResponseMinutes: z.number().int(),
          updatedAt: z.date(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify chat exists before updating
      const existingChat = await ctx.prisma.chat.findUnique({
        where: { id: input.id },
      });

      if (!existingChat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat with ID ${input.id} not found`,
        });
      }

      // Build update data from optional fields
      const data: any = {};
      if (input.assignedAccountantId !== undefined) {
        data.assignedAccountantId = input.assignedAccountantId;
      }
      if (input.slaEnabled !== undefined) {
        data.slaEnabled = input.slaEnabled;
      }
      if (input.slaResponseMinutes !== undefined) {
        data.slaResponseMinutes = input.slaResponseMinutes;
      }

      // Update chat
      const updatedChat = await ctx.prisma.chat.update({
        where: { id: input.id },
        data,
        select: {
          id: true,
          assignedAccountantId: true,
          slaEnabled: true,
          slaResponseMinutes: true,
          updatedAt: true,
        },
      });

      return {
        success: true,
        chat: { ...updatedChat, id: Number(updatedChat.id) },
      };
    }),
});

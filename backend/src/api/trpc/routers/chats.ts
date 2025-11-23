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

  /**
   * Update working schedule for a chat
   *
   * @param chatId - Chat ID (Telegram chat ID as string)
   * @param schedules - Array of schedule entries for each day
   * @param timezone - Timezone for the schedule (optional, defaults to Europe/Moscow)
   * @returns Updated schedules with Russian day names
   * @throws NOT_FOUND if chat doesn't exist
   * @authorization Admins and managers only
   */
  updateWorkingSchedule: managerProcedure
    .input(
      z.object({
        chatId: z.string(),
        schedules: z.array(
          z.object({
            dayOfWeek: z.number().min(1).max(7),
            startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
            endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
            isActive: z.boolean(),
          })
        ),
        timezone: z.string().optional(),
      })
    )
    .output(
      z.object({
        chatId: z.string(),
        schedules: z.array(
          z.object({
            id: z.string().uuid(),
            chatId: z.string(),
            dayOfWeek: z.number(),
            dayName: z.string(),
            startTime: z.string(),
            endTime: z.string(),
            isActive: z.boolean(),
            timezone: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Helper function for Russian day names
      const DAY_NAMES_RU = [
        'Понедельник',
        'Вторник',
        'Среда',
        'Четверг',
        'Пятница',
        'Суббота',
        'Воскресенье',
      ];
      const getDayName = (dayOfWeek: number) => DAY_NAMES_RU[dayOfWeek - 1] || 'Неизвестно';

      // Parse chatId from string to BigInt
      const chatIdBigInt = BigInt(input.chatId);

      // Verify chat exists
      const existingChat = await ctx.prisma.chat.findUnique({
        where: { id: chatIdBigInt },
      });

      if (!existingChat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat with ID ${input.chatId} not found`,
        });
      }

      // Default timezone
      const timezone = input.timezone || 'Europe/Moscow';

      // Helper to convert HH:MM string to Date for Prisma Time field
      const timeStringToDate = (time: string): Date => {
        return new Date(`1970-01-01T${time}:00Z`);
      };

      // Use transaction to delete existing and create new schedules
      const createdSchedules = await ctx.prisma.$transaction(async (tx) => {
        // Delete existing schedules for this chat
        await tx.workingSchedule.deleteMany({
          where: { chatId: chatIdBigInt },
        });

        // Create new schedules
        const schedules = await Promise.all(
          input.schedules.map((schedule) =>
            tx.workingSchedule.create({
              data: {
                chatId: chatIdBigInt,
                dayOfWeek: schedule.dayOfWeek,
                startTime: timeStringToDate(schedule.startTime),
                endTime: timeStringToDate(schedule.endTime),
                isActive: schedule.isActive,
                timezone,
              },
            })
          )
        );

        return schedules;
      });

      // Helper to format Date back to HH:MM string
      const dateToTimeString = (date: Date): string => {
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      };

      // Format output with Russian day names
      return {
        chatId: input.chatId,
        schedules: createdSchedules.map((schedule) => ({
          id: schedule.id,
          chatId: schedule.chatId.toString(),
          dayOfWeek: schedule.dayOfWeek,
          dayName: getDayName(schedule.dayOfWeek),
          startTime: dateToTimeString(schedule.startTime),
          endTime: dateToTimeString(schedule.endTime),
          isActive: schedule.isActive,
          timezone: schedule.timezone,
        })),
      };
    }),
});

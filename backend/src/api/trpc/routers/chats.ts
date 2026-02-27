/**
 * Chats Router - Chat Management & Assignments
 *
 * Procedures:
 * - list: List all chats with optional filtering
 * - getById: Get single chat details
 * - update: Update chat settings (assignment, SLA config)
 * - updateWorkingSchedule: Update working schedule for a chat
 * - registerChat: Register a new chat or update existing one
 * - createInvitation: Create a new chat invitation with deep link
 * - listInvitations: List chat invitations (own or all for admin)
 * - revokeInvitation: Delete/revoke a chat invitation
 *
 * @module api/trpc/routers/chats
 */

import { router, authedProcedure, managerProcedure } from '../trpc.js';
import { requireChatAccess } from '../authorization.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import logger from '../../../utils/logger.js';
import env, { isProduction } from '../../../config/env.js';
import { randomBytes } from 'crypto';
import { safeNumberFromBigInt } from '../../../utils/bigint.js';

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
        includeDisabled: z.boolean().default(false),
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
            accountantUsernames: z.array(z.string()),
            assignedAccountantId: z.string().uuid().nullable(),
            slaEnabled: z.boolean(),
            monitoringEnabled: z.boolean(),
            slaThresholdMinutes: z.number().int(),
            clientTier: z.enum(['basic', 'standard', 'vip', 'premium']),
            createdAt: z.date(),
          })
        ),
        total: z.number().int(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build where clause from filters
      const where: Prisma.ChatWhereInput = {};
      if (input.assignedTo !== undefined) {
        where.assignedAccountantId = input.assignedTo;
      }
      if (input.slaEnabled !== undefined) {
        where.slaEnabled = input.slaEnabled;
      }

      // Observer role: restrict to assigned chats only (gh-185)
      if (ctx.user.role === 'observer') {
        where.assignedAccountantId = ctx.user.id;
      }

      // Filter out disabled/migrated chats by default (gh-185)
      // Only admins/managers may opt in to see disabled chats
      const canSeeDisabled = ctx.user.role === 'admin' || ctx.user.role === 'manager';
      if (!input.includeDisabled || !canSeeDisabled) {
        where.monitoringEnabled = true;
      }

      // Always hide migrated chats (buh-5xx)
      where.isMigrated = false;

      // Always exclude soft-deleted chats from regular listing (gh-209)
      where.deletedAt = null;

      // Fetch chats with pagination
      const [chats, total] = await Promise.all([
        ctx.prisma.chat.findMany({
          where,
          select: {
            id: true,
            chatType: true,
            title: true,
            accountantUsernames: true,
            assignedAccountantId: true,
            slaEnabled: true,
            monitoringEnabled: true,
            slaThresholdMinutes: true,
            clientTier: true,
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
        chats: chats.map(
          (chat: {
            id: bigint;
            chatType: 'private' | 'group' | 'supergroup';
            title: string | null;
            accountantUsernames: string[];
            assignedAccountantId: string | null;
            slaEnabled: boolean;
            monitoringEnabled: boolean;
            slaThresholdMinutes: number;
            clientTier: 'basic' | 'standard' | 'vip' | 'premium';
            createdAt: Date;
          }) => ({
            ...chat,
            id: safeNumberFromBigInt(chat.id),
            accountantUsername: chat.accountantUsernames[0] ?? null,
          })
        ),
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
        accountantUsernames: z.array(z.string()),
        accountantTelegramIds: z.array(z.number()),
        assignedAccountantId: z.string().uuid().nullable(),
        slaEnabled: z.boolean(),
        slaThresholdMinutes: z.number().int(),
        clientTier: z.enum(['basic', 'standard', 'vip', 'premium']),
        managerTelegramIds: z.array(z.string()),
        notifyInChatOnBreach: z.boolean(),
        accountantVerification: z.array(
          z.object({
            username: z.string(),
            found: z.boolean(),
            hasTelegramId: z.boolean(),
          })
        ),
        deletedAt: z.date().nullable(),
        createdAt: z.date(),
        updatedAt: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Allow fetching soft-deleted chats so the UI can show restore banner (gh-209)
      const chat = await ctx.prisma.chat.findUnique({
        where: { id: BigInt(input.id) },
        select: {
          id: true,
          chatType: true,
          title: true,
          accountantUsernames: true,
          accountantTelegramIds: true,
          assignedAccountantId: true,
          slaEnabled: true,
          slaThresholdMinutes: true,
          clientTier: true,
          managerTelegramIds: true,
          notifyInChatOnBreach: true,
          deletedAt: true,
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

      requireChatAccess(ctx.user, chat);

      // Resolve verification status for accountant usernames
      let accountantVerification: { username: string; found: boolean; hasTelegramId: boolean }[] =
        [];
      if (chat.accountantUsernames.length > 0) {
        const users = await ctx.prisma.user.findMany({
          where: {
            telegramUsername: { in: chat.accountantUsernames, mode: 'insensitive' },
          },
          select: { telegramUsername: true, telegramId: true },
        });
        const userMap = new Map(users.map((u) => [u.telegramUsername?.toLowerCase() ?? '', u]));
        accountantVerification = chat.accountantUsernames.map((username) => {
          const user = userMap.get(username.toLowerCase());
          return {
            username,
            found: !!user,
            hasTelegramId: !!user?.telegramId,
          };
        });
      }

      return {
        ...chat,
        id: safeNumberFromBigInt(chat.id),
        accountantUsername: chat.accountantUsernames[0] ?? null,
        accountantTelegramIds: chat.accountantTelegramIds.map((id) => safeNumberFromBigInt(id)),
        accountantVerification,
        deletedAt: chat.deletedAt,
      };
    }),

  /**
   * Get chat details with recent messages
   *
   * @param id - Chat ID (Telegram chat ID)
   * @param messageLimit - Number of recent messages to fetch (default: 20, max: 100)
   * @returns Chat details with recent messages
   * @throws NOT_FOUND if chat doesn't exist
   * @authorization All authenticated users (read-only)
   */
  getByIdWithMessages: authedProcedure
    .input(
      z.object({
        id: z.number(),
        messageLimit: z.number().int().min(1).max(100).default(20),
      })
    )
    .output(
      z.object({
        chat: z.object({
          id: z.number(),
          chatType: ChatTypeSchema,
          title: z.string().nullable(),
          accountantUsername: z.string().nullable(),
          accountantUsernames: z.array(z.string()),
          assignedAccountantId: z.string().uuid().nullable(),
          slaEnabled: z.boolean(),
          slaThresholdMinutes: z.number().int(),
          createdAt: z.date(),
        }),
        messages: z.array(
          z.object({
            id: z.string().uuid(),
            messageId: z.number(),
            telegramUserId: z.number(),
            username: z.string().nullable(),
            firstName: z.string().nullable(),
            lastName: z.string().nullable(),
            messageText: z.string(),
            isAccountant: z.boolean(),
            createdAt: z.date(),
          })
        ),
      })
    )
    .query(async ({ ctx, input }) => {
      const chat = await ctx.prisma.chat.findFirst({
        where: { id: BigInt(input.id), deletedAt: null },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: input.messageLimit,
            select: {
              id: true,
              messageId: true,
              telegramUserId: true,
              username: true,
              firstName: true,
              lastName: true,
              messageText: true,
              isAccountant: true,
              createdAt: true,
            },
          },
        },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat with ID ${input.id} not found`,
        });
      }

      requireChatAccess(ctx.user, chat);

      return {
        chat: {
          id: safeNumberFromBigInt(chat.id),
          chatType: chat.chatType,
          title: chat.title,
          accountantUsername: chat.accountantUsernames[0] ?? null,
          accountantUsernames: chat.accountantUsernames,
          assignedAccountantId: chat.assignedAccountantId,
          slaEnabled: chat.slaEnabled,
          slaThresholdMinutes: chat.slaThresholdMinutes,
          createdAt: chat.createdAt,
        },
        messages: chat.messages
          .map((msg) => ({
            ...msg,
            messageId: safeNumberFromBigInt(msg.messageId),
            telegramUserId: safeNumberFromBigInt(msg.telegramUserId),
          }))
          .reverse(), // Return oldest first
      };
    }),

  /**
   * Update chat settings (assignment, SLA config)
   *
   * @param id - Chat ID
   * @param assignedAccountantId - Assign chat to accountant (null to unassign)
   * @param slaEnabled - Enable/disable SLA monitoring
   * @param slaThresholdMinutes - SLA response time threshold (15-480 minutes)
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
        slaThresholdMinutes: z.number().int().min(1).max(480).optional(),
        clientTier: z.enum(['basic', 'standard', 'vip', 'premium']).optional(),
        accountantUsernames: z
          .array(
            z
              .string()
              .transform((val) => (val.startsWith('@') ? val.slice(1) : val))
              .transform((val) => val.toLowerCase())
              .refine((val) => /^[a-z0-9][a-z0-9_]{3,30}[a-z0-9]$/.test(val), {
                message:
                  'Неверный формат username (5-32 символа, латиница, цифры, _, не начинается/заканчивается на _)',
              })
          )
          .max(20, 'Максимум 20 бухгалтеров')
          .default([]),
        managerTelegramIds: z
          .array(z.string().regex(/^\d+$/, 'Telegram ID должен быть числом'))
          .max(20, 'Максимум 20 менеджеров')
          .optional(),
        notifyInChatOnBreach: z.boolean().optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        chat: z.object({
          id: z.number(),
          assignedAccountantId: z.string().uuid().nullable(),
          slaEnabled: z.boolean(),
          slaThresholdMinutes: z.number().int(),
          clientTier: z.enum(['basic', 'standard', 'vip', 'premium']),
          notifyInChatOnBreach: z.boolean(),
          updatedAt: z.date(),
        }),
        warnings: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Use interactive transaction with row-level lock to prevent race condition (gh-111)
      return ctx.prisma.$transaction(
        async (tx) => {
          // Set lock timeout to prevent deadlocks (CR finding #2)
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;

          // Acquire row-level lock (SELECT FOR UPDATE prevents concurrent modification)
          // Exclude soft-deleted chats (gh-209)
          await tx.$queryRaw`SELECT id FROM "public"."chats" WHERE "id" = ${BigInt(input.id)} AND "deleted_at" IS NULL FOR UPDATE`;

          // Now safely read the locked row via Prisma
          const existingChat = await tx.chat.findFirst({
            where: { id: BigInt(input.id), deletedAt: null },
          });

          if (!existingChat) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Chat with ID ${input.id} not found`,
            });
          }

          // Hoist globalSettings query to avoid duplicate read (CR-006)
          const globalSettings = await tx.globalSettings.findUnique({
            where: { id: 'default' },
            select: { globalManagerIds: true },
          });
          const globalManagers = globalSettings?.globalManagerIds || [];

          // Validate: Cannot enable SLA without notification recipients configured
          if (input.slaEnabled === true && existingChat.slaEnabled === false) {
            const chatManagers =
              input.managerTelegramIds !== undefined
                ? input.managerTelegramIds
                : existingChat.managerTelegramIds || [];
            const accountantTgIds = existingChat.accountantTelegramIds || [];

            const hasRecipients =
              chatManagers.length > 0 || accountantTgIds.length > 0 || globalManagers.length > 0;

            if (!hasRecipients) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message:
                  'Невозможно включить SLA без настроенных получателей уведомлений. Добавьте бухгалтеров через @username или менеджеров в настройках.',
              });
            }
          }

          // Warn if SLA is active but no notification recipients configured (monitoring)
          if (
            (input.slaEnabled === true ||
              (input.slaEnabled === undefined && existingChat.slaEnabled)) &&
            existingChat.slaEnabled
          ) {
            const chatManagers = existingChat.managerTelegramIds || [];
            const accountantTgIds = existingChat.accountantTelegramIds || [];
            if (
              chatManagers.length === 0 &&
              accountantTgIds.length === 0 &&
              globalManagers.length === 0
            ) {
              logger.warn('Chat has SLA enabled but no notification recipients configured', {
                chatId: input.id,
                slaEnabled: true,
              });
            }
          }

          // Build update data from optional fields
          const data: Prisma.ChatUncheckedUpdateInput = {};
          if (input.assignedAccountantId !== undefined) {
            data.assignedAccountantId = input.assignedAccountantId;
          }
          if (input.slaEnabled !== undefined) {
            data.slaEnabled = input.slaEnabled;
          }
          if (input.slaThresholdMinutes !== undefined) {
            data.slaThresholdMinutes = input.slaThresholdMinutes;
          }
          if (input.clientTier !== undefined) {
            data.clientTier = input.clientTier;
          }
          if (input.managerTelegramIds !== undefined) {
            data.managerTelegramIds = input.managerTelegramIds;
          }
          if (input.notifyInChatOnBreach !== undefined) {
            // Security: Block enabling in-chat breach notifications in production
            // This setting leaks internal SLA data (breach time, accountant info) to client-facing chats
            if (input.notifyInChatOnBreach === true && isProduction()) {
              throw new TRPCError({
                code: 'FORBIDDEN',
                message:
                  'Уведомления о нарушениях SLA в чат запрещены в production-режиме. Эта функция предназначена только для тестирования.',
              });
            }
            data.notifyInChatOnBreach = input.notifyInChatOnBreach;
          }

          // Start with input usernames
          const finalUsernames = [...input.accountantUsernames];

          // AUTO-ADD: If assignedAccountantId is set, add their telegramUsername to list
          if (input.assignedAccountantId) {
            const assignedUser = await tx.user.findUnique({
              where: { id: input.assignedAccountantId },
              select: { telegramUsername: true },
            });

            if (assignedUser?.telegramUsername) {
              const normalizedUsername = assignedUser.telegramUsername
                .replace(/^@/, '')
                .toLowerCase();

              // Add to list if not already present
              if (!finalUsernames.includes(normalizedUsername)) {
                finalUsernames.push(normalizedUsername);
              }
            }
          }

          data.accountantUsernames = finalUsernames;

          // Validate usernames and auto-populate Telegram IDs (gh-68)
          const warnings: string[] = [];
          const telegramIdSet = new Set<bigint>(); // Use Set to prevent duplicates (CR finding #5)

          if (finalUsernames.length > 0) {
            const knownUsers = await tx.user.findMany({
              where: {
                telegramUsername: { in: finalUsernames, mode: 'insensitive' },
              },
              select: { telegramUsername: true, telegramId: true },
            });
            const knownSet = new Set(
              knownUsers.map((u) => u.telegramUsername?.toLowerCase()).filter(Boolean)
            );
            const unverified = finalUsernames.filter((u) => !knownSet.has(u.toLowerCase()));
            if (unverified.length > 0) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message:
                  `Пользователи не найдены в системе: ${unverified.map((u) => `@${u}`).join(', ')}. ` +
                  'Они должны быть зарегистрированы в панели администратора и привязать Telegram.',
              });
            }

            const noTelegramId = knownUsers.filter((u) => !u.telegramId);
            if (noTelegramId.length > 0) {
              warnings.push(
                `Пользователи без привязанного Telegram ID: ${noTelegramId.map((u) => `@${u.telegramUsername}`).join(', ')}. Уведомления не будут доставлены.`
              );
            }

            // Collect Telegram IDs from known users (gh-68)
            for (const user of knownUsers) {
              if (user.telegramId) {
                telegramIdSet.add(user.telegramId);
              }
            }
          }

          // Also add assigned accountant's Telegram ID if available
          if (input.assignedAccountantId) {
            const assignedUser = await tx.user.findUnique({
              where: { id: input.assignedAccountantId },
              select: { telegramId: true },
            });
            if (assignedUser?.telegramId) {
              telegramIdSet.add(assignedUser.telegramId);
            }
          }

          data.accountantTelegramIds = [...telegramIdSet];

          // Update chat (within same transaction, row is already locked)
          const updatedChat = await tx.chat.update({
            where: { id: BigInt(input.id) },
            data,
            select: {
              id: true,
              assignedAccountantId: true,
              slaEnabled: true,
              slaThresholdMinutes: true,
              clientTier: true,
              notifyInChatOnBreach: true,
              updatedAt: true,
            },
          });

          return {
            success: true,
            chat: { ...updatedChat, id: safeNumberFromBigInt(updatedChat.id) },
            warnings,
          };
        },
        { timeout: 10000 }
      ); // 10s Prisma timeout (gh-111, CR finding #2)
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

      // Verify chat exists and is not soft-deleted (gh-209)
      const existingChat = await ctx.prisma.chat.findFirst({
        where: { id: chatIdBigInt, deletedAt: null },
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

  /**
   * Register a new chat or update existing one
   *
   * @param telegramChatId - Telegram chat ID as string
   * @param chatType - Type of chat (private, group, supergroup)
   * @param title - Chat title (optional)
   * @param accountantUsername - Accountant username (optional, added to accountantUsernames array)
   * @returns Created or updated chat details
   * @authorization Admins and managers only
   */
  registerChat: managerProcedure
    .input(
      z.object({
        telegramChatId: z.string(),
        chatType: ChatTypeSchema,
        title: z.string().optional(),
        accountantUsername: z.string().optional(),
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
        slaThresholdMinutes: z.number().int(),
        clientTier: z.enum(['basic', 'standard', 'vip', 'premium']),
        createdAt: z.date(),
        updatedAt: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Parse telegramChatId to BigInt for the id field
      const chatId = BigInt(input.telegramChatId);

      // Fetch default SLA threshold from GlobalSettings
      const globalSettings = await ctx.prisma.globalSettings.findUnique({
        where: { id: 'default' },
        select: { defaultSlaThreshold: true },
      });
      const defaultThreshold = globalSettings?.defaultSlaThreshold ?? 60;

      // Build accountantUsernames array from the provided username
      const accountantUsernames: string[] = input.accountantUsername
        ? [input.accountantUsername]
        : [];

      // Upsert: create if not exists, update if exists
      const chat = await ctx.prisma.chat.upsert({
        where: { id: chatId },
        update: {
          // Update title if provided
          ...(input.title !== undefined && { title: input.title }),
          // Add accountant to usernames array if provided
          ...(input.accountantUsername !== undefined && {
            accountantUsernames: accountantUsernames,
          }),
          chatType: input.chatType,
          // Clear soft-delete if re-registering a deleted chat (gh-209)
          deletedAt: null,
        },
        create: {
          id: chatId,
          chatType: input.chatType,
          title: input.title ?? null,
          accountantUsernames,
          // Defaults from Prisma schema
          slaEnabled: true,
          slaThresholdMinutes: defaultThreshold,
          monitoringEnabled: true,
          is24x7Mode: false,
          managerTelegramIds: [],
          notifyInChatOnBreach: false, // Security: disabled by default to prevent leaking alerts to client chats
        },
        select: {
          id: true,
          chatType: true,
          title: true,
          accountantUsernames: true,
          assignedAccountantId: true,
          slaEnabled: true,
          slaThresholdMinutes: true,
          clientTier: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        ...chat,
        id: safeNumberFromBigInt(chat.id),
        accountantUsername: chat.accountantUsernames[0] ?? null,
      };
    }),

  /**
   * Create a new chat invitation
   *
   * @param initialTitle - Optional pre-defined title for the chat
   * @param assignedAccountantId - Optional UUID of accountant to assign
   * @param expiresInHours - Hours until invitation expires (default: 72)
   * @returns Invitation details with deep link and connect command
   * @authorization Admins and managers only
   */
  createInvitation: managerProcedure
    .input(
      z.object({
        initialTitle: z.string().optional(),
        assignedAccountantId: z.string().uuid().optional(),
        expiresInHours: z.number().int().min(1).max(720).default(72),
      })
    )
    .output(
      z.object({
        id: z.string().uuid(),
        token: z.string(),
        deepLink: z.string(),
        groupLink: z.string(),
        connectCommand: z.string(),
        expiresAt: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Generate secure random token
      const token = randomBytes(16).toString('base64url');

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + input.expiresInHours);

      // Create invitation
      const invitation = await ctx.prisma.chatInvitation.create({
        data: {
          token,
          initialTitle: input.initialTitle ?? null,
          assignedAccountantId: input.assignedAccountantId ?? null,
          createdBy: ctx.user.id,
          expiresAt,
        },
        select: {
          id: true,
          token: true,
          expiresAt: true,
        },
      });

      // Get bot username from validated env (required for deep links)
      const botUsername = env.BOT_USERNAME;
      if (!botUsername) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'BOT_USERNAME environment variable is not configured',
        });
      }

      return {
        id: invitation.id,
        token: invitation.token,
        deepLink: `https://t.me/${botUsername}?start=${invitation.token}`,
        groupLink: `https://t.me/${botUsername}?startgroup=${invitation.token}&admin=manage_chat`,
        connectCommand: `/connect ${invitation.token}`,
        expiresAt: invitation.expiresAt,
      };
    }),

  /**
   * List chat invitations
   *
   * @param includeUsed - Include used invitations (default: false)
   * @param limit - Page size (default: 50, max: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Paginated list of invitations created by current user (or all for admin)
   * @authorization All authenticated users (managers see only their own, admins see all)
   */
  listInvitations: authedProcedure
    .input(
      z.object({
        includeUsed: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .output(
      z.object({
        invitations: z.array(
          z.object({
            id: z.string().uuid(),
            token: z.string(),
            initialTitle: z.string().nullable(),
            isUsed: z.boolean(),
            usedAt: z.date().nullable(),
            expiresAt: z.date(),
            createdAt: z.date(),
          })
        ),
        total: z.number().int(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build where clause
      const where: Prisma.ChatInvitationWhereInput = {};

      // Filter by creator (non-admin users can only see their own)
      if (ctx.user.role !== 'admin') {
        where.createdBy = ctx.user.id;
      }

      // Filter by used status
      if (!input.includeUsed) {
        where.isUsed = false;
      }

      // Fetch invitations with pagination
      const [invitations, total] = await Promise.all([
        ctx.prisma.chatInvitation.findMany({
          where,
          select: {
            id: true,
            token: true,
            initialTitle: true,
            isUsed: true,
            usedAt: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.chatInvitation.count({ where }),
      ]);

      return {
        invitations,
        total,
      };
    }),

  /**
   * Revoke a chat invitation
   *
   * @param id - Invitation UUID to revoke
   * @returns Success status
   * @throws NOT_FOUND if invitation doesn't exist
   * @throws FORBIDDEN if user is not creator and not admin
   * @authorization Creator or admin only
   */
  revokeInvitation: authedProcedure
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
      // Fetch invitation to verify ownership
      const invitation = await ctx.prisma.chatInvitation.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          createdBy: true,
          isUsed: true,
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Invitation with ID ${input.id} not found`,
        });
      }

      // Check authorization: only creator or admin can revoke
      if (ctx.user.role !== 'admin' && invitation.createdBy !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only revoke invitations you created',
        });
      }

      // Delete the invitation
      await ctx.prisma.chatInvitation.delete({
        where: { id: input.id },
      });

      return {
        success: true,
      };
    }),

  /**
   * Delete a chat and all related data
   *
   * @param id - Chat ID (Telegram chat ID)
   * @returns Success status
   * @throws NOT_FOUND if chat doesn't exist
   * @authorization Admins only
   */
  delete: managerProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const chatId = BigInt(input.id);

      // Verify chat exists and is not already soft-deleted (gh-209)
      const chat = await ctx.prisma.chat.findFirst({
        where: { id: chatId, deletedAt: null },
        select: { id: true },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat with ID ${input.id} not found`,
        });
      }

      // Soft-delete: set deletedAt timestamp instead of hard-deleting (gh-209)
      await ctx.prisma.chat.update({
        where: { id: chatId },
        data: {
          deletedAt: new Date(),
          monitoringEnabled: false, // Stop monitoring
          slaEnabled: false, // Stop SLA
        },
      });

      logger.info('[Audit] Chat soft-deleted', {
        chatId: input.id,
        userId: ctx.user.id,
      });

      return {
        success: true,
      };
    }),

  /**
   * Restore a soft-deleted chat
   *
   * @param id - Chat ID (Telegram chat ID)
   * @returns Success status
   * @throws NOT_FOUND if soft-deleted chat doesn't exist
   * @authorization Admins and managers only
   */
  restore: managerProcedure
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const chatId = BigInt(input.id);

      // Find soft-deleted chat (must bypass deletedAt: null filter)
      const chat = await ctx.prisma.chat.findFirst({
        where: { id: chatId, deletedAt: { not: null } },
        select: { id: true },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Удалённый чат с ID ${input.id} не найден`,
        });
      }

      await ctx.prisma.chat.update({
        where: { id: chatId },
        data: { deletedAt: null },
      });

      logger.info('[Audit] Chat restored from soft-delete', {
        chatId: input.id,
        userId: ctx.user.id,
      });

      return { success: true };
    }),

  /**
   * List soft-deleted chats
   *
   * @param limit - Page size (default: 50, max: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Paginated list of soft-deleted chats with total count
   * @authorization Admins and managers only
   */
  listDeleted: managerProcedure
    .input(
      z.object({
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
            deletedAt: z.date(),
            createdAt: z.date(),
          })
        ),
        total: z.number().int(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [chats, total] = await Promise.all([
        ctx.prisma.chat.findMany({
          where: { deletedAt: { not: null } },
          select: {
            id: true,
            chatType: true,
            title: true,
            deletedAt: true,
            createdAt: true,
          },
          orderBy: { deletedAt: 'desc' },
          skip: input.offset,
          take: input.limit,
        }),
        ctx.prisma.chat.count({
          where: { deletedAt: { not: null } },
        }),
      ]);

      return {
        chats: chats.map((c) => ({
          id: Number(c.id),
          chatType: c.chatType,
          title: c.title,
          deletedAt: c.deletedAt!,
          createdAt: c.createdAt,
        })),
        total,
      };
    }),
});

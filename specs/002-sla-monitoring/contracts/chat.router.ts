/**
 * Chat Router Contract
 *
 * tRPC router для управления мониторируемыми чатами.
 * Используется Admin Panel для CRUD операций над чатами.
 *
 * @module contracts/chat.router
 */

import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const GetChatsInput = z.object({
  accountantId: z.string().uuid().optional(),
  monitoringEnabled: z.boolean().optional(),
  slaBreached: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export const GetChatByIdInput = z.object({
  chatId: z.string(),
});

export const UpdateChatInput = z.object({
  chatId: z.string(),
  assignedAccountantId: z.string().uuid().nullable().optional(),
  slaThresholdMinutes: z.number().min(1).max(480).optional(),
  monitoringEnabled: z.boolean().optional(),
  is24x7Mode: z.boolean().optional(),
  managerTelegramIds: z.array(z.string()).optional(),
});

export const RegisterChatInput = z.object({
  telegramChatId: z.string(),
  chatType: z.enum(['private', 'group', 'supergroup']),
  title: z.string().optional(),
  accountantUsername: z.string().optional(),
});

// ============================================================================
// WORKING SCHEDULE SCHEMAS
// ============================================================================

export const WorkingScheduleInput = z.object({
  chatId: z.string(),
  dayOfWeek: z.number().min(1).max(7), // 1=Mon, 7=Sun
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  isActive: z.boolean().default(true),
  timezone: z.string().default('Europe/Moscow'),
});

export const UpdateWorkingScheduleInput = z.object({
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
});

export const AddChatHolidayInput = z.object({
  chatId: z.string(),
  date: z.date(),
  description: z.string().optional(),
});

export const RemoveChatHolidayInput = z.object({
  chatId: z.string(),
  date: z.date(),
});

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

export const WorkingScheduleOutput = z.object({
  id: z.string().uuid(),
  chatId: z.string(),
  dayOfWeek: z.number(),
  dayName: z.string(), // "Понедельник", "Вторник", etc.
  startTime: z.string(),
  endTime: z.string(),
  isActive: z.boolean(),
  timezone: z.string(),
});

export const ChatHolidayOutput = z.object({
  id: z.string().uuid(),
  date: z.date(),
  description: z.string().nullable(),
});

export const ChatOutput = z.object({
  id: z.string(),
  telegramChatId: z.string(),
  chatType: z.enum(['private', 'group', 'supergroup']),
  title: z.string().nullable(),

  // Accountant
  assignedAccountantId: z.string().uuid().nullable(),
  assignedAccountantName: z.string().nullable(),
  accountantUsername: z.string().nullable(),

  // SLA Config
  slaThresholdMinutes: z.number(),
  monitoringEnabled: z.boolean(),
  is24x7Mode: z.boolean(),

  // Manager override
  managerTelegramIds: z.array(z.string()),

  // Stats (optional, for list view)
  activeRequestsCount: z.number().optional(),
  todayBreachesCount: z.number().optional(),
  avgResponseMinutes: z.number().nullable().optional(),

  // Working Schedule
  workingSchedules: z.array(WorkingScheduleOutput).optional(),
  holidays: z.array(ChatHolidayOutput).optional(),

  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ChatListOutput = z.object({
  items: z.array(ChatOutput),
  total: z.number(),
  hasMore: z.boolean(),
});

// ============================================================================
// ROUTER DEFINITION (tRPC Contract)
// ============================================================================

/**
 * Chat Router Procedures:
 *
 * Mutations:
 * - registerChat: Зарегистрировать новый чат для мониторинга
 * - updateChat: Обновить настройки чата (SLA, accountant, etc.)
 * - updateWorkingSchedule: Обновить расписание рабочих часов
 * - addHoliday: Добавить праздничный день для чата
 * - removeHoliday: Удалить праздничный день
 *
 * Queries:
 * - getChats: Получить список чатов с фильтрами
 * - getChatById: Получить детали чата
 * - getWorkingSchedule: Получить расписание чата
 * - getHolidays: Получить праздники чата
 */

export const chatRouterContract = {
  // Mutations
  registerChat: {
    input: RegisterChatInput,
    output: ChatOutput,
    description: 'Зарегистрировать новый Telegram чат для мониторинга',
  },

  updateChat: {
    input: UpdateChatInput,
    output: ChatOutput,
    description: 'Обновить настройки чата (SLA порог, бухгалтер, мониторинг)',
  },

  updateWorkingSchedule: {
    input: UpdateWorkingScheduleInput,
    output: z.object({
      chatId: z.string(),
      schedules: z.array(WorkingScheduleOutput),
    }),
    description: 'Обновить расписание рабочих часов для чата',
  },

  addHoliday: {
    input: AddChatHolidayInput,
    output: ChatHolidayOutput,
    description: 'Добавить праздничный день для чата',
  },

  removeHoliday: {
    input: RemoveChatHolidayInput,
    output: z.object({ success: z.boolean() }),
    description: 'Удалить праздничный день',
  },

  // Queries
  getChats: {
    input: GetChatsInput,
    output: ChatListOutput,
    description: 'Получить список мониторируемых чатов',
  },

  getChatById: {
    input: GetChatByIdInput,
    output: ChatOutput,
    description: 'Получить детали чата с расписанием и праздниками',
  },

  getWorkingSchedule: {
    input: z.object({ chatId: z.string() }),
    output: z.array(WorkingScheduleOutput),
    description: 'Получить расписание рабочих часов чата',
  },

  getHolidays: {
    input: z.object({
      chatId: z.string(),
      year: z.number().optional(),
    }),
    output: z.array(ChatHolidayOutput),
    description: 'Получить праздничные дни чата',
  },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type GetChatsInput = z.infer<typeof GetChatsInput>;
export type ChatOutput = z.infer<typeof ChatOutput>;
export type ChatListOutput = z.infer<typeof ChatListOutput>;
export type WorkingScheduleOutput = z.infer<typeof WorkingScheduleOutput>;
export type ChatHolidayOutput = z.infer<typeof ChatHolidayOutput>;

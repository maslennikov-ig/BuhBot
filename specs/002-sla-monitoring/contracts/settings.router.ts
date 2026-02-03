/**
 * Settings Router Contract
 *
 * tRPC router для глобальных настроек системы.
 * Используется Admin Panel для конфигурации SLA, рабочих часов, праздников.
 *
 * @module contracts/settings.router
 */

import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const UpdateGlobalSettingsInput = z.object({
  // Working Hours Defaults
  defaultTimezone: z.string().optional(),
  defaultWorkingDays: z.array(z.number().min(1).max(7)).optional(),
  defaultStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  defaultEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),

  // SLA Defaults
  defaultSlaThreshold: z.number().min(1).max(480).optional(),
  maxEscalations: z.number().min(1).max(10).optional(),
  escalationIntervalMin: z.number().min(5).max(120).optional(),

  // Manager Alerts
  globalManagerIds: z.array(z.string()).optional(),

  // AI Classification
  aiConfidenceThreshold: z.number().min(0).max(1).optional(),
  messagePreviewLength: z.number().min(100).max(1000).optional(),

  // Data Retention
  dataRetentionYears: z.number().min(1).max(10).optional(),
});

export const AddGlobalHolidayInput = z.object({
  date: z.date(),
  name: z.string().max(100),
  year: z.number().min(2024).max(2030),
});

export const RemoveGlobalHolidayInput = z.object({
  date: z.date(),
});

export const BulkAddHolidaysInput = z.object({
  year: z.number().min(2024).max(2030),
  holidays: z.array(
    z.object({
      date: z.date(),
      name: z.string().max(100),
    })
  ),
});

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

export const GlobalSettingsOutput = z.object({
  // Working Hours Defaults
  defaultTimezone: z.string(),
  defaultWorkingDays: z.array(z.number()),
  defaultWorkingDaysDisplay: z.array(z.string()), // ["Пн", "Вт", "Ср", "Чт", "Пт"]
  defaultStartTime: z.string(),
  defaultEndTime: z.string(),

  // SLA Defaults
  defaultSlaThreshold: z.number(),
  maxEscalations: z.number(),
  escalationIntervalMin: z.number(),

  // Manager Alerts
  globalManagerIds: z.array(z.string()),
  globalManagerCount: z.number(),

  // AI Classification
  aiConfidenceThreshold: z.number(),
  messagePreviewLength: z.number(),

  // Data Retention
  dataRetentionYears: z.number(),

  // Meta
  updatedAt: z.date(),
});

export const GlobalHolidayOutput = z.object({
  id: z.string().uuid(),
  date: z.date(),
  name: z.string(),
  year: z.number(),
  createdAt: z.date(),
});

export const HolidayListOutput = z.object({
  items: z.array(GlobalHolidayOutput),
  total: z.number(),
});

// ============================================================================
// ROUTER DEFINITION (tRPC Contract)
// ============================================================================

/**
 * Settings Router Procedures:
 *
 * Mutations:
 * - updateGlobalSettings: Обновить глобальные настройки
 * - addGlobalHoliday: Добавить федеральный праздник
 * - removeGlobalHoliday: Удалить праздник
 * - bulkAddHolidays: Добавить праздники за год (batch)
 * - seedRussianHolidays: Заполнить праздниками РФ на год
 *
 * Queries:
 * - getGlobalSettings: Получить текущие настройки
 * - getGlobalHolidays: Получить список праздников
 */

export const settingsRouterContract = {
  // Mutations
  updateGlobalSettings: {
    input: UpdateGlobalSettingsInput,
    output: GlobalSettingsOutput,
    description: 'Обновить глобальные настройки системы (admin only)',
  },

  addGlobalHoliday: {
    input: AddGlobalHolidayInput,
    output: GlobalHolidayOutput,
    description: 'Добавить федеральный праздник',
  },

  removeGlobalHoliday: {
    input: RemoveGlobalHolidayInput,
    output: z.object({ success: z.boolean() }),
    description: 'Удалить праздник',
  },

  bulkAddHolidays: {
    input: BulkAddHolidaysInput,
    output: z.object({
      added: z.number(),
      skipped: z.number(),
    }),
    description: 'Добавить несколько праздников за раз',
  },

  seedRussianHolidays: {
    input: z.object({
      year: z.number().min(2024).max(2030),
    }),
    output: z.object({
      added: z.number(),
      holidays: z.array(GlobalHolidayOutput),
    }),
    description: 'Заполнить федеральными праздниками РФ на указанный год',
  },

  // Queries
  getGlobalSettings: {
    input: z.object({}),
    output: GlobalSettingsOutput,
    description: 'Получить текущие глобальные настройки',
  },

  getGlobalHolidays: {
    input: z.object({
      year: z.number().optional(),
    }),
    output: HolidayListOutput,
    description: 'Получить список федеральных праздников',
  },
} as const;

// ============================================================================
// PREDEFINED RUSSIAN HOLIDAYS
// ============================================================================

/**
 * Russian Federal Holidays template for seeding.
 * Dates are relative to year.
 */
export const RUSSIAN_HOLIDAYS_TEMPLATE = [
  // New Year holidays
  { month: 1, day: 1, name: 'Новый год' },
  { month: 1, day: 2, name: 'Новогодние каникулы' },
  { month: 1, day: 3, name: 'Новогодние каникулы' },
  { month: 1, day: 4, name: 'Новогодние каникулы' },
  { month: 1, day: 5, name: 'Новогодние каникулы' },
  { month: 1, day: 6, name: 'Новогодние каникулы' },
  { month: 1, day: 7, name: 'Рождество Христово' },
  { month: 1, day: 8, name: 'Новогодние каникулы' },

  // Defender of the Fatherland Day
  { month: 2, day: 23, name: 'День защитника Отечества' },

  // International Women's Day
  { month: 3, day: 8, name: 'Международный женский день' },

  // Spring and Labour Day
  { month: 5, day: 1, name: 'Праздник Весны и Труда' },

  // Victory Day
  { month: 5, day: 9, name: 'День Победы' },

  // Russia Day
  { month: 6, day: 12, name: 'День России' },

  // Unity Day
  { month: 11, day: 4, name: 'День народного единства' },
] as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type GlobalSettingsOutput = z.infer<typeof GlobalSettingsOutput>;
export type GlobalHolidayOutput = z.infer<typeof GlobalHolidayOutput>;
export type HolidayListOutput = z.infer<typeof HolidayListOutput>;

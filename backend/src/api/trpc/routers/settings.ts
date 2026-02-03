/**
 * Settings Router - Global Settings & Holidays Management
 *
 * Manages global system configuration including working hours defaults,
 * SLA thresholds, AI classification settings, and federal holidays calendar.
 *
 * Procedures:
 * Queries:
 * - getGlobalSettings: Get current global settings (authed)
 * - getGlobalHolidays: Get list of holidays with optional year filter (authed)
 *
 * Mutations (admin only):
 * - updateGlobalSettings: Update global settings
 * - addGlobalHoliday: Add a new holiday
 * - removeGlobalHoliday: Remove a holiday by ID
 * - bulkAddHolidays: Add multiple holidays at once
 * - seedRussianHolidays: Seed Russian federal holidays for a year
 *
 * @module api/trpc/routers/settings
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, authedProcedure, adminProcedure } from '../trpc.js';
import { validateBotToken } from '../../../services/telegram/validation.js';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Schema for updating global settings
 * All fields are optional - only provided fields will be updated
 */
const UpdateGlobalSettingsInput = z.object({
  // Working Hours Defaults
  defaultTimezone: z.string().optional(),
  defaultWorkingDays: z.array(z.number().min(1).max(7)).optional(),
  defaultStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format. Use HH:MM')
    .optional(),
  defaultEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format. Use HH:MM')
    .optional(),

  // SLA Defaults
  defaultSlaThreshold: z.number().min(1).max(480).optional(),
  maxEscalations: z.number().min(1).max(10).optional(),
  escalationIntervalMin: z.number().min(5).max(120).optional(),

  // Manager Alerts
  globalManagerIds: z.array(z.string()).optional(),
  
  // Lead Notifications (Landing Page)
  leadNotificationIds: z.array(z.string()).optional(),

  // AI Classification
  aiConfidenceThreshold: z.number().min(0).max(1).optional(),
  messagePreviewLength: z.number().min(100).max(1000).optional(),
  openrouterApiKey: z.string().optional(),
  openrouterModel: z.string().optional(),

  // Data Retention
  dataRetentionYears: z.number().min(1).max(10).optional(),
});

/**
 * Schema for adding a single holiday
 */
const AddGlobalHolidayInput = z.object({
  date: z.coerce.date(),
  name: z.string().min(1, 'Holiday name is required').max(100),
  year: z.number().min(2024).max(2030),
});

/**
 * Schema for removing a holiday by date
 */
const RemoveGlobalHolidayInput = z.object({
  date: z.coerce.date(),
});

/**
 * Schema for bulk adding holidays
 */
const BulkAddHolidaysInput = z.object({
  year: z.number().min(2024).max(2030),
  holidays: z.array(
    z.object({
      date: z.coerce.date(),
      name: z.string().max(100),
    })
  ),
});

/**
 * Schema for seeding Russian holidays
 */
const SeedRussianHolidaysInput = z.object({
  year: z.number().min(2024).max(2030),
});

/**
 * Schema for getting holidays with optional year filter
 */
const GetGlobalHolidaysInput = z.object({
  year: z.number().optional(),
});

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

/**
 * Output schema for global settings
 */
const GlobalSettingsOutput = z.object({
  // Working Hours Defaults
  defaultTimezone: z.string(),
  defaultWorkingDays: z.array(z.number()),
  defaultWorkingDaysDisplay: z.array(z.string()),
  defaultStartTime: z.string(),
  defaultEndTime: z.string(),

  // SLA Defaults
  defaultSlaThreshold: z.number(),
  maxEscalations: z.number(),
  escalationIntervalMin: z.number(),

  // Manager Alerts
  globalManagerIds: z.array(z.string()),
  globalManagerCount: z.number(),

  // Lead Notifications
  leadNotificationIds: z.array(z.string()),

  // AI Classification
  aiConfidenceThreshold: z.number(),
  messagePreviewLength: z.number(),
  openrouterApiKey: z.string().nullable(), // Masked for security
  openrouterModel: z.string(),

  // Data Retention
  dataRetentionYears: z.number(),

  // Meta
  updatedAt: z.date(),
});

/**
 * Output schema for a single holiday
 */
const GlobalHolidayOutput = z.object({
  id: z.string().uuid(),
  date: z.date(),
  name: z.string(),
  year: z.number(),
  createdAt: z.date(),
});

/**
 * Output schema for holiday list
 */
const HolidayListOutput = z.object({
  items: z.array(GlobalHolidayOutput),
  total: z.number(),
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Day number to Russian short name mapping
 * 1 = Monday (Пн), 7 = Sunday (Вс)
 */
const DAY_NAMES: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс',
};

/**
 * Convert working days array to display names
 */
function getWorkingDaysDisplay(days: number[]): string[] {
  return days.map((day) => DAY_NAMES[day] || `День ${day}`).filter(Boolean);
}

/**
 * Russian Federal Holidays template for seeding
 * Based on Russian Labor Code (ТК РФ, статья 112)
 */
const RUSSIAN_HOLIDAYS_TEMPLATE = [
  // New Year holidays (January 1-8)
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
// ROUTER DEFINITION
// ============================================================================

/**
 * Settings router for global settings and holidays management
 */
export const settingsRouter = router({
  // ==========================================================================
  // QUERIES
  // ==========================================================================

  /**
   * Get current global settings
   *
   * Returns all global configuration values including working hours defaults,
   * SLA thresholds, AI settings, and data retention policies.
   *
   * @returns Global settings object
   * @authorization All authenticated users
   */
  getGlobalSettings: authedProcedure
    .output(GlobalSettingsOutput)
    .query(async ({ ctx }) => {
      // Fetch or create default settings (singleton pattern)
      let settings = await ctx.prisma.globalSettings.findUnique({
        where: { id: 'default' },
      });

      // If settings don't exist, create with defaults
      if (!settings) {
        settings = await ctx.prisma.globalSettings.create({
          data: { id: 'default' },
        });
      }

      return {
        defaultTimezone: settings.defaultTimezone,
        defaultWorkingDays: settings.defaultWorkingDays,
        defaultWorkingDaysDisplay: getWorkingDaysDisplay(settings.defaultWorkingDays),
        defaultStartTime: settings.defaultStartTime,
        defaultEndTime: settings.defaultEndTime,
        defaultSlaThreshold: settings.defaultSlaThreshold,
        maxEscalations: settings.maxEscalations,
        escalationIntervalMin: settings.escalationIntervalMin,
        globalManagerIds: settings.globalManagerIds,
        globalManagerCount: settings.globalManagerIds.length,
        leadNotificationIds: settings.leadNotificationIds,
        aiConfidenceThreshold: settings.aiConfidenceThreshold,
        messagePreviewLength: settings.messagePreviewLength,
        // Mask API key for security (show only last 8 chars)
        openrouterApiKey: settings.openrouterApiKey
          ? `***${settings.openrouterApiKey.slice(-8)}`
          : null,
        openrouterModel: settings.openrouterModel,
        dataRetentionYears: settings.dataRetentionYears,
        updatedAt: settings.updatedAt,
      };
    }),

  /**
   * Get list of global holidays
   *
   * Returns all federal holidays, optionally filtered by year.
   * Used for SLA calculation to exclude non-working days.
   *
   * @param year - Optional year filter
   * @returns List of holidays with total count
   * @authorization All authenticated users
   */
  getGlobalHolidays: authedProcedure
    .input(GetGlobalHolidaysInput)
    .output(HolidayListOutput)
    .query(async ({ ctx, input }) => {
      const where = input.year ? { year: input.year } : {};

      const [holidays, total] = await Promise.all([
        ctx.prisma.globalHoliday.findMany({
          where,
          orderBy: { date: 'asc' },
        }),
        ctx.prisma.globalHoliday.count({ where }),
      ]);

      return {
        items: holidays.map((h) => ({
          id: h.id,
          date: h.date,
          name: h.name,
          year: h.year,
          createdAt: h.createdAt,
        })),
        total,
      };
    }),

  // ==========================================================================
  // MUTATIONS (Admin only)
  // ==========================================================================

  /**
   * Update global settings
   *
   * Updates any subset of global configuration values.
   * Only admin users can modify system-wide settings.
   *
   * @param input - Partial settings to update
   * @returns Updated global settings
   * @authorization Admin only
   */
  updateGlobalSettings: adminProcedure
    .input(UpdateGlobalSettingsInput)
    .output(GlobalSettingsOutput)
    .mutation(async ({ ctx, input }) => {
      // Filter out undefined values from input for Prisma compatibility
      const updateData = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined)
      );

      // Upsert settings (create if not exists, update if exists)
      const settings = await ctx.prisma.globalSettings.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          ...updateData,
        },
        update: updateData,
      });

      return {
        defaultTimezone: settings.defaultTimezone,
        defaultWorkingDays: settings.defaultWorkingDays,
        defaultWorkingDaysDisplay: getWorkingDaysDisplay(settings.defaultWorkingDays),
        defaultStartTime: settings.defaultStartTime,
        defaultEndTime: settings.defaultEndTime,
        defaultSlaThreshold: settings.defaultSlaThreshold,
        maxEscalations: settings.maxEscalations,
        escalationIntervalMin: settings.escalationIntervalMin,
        globalManagerIds: settings.globalManagerIds,
        globalManagerCount: settings.globalManagerIds.length,
        leadNotificationIds: settings.leadNotificationIds,
        aiConfidenceThreshold: settings.aiConfidenceThreshold,
        messagePreviewLength: settings.messagePreviewLength,
        // Mask API key for security (show only last 8 chars)
        openrouterApiKey: settings.openrouterApiKey
          ? `***${settings.openrouterApiKey.slice(-8)}`
          : null,
        openrouterModel: settings.openrouterModel,
        dataRetentionYears: settings.dataRetentionYears,
        updatedAt: settings.updatedAt,
      };
    }),

  /**
   * Add a new global holiday
   *
   * Adds a single federal holiday to the calendar.
   * Duplicate dates are rejected with an error.
   *
   * @param input - Holiday date, name, and year
   * @returns Created holiday record
   * @authorization Admin only
   */
  addGlobalHoliday: adminProcedure
    .input(AddGlobalHolidayInput)
    .output(GlobalHolidayOutput)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate date
      const existing = await ctx.prisma.globalHoliday.findUnique({
        where: { date: input.date },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Holiday already exists for date ${input.date.toISOString().split('T')[0]}: ${existing.name}`,
        });
      }

      const holiday = await ctx.prisma.globalHoliday.create({
        data: {
          date: input.date,
          name: input.name,
          year: input.year,
        },
      });

      return {
        id: holiday.id,
        date: holiday.date,
        name: holiday.name,
        year: holiday.year,
        createdAt: holiday.createdAt,
      };
    }),

  /**
   * Remove a global holiday by date
   *
   * Deletes a holiday from the calendar.
   * Returns success: false if holiday not found.
   *
   * @param input - Date of holiday to remove
   * @returns Success indicator
   * @authorization Admin only
   */
  removeGlobalHoliday: adminProcedure
    .input(RemoveGlobalHolidayInput)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.globalHoliday.findUnique({
        where: { date: input.date },
      });

      if (!existing) {
        return { success: false };
      }

      await ctx.prisma.globalHoliday.delete({
        where: { date: input.date },
      });

      return { success: true };
    }),

  /**
   * Bulk add multiple holidays
   *
   * Adds multiple holidays at once for a specific year.
   * Skips duplicates and returns counts of added/skipped.
   *
   * @param input - Year and array of holidays
   * @returns Count of added and skipped holidays
   * @authorization Admin only
   */
  bulkAddHolidays: adminProcedure
    .input(BulkAddHolidaysInput)
    .output(z.object({ added: z.number(), skipped: z.number() }))
    .mutation(async ({ ctx, input }) => {
      let added = 0;
      let skipped = 0;

      // Process each holiday individually to handle duplicates
      for (const holiday of input.holidays) {
        const existing = await ctx.prisma.globalHoliday.findUnique({
          where: { date: holiday.date },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await ctx.prisma.globalHoliday.create({
          data: {
            date: holiday.date,
            name: holiday.name,
            year: input.year,
          },
        });
        added++;
      }

      return { added, skipped };
    }),

  /**
   * Seed Russian federal holidays for a year
   *
   * Populates the calendar with standard Russian federal holidays
   * based on Labor Code (Article 112).
   *
   * @param input - Year to seed holidays for
   * @returns Count of added holidays and list of created records
   * @authorization Admin only
   */
  seedRussianHolidays: adminProcedure
    .input(SeedRussianHolidaysInput)
    .output(
      z.object({
        added: z.number(),
        holidays: z.array(GlobalHolidayOutput),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const createdHolidays: Array<{
        id: string;
        date: Date;
        name: string;
        year: number;
        createdAt: Date;
      }> = [];

      // Generate holidays for the specified year
      for (const template of RUSSIAN_HOLIDAYS_TEMPLATE) {
        const date = new Date(input.year, template.month - 1, template.day);

        // Check for existing holiday on this date
        const existing = await ctx.prisma.globalHoliday.findUnique({
          where: { date },
        });

        if (existing) {
          continue; // Skip duplicates
        }

        const holiday = await ctx.prisma.globalHoliday.create({
          data: {
            date,
            name: template.name,
            year: input.year,
          },
        });

        createdHolidays.push(holiday);
      }

      return {
        added: createdHolidays.length,
        holidays: createdHolidays.map((h) => ({
          id: h.id,
          date: h.date,
          name: h.name,
          year: h.year,
          createdAt: h.createdAt,
        })),
      };
    }),

  /**
   * Setup Telegram Bot (Onboarding Step 1)
   */
  setupTelegramBot: adminProcedure
    .input(z.object({ token: z.string() }))
    .output(
      z.object({
        success: z.boolean(),
        botUsername: z.string().optional(),
        botId: z.number().optional(), // Changed to number to match service output, will convert to BigInt for DB if needed
      })
    )
    .mutation(async ({ ctx, input }) => {
      const validation = await validateBotToken(input.token);

      if (!validation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validation.error || 'Invalid bot token',
        });
      }

      await ctx.prisma.globalSettings.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          botToken: input.token,
          botUsername: validation.botUsername ?? null,
          botId: validation.botId ? BigInt(validation.botId) : null,
        },
        update: {
          botToken: input.token,
          botUsername: validation.botUsername ?? null,
          botId: validation.botId ? BigInt(validation.botId) : null,
        },
      });

      return {
        success: true,
        botUsername: validation.botUsername,
        botId: validation.botId,
      };
    }),

  /**
   * Update Working Schedule (Onboarding Step 2)
   * Updates global defaults for working hours
   */
  updateWorkingSchedule: adminProcedure
    .input(
      z.object({
        days: z.array(z.number().min(1).max(7)),
        startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        timezone: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.globalSettings.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          defaultWorkingDays: input.days,
          defaultStartTime: input.startTime,
          defaultEndTime: input.endTime,
          defaultTimezone: input.timezone,
        },
        update: {
          defaultWorkingDays: input.days,
          defaultStartTime: input.startTime,
          defaultEndTime: input.endTime,
          defaultTimezone: input.timezone,
        },
      });
      return { success: true };
    }),

  /**
   * Update SLA Thresholds (Onboarding Step 3)
   * Updates global defaults for SLA
   */
  updateSlaThresholds: adminProcedure
    .input(
      z.object({
        slaThreshold: z.number().min(1).max(480),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        updatedChats: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Update global default
      await ctx.prisma.globalSettings.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          defaultSlaThreshold: input.slaThreshold,
        },
        update: {
          defaultSlaThreshold: input.slaThreshold,
        },
      });

      // 2. Update ALL existing chats (gh-16)
      const result = await ctx.prisma.chat.updateMany({
        where: {},
        data: {
          slaThresholdMinutes: input.slaThreshold,
          slaResponseMinutes: input.slaThreshold,
        },
      });

      return { success: true, updatedChats: result.count };
    }),
});

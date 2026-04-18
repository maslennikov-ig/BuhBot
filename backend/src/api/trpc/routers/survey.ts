/**
 * Survey Router - Survey Campaign Management
 *
 * Procedures (manager only):
 * - list: List all survey campaigns
 * - getById: Get detailed survey campaign info
 * - create: Schedule a new survey campaign
 * - close: Manually close an active survey
 * - sendNow: Immediately start sending a scheduled survey
 * - getDeliveries: List delivery status for a survey
 * - getSettings: Get survey-related global settings
 * - updateSettings: Update survey settings (admin only)
 *
 * @module api/trpc/routers/survey
 */

import { router, managerProcedure, adminProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';
import {
  createSurvey,
  createCampaign,
  canSendSurveyToChat,
  getSurveyCooldownHours,
  closeSurvey,
  startSurveyDelivery,
  getPendingDeliveries,
  QUARTER_REGEX,
} from '../../../services/feedback/survey.service.js';
import { queueSurveyDelivery } from '../../../queues/survey.queue.js';

/**
 * Survey status enum for input validation
 */
const SurveyStatusSchema = z.enum(['scheduled', 'sending', 'active', 'closed', 'expired']);

/**
 * Delivery status enum for input validation
 */
const DeliveryStatusSchema = z.enum([
  'pending',
  'delivered',
  'reminded',
  'expired',
  'responded',
  'failed',
]);

/**
 * Survey router for campaign management
 */
export const surveyRouter = router({
  /**
   * T059: List all survey campaigns
   *
   * Manager-only procedure to list all survey campaigns with pagination.
   * Returns survey details including responseCount and averageRating.
   *
   * @authorization Manager only
   */
  list: managerProcedure
    .input(
      z
        .object({
          status: SurveyStatusSchema.optional(),
          page: z.number().min(1).default(1),
          pageSize: z.number().min(10).max(100).default(20),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: Prisma.FeedbackSurveyWhereInput = {};
      if (input?.status) {
        where.status = input.status;
      }

      // Get total count for pagination
      const totalItems = await ctx.prisma.feedbackSurvey.count({ where });
      const totalPages = Math.ceil(totalItems / pageSize);

      // Get surveys with pagination
      const surveys = await ctx.prisma.feedbackSurvey.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: pageSize,
      });

      // Calculate response rate for each survey
      const items = surveys.map((survey) => ({
        id: survey.id,
        quarter: survey.quarter,
        startDate: survey.startDate,
        endDate: survey.endDate,
        status: survey.status,
        scheduledAt: survey.scheduledAt,
        sentAt: survey.sentAt,
        expiresAt: survey.expiresAt,
        closedAt: survey.closedAt,
        totalClients: survey.totalClients,
        deliveredCount: survey.deliveredCount,
        responseCount: survey.responseCount,
        averageRating: survey.averageRating,
        responseRate:
          survey.deliveredCount > 0
            ? Math.round((survey.responseCount / survey.deliveredCount) * 100 * 10) / 10
            : 0,
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
   * T060: Get single survey with deliveries summary
   *
   * Manager-only procedure to get detailed survey info with delivery stats.
   *
   * @authorization Manager only
   */
  getById: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const survey = await ctx.prisma.feedbackSurvey.findUnique({
        where: { id: input.id },
        include: {
          closedByUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      if (!survey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Survey with ID ${input.id} not found`,
        });
      }

      // Get delivery statistics
      const deliveryStats = await ctx.prisma.surveyDelivery.groupBy({
        by: ['status'],
        where: { surveyId: input.id },
        _count: { status: true },
      });

      // Transform to a more usable format
      const stats = {
        total: 0,
        pending: 0,
        delivered: 0,
        reminded: 0,
        responded: 0,
        expired: 0,
        failed: 0,
      };

      for (const stat of deliveryStats) {
        const count = stat._count.status;
        stats.total += count;
        stats[stat.status] = count;
      }

      return {
        id: survey.id,
        quarter: survey.quarter,
        startDate: survey.startDate,
        endDate: survey.endDate,
        status: survey.status,
        scheduledAt: survey.scheduledAt,
        sentAt: survey.sentAt,
        expiresAt: survey.expiresAt,
        closedAt: survey.closedAt,
        closedBy: survey.closedByUser,
        totalClients: survey.totalClients,
        deliveredCount: survey.deliveredCount,
        responseCount: survey.responseCount,
        averageRating: survey.averageRating,
        responseRate:
          survey.deliveredCount > 0
            ? Math.round((survey.responseCount / survey.deliveredCount) * 100 * 10) / 10
            : 0,
        deliveryStats: stats,
        createdAt: survey.createdAt,
      };
    }),

  /**
   * T061 / gh-292: Create/schedule a new survey campaign.
   *
   * Input is a discriminated union over `mode`:
   *   - `mode: 'quarter'` — legacy preset, input includes a `YYYY-QN` quarter.
   *   - `mode: 'range'`  — custom `startDate`/`endDate`, no quarter.
   *
   * If `scheduledFor` is omitted, delivery starts immediately (surveys go to BullMQ).
   *
   * Error mapping (service → tRPC):
   *   - Error.name='RANGE_INVALID' → TRPCError BAD_REQUEST with cause.kind='RANGE_INVALID'.
   *   - Error.name='OVERLAP'       → TRPCError PRECONDITION_FAILED with cause.kind='OVERLAP' and conflictingSurveyId.
   *
   * @authorization Manager only
   */
  create: managerProcedure
    .input(
      z
        .discriminatedUnion('mode', [
          z.object({
            mode: z.literal('quarter'),
            quarter: z.string().regex(QUARTER_REGEX, {
              message: 'Quarter must be in format YYYY-QN (e.g., 2025-Q1)',
            }),
            scheduledFor: z.date().optional(),
            validityDays: z.number().int().min(1).max(90).optional(),
          }),
          z.object({
            mode: z.literal('range'),
            startDate: z.date(),
            endDate: z.date(),
            scheduledFor: z.date().optional(),
            validityDays: z.number().int().min(1).max(90).optional(),
          }),
        ])
        .superRefine((input, ctx) => {
          if (input.mode === 'range' && input.endDate <= input.startDate) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'endDate must be strictly after startDate',
              path: ['endDate'],
            });
          }
        })
    )
    .mutation(async ({ input }) => {
      // Determine trigger mode.
      const isImmediate = !input.scheduledFor;

      // Build service call input based on mode.
      let survey: Awaited<ReturnType<typeof createCampaign>>;
      try {
        if (input.mode === 'quarter') {
          // Delegate to the back-compat `createSurvey` wrapper which handles
          // same-quarter dedup (in addition to the range-overlap check that
          // createCampaign does internally).
          const legacyInput: Parameters<typeof createSurvey>[0] = {
            quarter: input.quarter,
            scheduledAt: input.scheduledFor ?? new Date(),
          };
          if (input.validityDays !== undefined) {
            legacyInput.validityDays = input.validityDays;
          }
          survey = await createSurvey(legacyInput);
        } else {
          // Range mode — scheduledFor defaults to `now` when the admin wants immediate
          // delivery. Without this, `createCampaign` would fall back to `startDate`,
          // which may be in the past for retroactive reporting windows.
          const campaignInput: Parameters<typeof createCampaign>[0] = {
            startDate: input.startDate,
            endDate: input.endDate,
            scheduledFor: input.scheduledFor ?? new Date(),
          };
          if (input.validityDays !== undefined) {
            campaignInput.validityDays = input.validityDays;
          }
          survey = await createCampaign(campaignInput);
        }
      } catch (err) {
        // Translate service-level errors into typed TRPCErrors.
        if (err instanceof Error && err.name === 'RANGE_INVALID') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: err.message,
            cause: { kind: 'RANGE_INVALID' },
          });
        }
        if (err instanceof Error && err.name === 'OVERLAP') {
          const conflictingSurveyId =
            (err as Error & { conflictingSurveyId?: string }).conflictingSurveyId ?? null;
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: err.message,
            cause: { kind: 'OVERLAP', conflictingSurveyId },
          });
        }
        throw err;
      }

      // If immediate start, trigger delivery.
      if (isImmediate) {
        await startSurveyDelivery(survey.id);

        const pendingDeliveries = await getPendingDeliveries(survey.id);
        // Derive a quarter label for the job payload. For range-mode surveys
        // we synthesize a "range" tag so existing log aggregation on `quarter`
        // still works without crashing on null.
        const quarterForJob =
          survey.quarter ??
          (survey.startDate && survey.endDate
            ? `range:${survey.startDate.toISOString().slice(0, 10)}..${survey.endDate
                .toISOString()
                .slice(0, 10)}`
            : 'range');
        for (const delivery of pendingDeliveries) {
          await queueSurveyDelivery({
            surveyId: survey.id,
            chatId: delivery.chatId.toString(),
            deliveryId: delivery.id,
            quarter: quarterForJob,
          });
        }
      }

      return {
        id: survey.id,
        quarter: survey.quarter,
        startDate: survey.startDate,
        endDate: survey.endDate,
        status: survey.status,
        scheduledAt: survey.scheduledAt,
        expiresAt: survey.expiresAt,
        isImmediate,
      };
    }),

  /**
   * T062: Manually close an active survey
   *
   * Manager-only procedure to close a survey.
   * Updates status to 'closed' and records who closed it.
   *
   * @authorization Manager only
   */
  close: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const survey = await ctx.prisma.feedbackSurvey.findUnique({
        where: { id: input.id },
      });

      if (!survey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Survey with ID ${input.id} not found`,
        });
      }

      // Only allow closing active or sending surveys
      if (!['active', 'sending'].includes(survey.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot close survey with status '${survey.status}'. Only 'active' or 'sending' surveys can be closed.`,
        });
      }

      // Close the survey
      await closeSurvey(input.id, ctx.user.id);

      return {
        success: true,
        message: 'Survey closed successfully',
      };
    }),

  /**
   * T063: Immediately start a scheduled survey
   *
   * Manager-only procedure to start sending a scheduled survey now.
   * Verifies status is 'scheduled' before starting.
   *
   * @authorization Manager only
   */
  sendNow: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const survey = await ctx.prisma.feedbackSurvey.findUnique({
        where: { id: input.id },
      });

      if (!survey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Survey with ID ${input.id} not found`,
        });
      }

      // Only allow sending scheduled surveys
      if (survey.status !== 'scheduled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot send survey with status '${survey.status}'. Only 'scheduled' surveys can be sent.`,
        });
      }

      // Start delivery process
      await startSurveyDelivery(input.id);

      // Queue delivery jobs for pending deliveries.
      // gh-292: quarter may be null for range-mode surveys — synthesize a label
      // so the job payload stays non-null (SurveyDeliveryJobData.quarter is string).
      const pendingDeliveries = await getPendingDeliveries(input.id);
      const quarterForJob =
        survey.quarter ??
        (survey.startDate && survey.endDate
          ? `range:${survey.startDate.toISOString().slice(0, 10)}..${survey.endDate
              .toISOString()
              .slice(0, 10)}`
          : 'range');
      for (const delivery of pendingDeliveries) {
        await queueSurveyDelivery({
          surveyId: input.id,
          chatId: delivery.chatId.toString(),
          deliveryId: delivery.id,
          quarter: quarterForJob,
        });
      }

      return {
        success: true,
        message: 'Survey delivery started',
        deliveriesQueued: pendingDeliveries.length,
      };
    }),

  /**
   * T064: List deliveries for a survey
   *
   * Manager-only procedure to list delivery status for a survey.
   * Returns paginated delivery list with chat info.
   *
   * @authorization Manager only
   */
  getDeliveries: managerProcedure
    .input(
      z.object({
        surveyId: z.string().uuid(),
        status: DeliveryStatusSchema.optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const page = input.page;
      const pageSize = input.pageSize;
      const skip = (page - 1) * pageSize;

      // Verify survey exists
      const survey = await ctx.prisma.feedbackSurvey.findUnique({
        where: { id: input.surveyId },
      });

      if (!survey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Survey with ID ${input.surveyId} not found`,
        });
      }

      // Build where clause
      const where: Prisma.SurveyDeliveryWhereInput = {
        surveyId: input.surveyId,
      };
      if (input.status) {
        where.status = input.status;
      }

      // Get total count for pagination
      const totalItems = await ctx.prisma.surveyDelivery.count({ where });
      const totalPages = Math.ceil(totalItems / pageSize);

      // Get deliveries with chat info
      const deliveries = await ctx.prisma.surveyDelivery.findMany({
        where,
        include: {
          chat: {
            select: {
              id: true,
              title: true,
              accountantUsernames: true,
              assignedAccountant: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      });

      const items = deliveries.map((d) => ({
        id: d.id,
        surveyId: d.surveyId,
        chatId: d.chatId.toString(),
        chatTitle: d.chat?.title ?? null,
        accountantUsername:
          d.chat?.assignedAccountant?.fullName ?? d.chat?.accountantUsernames?.[0] ?? null,
        accountantName: d.chat?.assignedAccountant?.fullName ?? null,
        status: d.status,
        deliveredAt: d.deliveredAt,
        reminderSentAt: d.reminderSentAt,
        managerNotifiedAt: d.managerNotifiedAt,
        retryCount: d.retryCount,
        errorMessage: d.errorMessage,
        createdAt: d.createdAt,
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
   * T065: Get survey-related global settings
   *
   * Manager-only procedure to get survey settings.
   *
   * @authorization Manager only
   */
  getSettings: managerProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.globalSettings.findUnique({
      where: { id: 'default' },
      select: {
        surveyValidityDays: true,
        surveyReminderDay: true,
        lowRatingThreshold: true,
        surveyQuarterDay: true,
        // gh-292: new cooldown / max-range knobs, read by the create modal to
        // surface the configured limits to the admin UI.
        surveyCooldownHours: true,
        surveyMaxRangeDays: true,
      },
    });

    return (
      settings || {
        surveyValidityDays: 7,
        surveyReminderDay: 2,
        lowRatingThreshold: 3,
        surveyQuarterDay: 1,
        surveyCooldownHours: 24,
        surveyMaxRangeDays: 90,
      }
    );
  }),

  /**
   * T066: Update survey settings
   *
   * Admin-only procedure to update survey-related global settings.
   *
   * @authorization Admin only
   */
  updateSettings: adminProcedure
    .input(
      z.object({
        surveyValidityDays: z.number().min(1).max(30).optional(),
        surveyReminderDay: z.number().min(1).max(7).optional(),
        lowRatingThreshold: z.number().min(1).max(5).optional(),
        surveyQuarterDay: z.number().min(1).max(28).optional(),
        // gh-292: anti-spam cooldown in hours (1..168 = one week) and
        // max allowed reporting range in days (1..365).
        surveyCooldownHours: z.number().min(1).max(168).optional(),
        surveyMaxRangeDays: z.number().min(1).max(365).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Build update data from provided fields
      const updateData: Prisma.GlobalSettingsUpdateInput = {};

      if (input.surveyValidityDays !== undefined) {
        updateData.surveyValidityDays = input.surveyValidityDays;
      }
      if (input.surveyReminderDay !== undefined) {
        updateData.surveyReminderDay = input.surveyReminderDay;
      }
      if (input.lowRatingThreshold !== undefined) {
        updateData.lowRatingThreshold = input.lowRatingThreshold;
      }
      if (input.surveyQuarterDay !== undefined) {
        updateData.surveyQuarterDay = input.surveyQuarterDay;
      }
      if (input.surveyCooldownHours !== undefined) {
        updateData.surveyCooldownHours = input.surveyCooldownHours;
      }
      if (input.surveyMaxRangeDays !== undefined) {
        updateData.surveyMaxRangeDays = input.surveyMaxRangeDays;
      }

      // Update settings (upsert to handle case where no settings exist)
      const settings = await ctx.prisma.globalSettings.upsert({
        where: { id: 'default' },
        update: updateData,
        create: {
          id: 'default',
          surveyValidityDays: input.surveyValidityDays ?? 7,
          surveyReminderDay: input.surveyReminderDay ?? 2,
          lowRatingThreshold: input.lowRatingThreshold ?? 3,
          surveyQuarterDay: input.surveyQuarterDay ?? 1,
          surveyCooldownHours: input.surveyCooldownHours ?? 24,
          surveyMaxRangeDays: input.surveyMaxRangeDays ?? 90,
        },
        select: {
          surveyValidityDays: true,
          surveyReminderDay: true,
          lowRatingThreshold: true,
          surveyQuarterDay: true,
          surveyCooldownHours: true,
          surveyMaxRangeDays: true,
        },
      });

      return {
        success: true,
        settings,
      };
    }),

  /**
   * gh-292: Look up cooldown eligibility for a single chat.
   *
   * Used by the frontend creation modal to preview whether a given chat will
   * be skipped on the next delivery. Returns the same `CooldownStatus` shape
   * that the worker consults.
   *
   * @authorization Manager only
   */
  getCooldownStatus: managerProcedure
    .input(
      z.object({
        /**
         * Telegram chat ID as a decimal string (BigInt serialization; negative
         * for supergroups). We parse + validate server-side to keep a tight
         * error surface.
         */
        chatId: z
          .string()
          .regex(/^-?\d+$/, 'chatId must be a decimal integer (may start with "-")'),
      })
    )
    .query(async ({ input }) => {
      const cooldownHours = await getSurveyCooldownHours();
      const status = await canSendSurveyToChat(BigInt(input.chatId), cooldownHours);
      return {
        cooldownHours,
        allowed: status.allowed,
        reason: status.reason ?? null,
        nextEligibleAt: status.nextEligibleAt ?? null,
        lastSurveySentAt: status.lastSurveySentAt ?? null,
      };
    }),
});

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
import { chatIdStringSchema } from '../helpers/zod-schemas.js';
import { z } from 'zod';

const ISO_DATE_TIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Accept Date instances or ISO-8601 date strings only.
 * We intentionally reject loose date-like strings (e.g. "April 1, 2026").
 */
const isoDateInputSchema = z
  .union([
    z.date(),
    z
      .string()
      .trim()
      .refine((value) => ISO_DATE_TIME_REGEX.test(value) || ISO_DATE_ONLY_REGEX.test(value), {
        message: 'Expected ISO-8601 date string or Date object',
      }),
  ])
  .pipe(z.coerce.date())
  .refine((value) => !Number.isNaN(value.getTime()), { message: 'Invalid date value' });
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';
import {
  createCampaign,
  canSendSurveyToChat,
  getSurveyCooldownHours,
  closeSurvey,
  startSurveyDelivery,
  getPendingDeliveries,
  quarterToRange,
  QUARTER_REGEX,
} from '../../../services/feedback/survey.service.js';
import {
  aggregateSurvey,
  aggregateSurveys,
  getVoteHistory,
  type SurveyAggregate,
} from '../../../services/feedback/vote.service.js';
import { queueSurveyDelivery } from '../../../queues/survey.queue.js';
import logger from '../../../utils/logger.js';

/**
 * Survey status enum for input validation
 */
const SurveyStatusSchema = z.enum(['scheduled', 'sending', 'active', 'closed', 'expired']);

/**
 * gh-313: Audience selector schema.
 *
 * Nested `z.discriminatedUnion('type', ...)` next to the top-level `mode` DU
 * keeps the two axes orthogonal (scheduling mode × audience mode) without
 * expanding into a 6-variant compound DU. Zod 3 supports multiple DUs per
 * object — the outer `.discriminatedUnion('mode', ...)` discriminates scheduling
 * and this schema is embedded as a sibling `audience` field on each variant.
 *
 * chatIds arrive as decimal strings across the tRPC JSON boundary (BigInt can't
 * be serialized by default) and are parsed to BigInt on the server.
 */
// chatIdStringSchema is imported from the shared helper — see
// gh-313 code review L1 for why we extracted it.

const audienceSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('all') }),
    z.object({
      type: z.literal('specific_chats'),
      chatIds: z.array(chatIdStringSchema).min(1).max(500),
    }),
    z.object({
      type: z.literal('segments'),
      segmentIds: z.array(z.string().uuid()).min(1).max(50),
    }),
  ])
  .optional();

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
  'skipped',
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

      // gh-333: Fetch live vote aggregates for all surveys in one batch query to avoid N+1
      const surveyIds = surveys.map((s) => s.id);
      let aggMap: Map<string, SurveyAggregate> = new Map();
      try {
        aggMap = await aggregateSurveys(surveyIds);
      } catch (error) {
        // If aggregation fails, fall back to legacy snapshot values
        logger.error('aggregateSurveys failed, falling back to snapshot columns', { error });
      }

      // Calculate response rate for each survey
      const items = surveys.map((survey) => {
        const agg = aggMap.get(survey.id);
        const effectiveResponseCount = agg !== undefined ? agg.count : survey.responseCount;
        // gh-334: Use totalRecipientsCount (distinct users in delivery chats) for responseRate.
        // This gives the true user-level response rate: (voters) / (users in chats).
        const totalRecipients = agg?.totalRecipientsCount ?? 0;

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
          totalClients: survey.totalClients,
          deliveredCount: survey.deliveredCount,
          responseCount: effectiveResponseCount,
          averageRating: agg?.average ?? survey.averageRating,
          // gh-313: surface audience selector so the UI can render a badge/summary.
          audienceType: survey.audienceType,
          audienceChatIds: survey.audienceChatIds.map((id) => id.toString()),
          audienceSegmentIds: survey.audienceSegmentIds,
          responseRate:
            totalRecipients > 0
              ? Math.round(((agg?.count ?? 0) / totalRecipients) * 100 * 10) / 10
              : 0,
        };
      });

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
        skipped: 0,
      };

      for (const stat of deliveryStats) {
        const count = stat._count.status;
        stats.total += count;
        stats[stat.status] = count;
      }

      // gh-294: overlay aggregates computed from the multi-user SurveyVote
      // store. When the new voting path has any data, prefer it for the UI
      // numbers so managers see the up-to-date count/avg/distribution.
      // The legacy `survey.responseCount`/`averageRating` columns are still
      // returned for back-compat with any pre-gh-294 consumers.
      const agg = await aggregateSurvey(input.id);
      const effectiveResponseCount = agg.count > 0 ? agg.count : survey.responseCount;
      const effectiveAverageRating = agg.average ?? survey.averageRating;

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
        responseCount: effectiveResponseCount,
        averageRating: effectiveAverageRating,
        // gh-313: surface audience selector (chatIds stringified for JSON safety).
        audienceType: survey.audienceType,
        audienceChatIds: survey.audienceChatIds.map((id) => id.toString()),
        audienceSegmentIds: survey.audienceSegmentIds,
        // gh-334: responseRate is now user-level: (voters) / (total users in chats).
        // buh-fcpd (M-3): Unified with the list procedure — both use `agg.count`
        // (live SurveyVote rows) as the numerator. Legacy pre-gh-294 surveys
        // with no SurveyVote rows therefore show responseRate=0 here and in the
        // list view, consistently. The outer `> 0` guard already protects the
        // denominator, so no `?? 1` fallback is needed in the division.
        responseRate:
          agg.count > 0 && (agg.totalRecipientsCount ?? 0) > 0
            ? Math.round((agg.count / agg.totalRecipientsCount!) * 100 * 10) / 10
            : 0,
        deliveryStats: stats,
        distribution: agg.distribution,
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
            // Frontend sends JSON, so Date values arrive as ISO strings when
            // superjson is not enabled. Accept only ISO/Date inputs, then coerce.
            scheduledFor: isoDateInputSchema.optional(),
            validityDays: z.number().int().min(1).max(90).optional(),
            // gh-313: audience selector (optional — defaults to 'all' in the service)
            audience: audienceSchema,
          }),
          z.object({
            mode: z.literal('range'),
            // gh-292 hotfix: accept ISO/Date inputs from tRPC JSON transport.
            startDate: isoDateInputSchema,
            endDate: isoDateInputSchema,
            scheduledFor: isoDateInputSchema.optional(),
            validityDays: z.number().int().min(1).max(90).optional(),
            // gh-313: audience selector (optional — defaults to 'all' in the service)
            audience: audienceSchema,
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

      // gh-313: Translate the wire-format audience (chatIds as strings) into
      // the service-layer AudienceInput (chatIds as BigInt). Zod already ran
      // the decimal-integer regex so BigInt() is safe here.
      let audience: Parameters<typeof createCampaign>[0]['audience'] = undefined;
      if (input.audience) {
        if (input.audience.type === 'specific_chats') {
          audience = {
            type: 'specific_chats',
            chatIds: input.audience.chatIds.map((c) => BigInt(c)),
          };
        } else if (input.audience.type === 'segments') {
          audience = { type: 'segments', segmentIds: input.audience.segmentIds };
        } else {
          audience = { type: 'all' };
        }
      }

      // Build service call input based on mode.
      let survey: Awaited<ReturnType<typeof createCampaign>>;
      try {
        if (input.mode === 'quarter') {
          // gh-313: Route quarter-mode creation through createCampaign directly so
          // the new audience selector is honored. Same-quarter dedup is still
          // enforced because createCampaign's OVERLAP guard catches any active
          // campaign that overlaps the quarter's start/end range.
          const { startDate, endDate } = quarterToRange(input.quarter);
          const campaignInput: Parameters<typeof createCampaign>[0] = {
            startDate,
            endDate,
            scheduledFor: input.scheduledFor ?? new Date(),
            quarter: input.quarter,
            // buh-i4xx: quarters are trusted bounded windows (Q2=91d, Q3/Q4=92d).
            // The max-range guard only protects admin-typed custom ranges.
            bypassMaxRangeCheck: true,
          };
          if (input.validityDays !== undefined) {
            campaignInput.validityDays = input.validityDays;
          }
          if (audience) {
            campaignInput.audience = audience;
          }
          survey = await createCampaign(campaignInput);
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
          if (audience) {
            campaignInput.audience = audience;
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
        if (err instanceof Error && err.name === 'AUDIENCE_INVALID') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: err.message,
            cause: { kind: 'AUDIENCE_INVALID' },
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
        // buh-lmw2: expose cooldown/skip reason so the UI can render it as
        // context next to the 'skipped' badge.
        skipReason: d.skipReason,
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
   * gh-294: Aggregate results for a survey (count + average + distribution)
   *
   * Sourced from the multi-user SurveyVote store; state='removed' rows are
   * excluded. Use this in the detail page results card.
   *
   * @authorization Manager only
   */
  results: managerProcedure
    .input(z.object({ surveyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const survey = await ctx.prisma.feedbackSurvey.findUnique({
        where: { id: input.surveyId },
        select: { id: true },
      });
      if (!survey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Survey with ID ${input.surveyId} not found`,
        });
      }

      const agg = await aggregateSurvey(input.surveyId);
      return {
        count: agg.count,
        average: agg.average,
        distribution: agg.distribution,
      };
    }),

  /**
   * gh-294: Vote history (audit trail) for a single delivery
   *
   * Returns every SurveyVoteHistory row for the delivery in chronological
   * order. Used by the admin UI drill-down ("История голосов").
   *
   * BigInt handling: telegramUserId is serialized to a string across the
   * tRPC boundary because tRPC does not JSON-serialize BigInt natively and
   * this project does not use superjson.
   *
   * @authorization Manager only
   */
  voteHistory: managerProcedure
    .input(z.object({ deliveryId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await getVoteHistory(input.deliveryId);
      return rows.map((r) => ({
        timestamp: r.timestamp,
        username: r.username,
        telegramUserId: r.telegramUserId.toString(),
        action: r.action,
        oldRating: r.oldRating,
        newRating: r.newRating,
      }));
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

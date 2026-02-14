/**
 * Alert Router - SLA Alert Management
 *
 * Procedures:
 * Mutations:
 * - createAlert: Create a new SLA alert
 * - resolveAlert: Resolve an alert with action type
 * - notifyAccountant: Send notification to accountant
 * - updateDeliveryStatus: Update Telegram delivery status
 *
 * Queries:
 * - getAlerts: List alerts with filters and pagination
 * - getAlertById: Get alert details
 * - getActiveAlerts: Get unresolved alerts
 * - getAlertStats: Get alert statistics
 * - getActiveAlertCount: Dashboard metric
 *
 * @module api/trpc/routers/alert
 */

import { router, authedProcedure, managerProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, SlaAlert, ClientRequest, Chat, User } from '@prisma/client';
import {
  createAlert as createAlertService,
  resolveAlert as resolveAlertService,
  getAlertById as getAlertByIdService,
  updateDeliveryStatus as updateDeliveryStatusService,
} from '../../../services/alerts/index.js';
import { cancelEscalation } from '../../../services/alerts/escalation.service.js';
import { formatAccountantNotification } from '../../../services/alerts/format.service.js';
import { bot } from '../../../bot/bot.js';
import logger from '../../../utils/logger.js';

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

/**
 * Alert type schema (matches Prisma AlertType enum)
 */
const AlertTypeSchema = z.enum(['warning', 'breach']);

/**
 * Alert delivery status schema (matches Prisma AlertDeliveryStatus enum)
 */
const AlertDeliveryStatusSchema = z.enum(['pending', 'sent', 'delivered', 'failed']);

/**
 * Alert action schema (matches Prisma AlertAction enum)
 */
const AlertActionSchema = z.enum(['mark_resolved', 'accountant_responded', 'auto_expired']);

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

const GetAlertsInput = z.object({
  requestId: z.string().uuid().optional(),
  managerId: z.string().optional(),
  alertType: AlertTypeSchema.optional(),
  deliveryStatus: AlertDeliveryStatusSchema.optional(),
  resolved: z.boolean().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const GetAlertByIdInput = z.object({
  alertId: z.string().uuid(),
});

const CreateAlertInput = z.object({
  requestId: z.string().uuid(),
  alertType: AlertTypeSchema,
  minutesElapsed: z.number().int().min(0),
  escalationLevel: z.number().int().min(1).max(5).default(1),
});

const ResolveAlertInput = z.object({
  alertId: z.string().uuid(),
  action: AlertActionSchema,
  resolvedBy: z.string().uuid().optional(),
  resolutionNotes: z.string().max(500).optional(),
});

const NotifyAccountantInput = z.object({
  alertId: z.string().uuid(),
  message: z.string().max(500).optional(),
});

const UpdateDeliveryStatusInput = z.object({
  alertId: z.string().uuid(),
  status: z.enum(['sent', 'delivered', 'failed']),
  telegramMessageId: z.string().optional(),
});

const GetActiveAlertsInput = z.object({
  managerId: z.string().optional(),
});

const GetAlertStatsInput = z.object({
  managerId: z.string().optional(),
});

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

const AlertOutput = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),

  // Alert info
  alertType: AlertTypeSchema,
  minutesElapsed: z.number(),
  escalationLevel: z.number(),
  nextEscalationAt: z.date().nullable(),

  // Delivery
  managerTelegramId: z.string().nullable(),
  telegramMessageId: z.string().nullable(),
  deliveryStatus: AlertDeliveryStatusSchema,
  deliveredAt: z.date().nullable(),
  alertSentAt: z.date(),

  // Resolution
  acknowledgedAt: z.date().nullable(),
  acknowledgedBy: z.string().uuid().nullable(),
  acknowledgedByName: z.string().nullable(),
  resolvedAction: AlertActionSchema.nullable(),
  resolutionNotes: z.string().nullable(),

  // Related data
  request: z
    .object({
      chatId: z.string(),
      chatTitle: z.string().nullable(),
      clientUsername: z.string().nullable(),
      messagePreview: z.string(),
      accountantName: z.string().nullable(),
    })
    .optional(),
});

const AlertListOutput = z.object({
  items: z.array(AlertOutput),
  total: z.number(),
  hasMore: z.boolean(),
});

const AlertStatsOutput = z.object({
  today: z.object({
    total: z.number(),
    warnings: z.number(),
    breaches: z.number(),
    resolved: z.number(),
    pending: z.number(),
  }),
  week: z.object({
    total: z.number(),
    warnings: z.number(),
    breaches: z.number(),
    avgResolutionMinutes: z.number().nullable(),
  }),
  month: z.object({
    total: z.number(),
    breaches: z.number(),
    topOffenders: z.array(
      z.object({
        accountantId: z.string().uuid(),
        accountantName: z.string(),
        breachCount: z.number(),
      })
    ),
  }),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type AlertWithRelations = SlaAlert & {
  request?:
    | (ClientRequest & {
        chat: Chat;
        assignedUser?: User | null;
      })
    | null;
  acknowledgedUser?: User | null;
};

/**
 * Transform database alert to API output format
 */
function transformAlertToOutput(alert: AlertWithRelations): z.infer<typeof AlertOutput> {
  return {
    id: alert.id,
    requestId: alert.requestId,
    alertType: alert.alertType,
    minutesElapsed: alert.minutesElapsed,
    escalationLevel: alert.escalationLevel,
    nextEscalationAt: alert.nextEscalationAt,
    managerTelegramId: null, // Not stored per-alert
    telegramMessageId: alert.telegramMessageId ? String(alert.telegramMessageId) : null,
    deliveryStatus: alert.deliveryStatus,
    deliveredAt: alert.deliveredAt,
    alertSentAt: alert.alertSentAt,
    acknowledgedAt: alert.acknowledgedAt,
    acknowledgedBy: alert.acknowledgedBy,
    acknowledgedByName: alert.acknowledgedUser?.fullName ?? null,
    resolvedAction: alert.resolvedAction,
    resolutionNotes: alert.resolutionNotes,
    request: alert.request
      ? {
          chatId: String(alert.request.chatId),
          chatTitle: alert.request.chat?.title ?? null,
          clientUsername: alert.request.clientUsername,
          messagePreview: (alert.request.messageText ?? '').substring(0, 200),
          accountantName: alert.request.assignedUser?.fullName ?? null,
        }
      : undefined,
  };
}

// ============================================================================
// ROUTER
// ============================================================================

/**
 * Alert router for SLA alert management
 */
export const alertRouter = router({
  // ==========================================================================
  // MUTATIONS
  // ==========================================================================

  /**
   * Create a new SLA alert
   *
   * @param requestId - Client request UUID
   * @param alertType - warning or breach
   * @param minutesElapsed - Minutes elapsed since request
   * @param escalationLevel - Initial escalation level (default: 1)
   * @returns Created alert details
   * @authorization Admins and managers only
   */
  createAlert: managerProcedure
    .input(CreateAlertInput)
    .output(AlertOutput)
    .mutation(async ({ input }) => {
      try {
        const alert = await createAlertService({
          requestId: input.requestId,
          alertType: input.alertType,
          minutesElapsed: input.minutesElapsed,
          escalationLevel: input.escalationLevel,
        });

        // Fetch full alert with relations for output
        const fullAlert = await getAlertByIdService(alert.id);

        if (!fullAlert) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve created alert',
          });
        }

        return transformAlertToOutput(fullAlert);
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create alert',
        });
      }
    }),

  /**
   * Resolve an alert
   *
   * Marks alert as resolved and cancels pending escalations.
   *
   * @param alertId - Alert UUID
   * @param action - Resolution action type
   * @param resolvedBy - User UUID who resolved (optional)
   * @param resolutionNotes - Optional resolution notes
   * @returns Updated alert details
   * @throws NOT_FOUND if alert doesn't exist
   * @authorization Admins and managers only
   */
  resolveAlert: managerProcedure
    .input(ResolveAlertInput)
    .output(AlertOutput)
    .mutation(async ({ ctx, input }) => {
      // Verify alert exists
      const existingAlert = await ctx.prisma.slaAlert.findUnique({
        where: { id: input.alertId },
      });

      if (!existingAlert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Alert with ID ${input.alertId} not found`,
        });
      }

      // Check if already resolved
      if (existingAlert.resolvedAction !== null) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Alert has already been resolved',
        });
      }

      try {
        // Cancel pending escalations (non-blocking — don't fail resolve if queue is down)
        try {
          await cancelEscalation(input.alertId);
        } catch (escalationError) {
          logger.warn('Failed to cancel escalation for alert', {
            alertId: input.alertId,
            error:
              escalationError instanceof Error ? escalationError.message : String(escalationError),
            service: 'alert',
          });
        }

        // Resolve the alert — verify user exists to avoid FK violation
        const userId = input.resolvedBy ?? ctx.user.id;
        const userExists = await ctx.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });

        if (!userExists) {
          logger.warn('Authenticated user not found in DB during alert resolve', {
            userId,
            alertId: input.alertId,
            service: 'alert',
          });
        }

        await resolveAlertService(input.alertId, input.action, userExists ? userId : undefined);

        // Update resolution notes if provided
        if (input.resolutionNotes) {
          await ctx.prisma.slaAlert.update({
            where: { id: input.alertId },
            data: { resolutionNotes: input.resolutionNotes },
          });
        }

        // Fetch full alert with relations for output
        const fullAlert = await getAlertByIdService(input.alertId);

        if (!fullAlert) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve resolved alert',
          });
        }

        return transformAlertToOutput(fullAlert);
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to resolve alert',
        });
      }
    }),

  /**
   * Notify accountant about pending request
   *
   * Sends a Telegram notification to the assigned accountant.
   *
   * @param alertId - Alert UUID
   * @param message - Optional custom message
   * @returns Success status and accountant notified
   * @throws NOT_FOUND if alert doesn't exist
   * @authorization Admins and managers only
   */
  notifyAccountant: managerProcedure
    .input(NotifyAccountantInput)
    .output(
      z.object({
        success: z.boolean(),
        accountantNotified: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get alert with request and chat data
      const alert = await ctx.prisma.slaAlert.findUnique({
        where: { id: input.alertId },
        include: {
          request: {
            include: {
              chat: true,
              assignedUser: true,
            },
          },
        },
      });

      if (!alert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Alert with ID ${input.alertId} not found`,
        });
      }

      // Check if there's an assigned accountant
      const accountant = alert.request.assignedUser;
      if (!accountant) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No accountant assigned to this request',
        });
      }

      // Get accountant's Telegram username from chat sources
      const accountantUsername =
        accountant.telegramUsername ??
        alert.request.chat.accountantUsernames?.[0] ??
        null;
      if (!accountantUsername) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Accountant does not have a Telegram username configured',
        });
      }

      try {
        // Format notification message
        const notificationMessage =
          input.message ||
          formatAccountantNotification(
            alert.request.chat.title,
            alert.minutesElapsed,
            alert.request.messageText
          );

        // Send notification to the chat where the request originated
        // The accountant should see this in their chat
        await bot.telegram.sendMessage(String(alert.request.chatId), notificationMessage, {
          parse_mode: 'HTML',
        });

        return {
          success: true,
          accountantNotified: accountant.fullName,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  /**
   * Update alert delivery status
   *
   * Called by bot to update Telegram message delivery status.
   *
   * @param alertId - Alert UUID
   * @param status - New delivery status
   * @param telegramMessageId - Optional Telegram message ID
   * @returns Updated alert details
   * @throws NOT_FOUND if alert doesn't exist
   * @authorization Admins and managers only
   */
  updateDeliveryStatus: managerProcedure
    .input(UpdateDeliveryStatusInput)
    .output(AlertOutput)
    .mutation(async ({ ctx, input }) => {
      // Verify alert exists
      const existingAlert = await ctx.prisma.slaAlert.findUnique({
        where: { id: input.alertId },
      });

      if (!existingAlert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Alert with ID ${input.alertId} not found`,
        });
      }

      try {
        const telegramMessageId = input.telegramMessageId
          ? BigInt(input.telegramMessageId)
          : undefined;

        await updateDeliveryStatusService(input.alertId, input.status, telegramMessageId);

        // Fetch full alert with relations for output
        const fullAlert = await getAlertByIdService(input.alertId);

        if (!fullAlert) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve updated alert',
          });
        }

        return transformAlertToOutput(fullAlert);
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update delivery status',
        });
      }
    }),

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  /**
   * Get alerts with filters and pagination
   *
   * @param requestId - Filter by request UUID
   * @param managerId - Filter by manager Telegram ID
   * @param alertType - Filter by alert type
   * @param deliveryStatus - Filter by delivery status
   * @param resolved - Filter by resolution status
   * @param dateFrom - Filter from date
   * @param dateTo - Filter to date
   * @param limit - Page size (default: 50, max: 100)
   * @param offset - Pagination offset
   * @returns Paginated list of alerts
   * @authorization All authenticated users
   */
  getAlerts: authedProcedure
    .input(GetAlertsInput)
    .output(AlertListOutput)
    .query(async ({ ctx, input }) => {
      // Build where clause
      const where: Prisma.SlaAlertWhereInput = {};

      if (input.requestId) {
        where.requestId = input.requestId;
      }

      if (input.alertType) {
        where.alertType = input.alertType;
      }

      if (input.deliveryStatus) {
        where.deliveryStatus = input.deliveryStatus;
      }

      if (input.resolved !== undefined) {
        if (input.resolved) {
          where.resolvedAction = { not: null };
        } else {
          where.resolvedAction = null;
        }
      }

      if (input.dateFrom || input.dateTo) {
        where.alertSentAt = {};
        if (input.dateFrom) {
          where.alertSentAt.gte = input.dateFrom;
        }
        if (input.dateTo) {
          where.alertSentAt.lte = input.dateTo;
        }
      }

      // Fetch alerts with pagination
      const [alerts, total] = await Promise.all([
        ctx.prisma.slaAlert.findMany({
          where,
          include: {
            request: {
              include: {
                chat: true,
                assignedUser: true,
              },
            },
            acknowledgedUser: true,
          },
          orderBy: {
            alertSentAt: 'desc',
          },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.slaAlert.count({ where }),
      ]);

      return {
        items: alerts.map(transformAlertToOutput),
        total,
        hasMore: input.offset + alerts.length < total,
      };
    }),

  /**
   * Get alert by ID
   *
   * @param alertId - Alert UUID
   * @returns Alert details with related data
   * @throws NOT_FOUND if alert doesn't exist
   * @authorization All authenticated users
   */
  getAlertById: authedProcedure
    .input(GetAlertByIdInput)
    .output(AlertOutput)
    .query(async ({ ctx, input }) => {
      const alert = await ctx.prisma.slaAlert.findUnique({
        where: { id: input.alertId },
        include: {
          request: {
            include: {
              chat: true,
              assignedUser: true,
            },
          },
          acknowledgedUser: true,
        },
      });

      if (!alert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Alert with ID ${input.alertId} not found`,
        });
      }

      return transformAlertToOutput(alert);
    }),

  /**
   * Get active (unresolved) alerts
   *
   * @param managerId - Optional filter by manager
   * @returns List of active alerts
   * @authorization All authenticated users
   */
  getActiveAlerts: authedProcedure
    .input(GetActiveAlertsInput)
    .output(z.array(AlertOutput))
    .query(async ({ ctx }) => {
      const alerts = await ctx.prisma.slaAlert.findMany({
        where: {
          resolvedAction: null,
        },
        include: {
          request: {
            include: {
              chat: true,
              assignedUser: true,
            },
          },
          acknowledgedUser: true,
        },
        orderBy: {
          alertSentAt: 'desc',
        },
      });

      return alerts.map(transformAlertToOutput);
    }),

  /**
   * Get active alert count (dashboard metric)
   *
   * @returns Count of unresolved alerts
   * @authorization All authenticated users
   */
  getActiveAlertCount: authedProcedure
    .output(z.object({ count: z.number() }))
    .query(async ({ ctx }) => {
      const count = await ctx.prisma.slaAlert.count({
        where: {
          resolvedAction: null,
        },
      });

      return { count };
    }),

  /**
   * Get alert statistics
   *
   * Returns alert metrics for today, this week, and this month.
   *
   * @param managerId - Optional filter by manager
   * @returns Alert statistics
   * @authorization All authenticated users
   */
  getAlertStats: authedProcedure
    .input(GetAlertStatsInput)
    .output(AlertStatsOutput)
    .query(async ({ ctx }) => {
      const now = new Date();

      // Calculate date ranges
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(todayStart);
      monthStart.setDate(monthStart.getDate() - 30);

      // Get today's stats
      const [todayAlerts, weekAlerts, monthBreaches] = await Promise.all([
        ctx.prisma.slaAlert.findMany({
          where: {
            alertSentAt: { gte: todayStart },
          },
          select: {
            alertType: true,
            resolvedAction: true,
          },
        }),
        ctx.prisma.slaAlert.findMany({
          where: {
            alertSentAt: { gte: weekStart },
          },
          select: {
            alertType: true,
            alertSentAt: true,
            acknowledgedAt: true,
          },
        }),
        ctx.prisma.slaAlert.findMany({
          where: {
            alertSentAt: { gte: monthStart },
            alertType: 'breach',
          },
          include: {
            request: {
              select: {
                assignedTo: true,
                assignedUser: {
                  select: {
                    id: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      // Calculate today stats
      const todayTotal = todayAlerts.length;
      const todayWarnings = todayAlerts.filter((a) => a.alertType === 'warning').length;
      const todayBreaches = todayAlerts.filter((a) => a.alertType === 'breach').length;
      const todayResolved = todayAlerts.filter((a) => a.resolvedAction !== null).length;
      const todayPending = todayTotal - todayResolved;

      // Calculate week stats
      const weekTotal = weekAlerts.length;
      const weekWarnings = weekAlerts.filter((a) => a.alertType === 'warning').length;
      const weekBreaches = weekAlerts.filter((a) => a.alertType === 'breach').length;

      // Calculate average resolution time for week
      const resolvedThisWeek = weekAlerts.filter((a) => a.acknowledgedAt !== null);
      let avgResolutionMinutes: number | null = null;
      if (resolvedThisWeek.length > 0) {
        const totalMinutes = resolvedThisWeek.reduce((sum, alert) => {
          if (alert.acknowledgedAt) {
            const diff = alert.acknowledgedAt.getTime() - alert.alertSentAt.getTime();
            return sum + diff / (1000 * 60);
          }
          return sum;
        }, 0);
        avgResolutionMinutes = Math.round(totalMinutes / resolvedThisWeek.length);
      }

      // Calculate month breach stats and top offenders
      const monthTotal = monthBreaches.length;
      const offenderCounts = new Map<string, { name: string; count: number }>();

      for (const breach of monthBreaches) {
        const accountantId = breach.request.assignedTo;
        const accountantName = breach.request.assignedUser?.fullName;

        if (accountantId && accountantName) {
          const existing = offenderCounts.get(accountantId);
          if (existing) {
            existing.count++;
          } else {
            offenderCounts.set(accountantId, { name: accountantName, count: 1 });
          }
        }
      }

      const topOffenders = Array.from(offenderCounts.entries())
        .map(([id, data]) => ({
          accountantId: id,
          accountantName: data.name,
          breachCount: data.count,
        }))
        .sort((a, b) => b.breachCount - a.breachCount)
        .slice(0, 5);

      return {
        today: {
          total: todayTotal,
          warnings: todayWarnings,
          breaches: todayBreaches,
          resolved: todayResolved,
          pending: todayPending,
        },
        week: {
          total: weekTotal,
          warnings: weekWarnings,
          breaches: weekBreaches,
          avgResolutionMinutes,
        },
        month: {
          total: monthTotal,
          breaches: monthTotal,
          topOffenders,
        },
      };
    }),
});

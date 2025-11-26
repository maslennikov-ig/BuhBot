/**
 * Alerts Router - SLA Alert Management
 *
 * Procedures:
 * - listUnacknowledged: List unacknowledged alerts (dashboard widget)
 * - acknowledge: Acknowledge an SLA alert
 *
 * @module api/trpc/routers/alerts
 */

import { router, authedProcedure, managerProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

/**
 * Alert type schema (matches Prisma AlertType enum)
 */
const AlertTypeSchema = z.enum(['warning', 'breach']);

/**
 * Alerts router for SLA alert management
 */
export const alertsRouter = router({
  /**
   * List unacknowledged alerts (dashboard widget)
   *
   * Returns alerts that have not been acknowledged yet, ordered by time elapsed.
   * Includes related request context for display in dashboard.
   *
   * @param limit - Maximum number of alerts (default: 20, max: 50)
   * @returns Array of unacknowledged alerts with request context
   * @authorization All authenticated users (read-only)
   */
  listUnacknowledged: authedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          requestId: z.string().uuid(),
          alertType: AlertTypeSchema,
          minutesElapsed: z.number().int(),
          alertSentAt: z.date(),
          // Related request fields for context
          chatId: z.number(),
          messageText: z.string(),
          clientUsername: z.string().nullable(),
        })
      )
    )
    .query(async ({ ctx, input }) => {
      // Fetch unacknowledged alerts with related request data
      const alerts = await ctx.prisma.slaAlert.findMany({
        where: {
          acknowledgedAt: null,
        },
        select: {
          id: true,
          requestId: true,
          alertType: true,
          minutesElapsed: true,
          alertSentAt: true,
          request: {
            select: {
              chatId: true,
              messageText: true,
              clientUsername: true,
            },
          },
        },
        orderBy: {
          minutesElapsed: 'desc', // Most urgent alerts first
        },
        take: input.limit,
      });

      // Flatten request data into alert object
      return alerts.map((alert) => ({
        id: alert.id,
        requestId: alert.requestId,
        alertType: alert.alertType,
        minutesElapsed: alert.minutesElapsed,
        alertSentAt: alert.alertSentAt,
        chatId: Number(alert.request.chatId),
        messageText: alert.request.messageText,
        clientUsername: alert.request.clientUsername,
      }));
    }),

  /**
   * Acknowledge an SLA alert
   *
   * Marks alert as acknowledged by current user and records resolution notes.
   *
   * @param id - Alert UUID
   * @param resolutionNotes - Optional notes describing resolution
   * @returns Acknowledged alert details
   * @throws NOT_FOUND if alert doesn't exist
   * @throws BAD_REQUEST if alert already acknowledged
   * @authorization Admins and managers only
   */
  acknowledge: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        resolutionNotes: z.string().optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        alert: z.object({
          id: z.string().uuid(),
          acknowledgedAt: z.date(),
          acknowledgedBy: z.string().uuid(),
          resolutionNotes: z.string().nullable(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify alert exists before updating
      const existingAlert = await ctx.prisma.slaAlert.findUnique({
        where: { id: input.id },
      });

      if (!existingAlert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Alert with ID ${input.id} not found`,
        });
      }

      // Check if alert is already acknowledged
      if (existingAlert.acknowledgedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Alert has already been acknowledged',
        });
      }

      // Update alert with acknowledgment
      const acknowledgedAlert = await ctx.prisma.slaAlert.update({
        where: { id: input.id },
        data: {
          acknowledgedAt: new Date(),
          acknowledgedBy: ctx.user.id,
          resolutionNotes: input.resolutionNotes || null,
        },
        select: {
          id: true,
          acknowledgedAt: true,
          acknowledgedBy: true,
          resolutionNotes: true,
        },
      });

      return {
        success: true,
        alert: {
          id: acknowledgedAlert.id,
          acknowledgedAt: acknowledgedAlert.acknowledgedAt!,
          acknowledgedBy: acknowledgedAlert.acknowledgedBy!,
          resolutionNotes: acknowledgedAlert.resolutionNotes,
        },
      };
    }),
});

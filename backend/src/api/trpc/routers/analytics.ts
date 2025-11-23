/**
 * Analytics Router - Reports & Dashboards
 *
 * Procedures:
 * - slaCompliance: Get SLA compliance metrics for dashboard
 * - feedbackSummary: Get feedback summary statistics
 * - accountantPerformance: Get accountant performance comparison
 *
 * @module api/trpc/routers/analytics
 */

import { router, authedProcedure, managerProcedure } from '../trpc';
import { z } from 'zod';

/**
 * Analytics router for reports and dashboards
 */
export const analyticsRouter = router({
  /**
   * Get SLA compliance metrics for dashboard
   *
   * Calculates SLA compliance statistics for a date range.
   * Can be filtered by assigned accountant.
   *
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @param assignedTo - Optional filter by accountant UUID
   * @returns SLA compliance metrics
   * @authorization All authenticated users (read-only)
   */
  slaCompliance: authedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        assignedTo: z.string().uuid().optional(),
      })
    )
    .output(
      z.object({
        totalRequests: z.number().int(),
        answeredWithinSLA: z.number().int(),
        breachedSLA: z.number().int(),
        compliancePercentage: z.number(),
        averageResponseMinutes: z.number(),
        medianResponseMinutes: z.number(),
        p95ResponseMinutes: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build where clause
      const where: any = {
        receivedAt: {
          gte: input.startDate,
          lte: input.endDate,
        },
        isSpam: false, // Exclude spam from analytics
      };
      if (input.assignedTo) {
        where.assignedTo = input.assignedTo;
      }

      // Fetch requests in date range
      const requests = await ctx.prisma.clientRequest.findMany({
        where,
        select: {
          id: true,
          responseTimeMinutes: true,
          status: true,
          chat: {
            select: {
              slaResponseMinutes: true,
            },
          },
        },
      });

      const totalRequests = requests.length;

      if (totalRequests === 0) {
        return {
          totalRequests: 0,
          answeredWithinSLA: 0,
          breachedSLA: 0,
          compliancePercentage: 0,
          averageResponseMinutes: 0,
          medianResponseMinutes: 0,
          p95ResponseMinutes: 0,
        };
      }

      // Calculate SLA compliance
      let answeredWithinSLA = 0;
      let breachedSLA = 0;
      const responseTimes: number[] = [];

      requests.forEach((request: any) => {
        if (request.responseTimeMinutes !== null) {
          responseTimes.push(request.responseTimeMinutes);

          // Check if within SLA threshold
          if (request.responseTimeMinutes <= request.chat.slaResponseMinutes) {
            answeredWithinSLA++;
          } else {
            breachedSLA++;
          }
        }
      });

      // Calculate statistics
      const compliancePercentage =
        totalRequests > 0 ? (answeredWithinSLA / totalRequests) * 100 : 0;

      const averageResponseMinutes =
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

      // Calculate median
      const sortedTimes = [...responseTimes].sort((a, b) => a - b);
      const medianResponseMinutes =
        sortedTimes.length > 0
          ? sortedTimes[Math.floor(sortedTimes.length / 2)] || 0
          : 0;

      // Calculate 95th percentile
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p95ResponseMinutes =
        sortedTimes.length > 0 ? sortedTimes[p95Index] || 0 : 0;

      return {
        totalRequests,
        answeredWithinSLA,
        breachedSLA,
        compliancePercentage: Math.round(compliancePercentage * 100) / 100,
        averageResponseMinutes: Math.round(averageResponseMinutes * 100) / 100,
        medianResponseMinutes,
        p95ResponseMinutes,
      };
    }),

  /**
   * Get feedback summary statistics
   *
   * Calculates feedback rating distribution for a date range.
   *
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @returns Feedback summary statistics
   * @authorization All authenticated users (read-only)
   */
  feedbackSummary: authedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .output(
      z.object({
        totalResponses: z.number().int(),
        averageRating: z.number(),
        ratingDistribution: z.object({
          star1: z.number().int(),
          star2: z.number().int(),
          star3: z.number().int(),
          star4: z.number().int(),
          star5: z.number().int(),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      // Fetch feedback responses in date range
      const responses = await ctx.prisma.feedbackResponse.findMany({
        where: {
          submittedAt: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        select: {
          rating: true,
        },
      });

      const totalResponses = responses.length;

      if (totalResponses === 0) {
        return {
          totalResponses: 0,
          averageRating: 0,
          ratingDistribution: {
            star1: 0,
            star2: 0,
            star3: 0,
            star4: 0,
            star5: 0,
          },
        };
      }

      // Calculate average rating
      const totalRating = responses.reduce((sum: number, r: any) => sum + r.rating, 0);
      const averageRating = totalRating / totalResponses;

      // Calculate rating distribution
      const distribution = {
        star1: 0,
        star2: 0,
        star3: 0,
        star4: 0,
        star5: 0,
      };

      responses.forEach((r: any) => {
        if (r.rating === 1) distribution.star1++;
        else if (r.rating === 2) distribution.star2++;
        else if (r.rating === 3) distribution.star3++;
        else if (r.rating === 4) distribution.star4++;
        else if (r.rating === 5) distribution.star5++;
      });

      return {
        totalResponses,
        averageRating: Math.round(averageRating * 100) / 100,
        ratingDistribution: distribution,
      };
    }),

  /**
   * Get accountant performance comparison
   *
   * Compares performance metrics across all accountants for a date range.
   *
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @returns Array of accountant performance metrics
   * @authorization Admins and managers only
   */
  accountantPerformance: managerProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .output(
      z.array(
        z.object({
          accountantId: z.string().uuid(),
          accountantName: z.string(),
          totalRequests: z.number().int(),
          answeredWithinSLA: z.number().int(),
          averageResponseMinutes: z.number(),
          averageFeedbackRating: z.number().nullable(),
        })
      )
    )
    .query(async ({ ctx, input }) => {
      // Fetch all accountants
      const accountants = await ctx.prisma.user.findMany({
        select: {
          id: true,
          fullName: true,
        },
      });

      // Fetch requests for each accountant
      const performance = await Promise.all(
        accountants.map(async (accountant: any) => {
          // Get requests assigned to this accountant
          const requests = await ctx.prisma.clientRequest.findMany({
            where: {
              assignedTo: accountant.id,
              receivedAt: {
                gte: input.startDate,
                lte: input.endDate,
              },
              classification: 'REQUEST', // Only count actual requests, not SPAM/GRATITUDE/CLARIFICATION
            },
            select: {
              id: true,
              responseTimeMinutes: true,
              chat: {
                select: {
                  slaResponseMinutes: true,
                },
              },
            },
          });

          const totalRequests = requests.length;

          if (totalRequests === 0) {
            return {
              accountantId: accountant.id,
              accountantName: accountant.fullName,
              totalRequests: 0,
              answeredWithinSLA: 0,
              averageResponseMinutes: 0,
              averageFeedbackRating: null,
            };
          }

          // Calculate SLA compliance
          let answeredWithinSLA = 0;
          const responseTimes: number[] = [];

          requests.forEach((request: any) => {
            if (request.responseTimeMinutes !== null) {
              responseTimes.push(request.responseTimeMinutes);
              if (request.responseTimeMinutes <= request.chat.slaResponseMinutes) {
                answeredWithinSLA++;
              }
            }
          });

          const averageResponseMinutes =
            responseTimes.length > 0
              ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
              : 0;

          // Get feedback ratings for this accountant's chats
          const requestIds = requests.map((r: any) => r.id);
          const feedbackResponses = await ctx.prisma.feedbackResponse.findMany({
            where: {
              requestId: {
                in: requestIds,
              },
            },
            select: {
              rating: true,
            },
          });

          const averageFeedbackRating =
            feedbackResponses.length > 0
              ? feedbackResponses.reduce((sum: number, f: any) => sum + f.rating, 0) /
                feedbackResponses.length
              : null;

          return {
            accountantId: accountant.id,
            accountantName: accountant.fullName,
            totalRequests,
            answeredWithinSLA,
            averageResponseMinutes: Math.round(averageResponseMinutes * 100) / 100,
            averageFeedbackRating:
              averageFeedbackRating !== null
                ? Math.round(averageFeedbackRating * 100) / 100
                : null,
          };
        })
      );

      // Filter out accountants with no requests
      return performance.filter((p: { totalRequests: number }) => p.totalRequests > 0);
    }),
});

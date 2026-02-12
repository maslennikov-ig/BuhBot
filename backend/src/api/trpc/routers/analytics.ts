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

import { router, authedProcedure, managerProcedure } from '../trpc.js';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

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
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
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
      const where: Prisma.ClientRequestWhereInput = {
        receivedAt: {
          gte: input.startDate,
          lte: input.endDate,
        },
        classification: 'REQUEST', // Only count actual requests
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
          slaBreached: true,
          status: true,
          chat: {
            select: {
              slaThresholdMinutes: true,
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

      requests.forEach((request) => {
        if (request.responseTimeMinutes !== null) {
          responseTimes.push(request.responseTimeMinutes);

          // Check if within SLA threshold
          if (request.responseTimeMinutes <= request.chat.slaThresholdMinutes) {
            answeredWithinSLA++;
          } else {
            breachedSLA++;
          }
        } else if (request.slaBreached) {
          // Unanswered requests that breached SLA count as breached
          breachedSLA++;
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
        sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] || 0 : 0;

      // Calculate 95th percentile
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p95ResponseMinutes = sortedTimes.length > 0 ? sortedTimes[p95Index] || 0 : 0;

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
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
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
      const totalRating = responses.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = totalRating / totalResponses;

      // Calculate rating distribution
      const distribution = {
        star1: 0,
        star2: 0,
        star3: 0,
        star4: 0,
        star5: 0,
      };

      responses.forEach((r) => {
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
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
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
        accountants.map(async (accountant) => {
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
                  slaThresholdMinutes: true,
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

          requests.forEach((request) => {
            if (request.responseTimeMinutes !== null) {
              responseTimes.push(request.responseTimeMinutes);
              if (request.responseTimeMinutes <= request.chat.slaThresholdMinutes) {
                answeredWithinSLA++;
              }
            }
          });

          const averageResponseMinutes =
            responseTimes.length > 0
              ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
              : 0;

          // Get feedback ratings for this accountant's chats
          const requestIds = requests.map((r) => r.id);
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
              ? feedbackResponses.reduce((sum, f) => sum + f.rating, 0) / feedbackResponses.length
              : null;

          return {
            accountantId: accountant.id,
            accountantName: accountant.fullName,
            totalRequests,
            answeredWithinSLA,
            averageResponseMinutes: Math.round(averageResponseMinutes * 100) / 100,
            averageFeedbackRating:
              averageFeedbackRating !== null ? Math.round(averageFeedbackRating * 100) / 100 : null,
          };
        })
      );

      // Filter out accountants with no requests
      return performance.filter((p: { totalRequests: number }) => p.totalRequests > 0);
    }),

  /**
   * Get dashboard data with KPIs, trends, and recent activity
   *
   * Returns main KPIs (SLA compliance, response time, violations),
   * trends vs previous period, recent requests, and accountant rankings.
   *
   * @param timezone - Timezone for date calculations (default: Europe/Moscow)
   * @returns Dashboard data with KPIs, trends, and activity
   * @authorization All authenticated users (read-only)
   */
  getDashboard: authedProcedure
    .input(
      z.object({
        timezone: z.string().default('Europe/Moscow'),
      })
    )
    .output(
      z.object({
        slaCompliancePercent: z.number(),
        avgResponseTimeMinutes: z.number(),
        totalViolationsToday: z.number(),
        totalViolationsWeek: z.number(),
        activeAlertsCount: z.number(),
        slaComplianceTrend: z.number(),
        responseTimeTrend: z.number(),
        recentRequests: z.array(
          z.object({
            id: z.string().uuid(),
            chatTitle: z.string().nullable(),
            clientUsername: z.string().nullable(),
            messagePreview: z.string(),
            status: z.enum(['pending', 'in_progress', 'answered', 'escalated']),
            receivedAt: z.date(),
            responseMinutes: z.number().nullable(),
            breached: z.boolean(),
          })
        ),
        topAccountants: z.array(
          z.object({
            id: z.string().uuid(),
            name: z.string(),
            avgResponseMinutes: z.number(),
            compliancePercent: z.number(),
          })
        ),
        attentionNeeded: z.array(
          z.object({
            id: z.string().uuid(),
            name: z.string(),
            violationsCount: z.number(),
            avgResponseMinutes: z.number(),
          })
        ),
        responseTimeChartData: z.array(
          z.object({
            date: z.date(),
            dayLabel: z.string(),
            avgResponseMinutes: z.number(),
            requestCount: z.number(),
          })
        ),
        violationsLast7Days: z.array(z.number()),
      })
    )
    .query(async ({ ctx }) => {
      // Calculate date ranges (using UTC, adjust for timezone display on client)
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);

      // Get violations for today
      const todayViolations = await ctx.prisma.clientRequest.count({
        where: {
          slaBreached: true,
          classification: 'REQUEST',
          receivedAt: { gte: todayStart },
        },
      });

      // Get violations for this week
      const weekViolations = await ctx.prisma.clientRequest.count({
        where: {
          slaBreached: true,
          classification: 'REQUEST',
          receivedAt: { gte: weekStart },
        },
      });

      // Get active alerts (pending or sent)
      const activeAlerts = await ctx.prisma.slaAlert.count({
        where: {
          deliveryStatus: { in: ['pending', 'sent'] },
          acknowledgedAt: null,
        },
      });

      // Get current week requests for SLA calculation
      const currentWeekRequests = await ctx.prisma.clientRequest.findMany({
        where: {
          classification: 'REQUEST',
          receivedAt: { gte: weekStart },
        },
        select: {
          responseTimeMinutes: true,
          slaBreached: true,
        },
      });

      // Get previous week requests for trend calculation
      const prevWeekRequests = await ctx.prisma.clientRequest.findMany({
        where: {
          classification: 'REQUEST',
          receivedAt: { gte: prevWeekStart, lt: weekStart },
        },
        select: {
          responseTimeMinutes: true,
          slaBreached: true,
        },
      });

      // Calculate current week SLA compliance
      const currentTotal = currentWeekRequests.length;
      const currentCompliant = currentWeekRequests.filter((r) => !r.slaBreached).length;
      const currentCompliancePercent =
        currentTotal > 0 ? (currentCompliant / currentTotal) * 100 : 100;

      // Calculate current week avg response time
      const currentResponseTimes = currentWeekRequests
        .filter((r) => r.responseTimeMinutes !== null)
        .map((r) => r.responseTimeMinutes as number);
      const currentAvgResponseTime =
        currentResponseTimes.length > 0
          ? currentResponseTimes.reduce((a, b) => a + b, 0) / currentResponseTimes.length
          : 0;

      // Calculate previous week SLA compliance
      const prevTotal = prevWeekRequests.length;
      const prevCompliant = prevWeekRequests.filter((r) => !r.slaBreached).length;
      const prevCompliancePercent = prevTotal > 0 ? (prevCompliant / prevTotal) * 100 : 100;

      // Calculate previous week avg response time
      const prevResponseTimes = prevWeekRequests
        .filter((r) => r.responseTimeMinutes !== null)
        .map((r) => r.responseTimeMinutes as number);
      const prevAvgResponseTime =
        prevResponseTimes.length > 0
          ? prevResponseTimes.reduce((a, b) => a + b, 0) / prevResponseTimes.length
          : 0;

      // Calculate trends
      const slaComplianceTrend = currentCompliancePercent - prevCompliancePercent;
      const responseTimeTrend = currentAvgResponseTime - prevAvgResponseTime;

      // Get recent 10 requests
      const recentRequestsRaw = await ctx.prisma.clientRequest.findMany({
        where: {
          classification: 'REQUEST',
        },
        orderBy: { receivedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          messageText: true,
          clientUsername: true,
          status: true,
          receivedAt: true,
          responseTimeMinutes: true,
          slaBreached: true,
          chat: {
            select: {
              title: true,
            },
          },
        },
      });

      const recentRequests = recentRequestsRaw.map((r) => ({
        id: r.id,
        chatTitle: r.chat?.title ?? null,
        clientUsername: r.clientUsername,
        messagePreview:
          r.messageText.length > 100 ? r.messageText.slice(0, 100) + '...' : r.messageText,
        status: r.status as 'pending' | 'in_progress' | 'answered' | 'escalated',
        receivedAt: r.receivedAt,
        responseMinutes: r.responseTimeMinutes,
        breached: r.slaBreached,
      }));

      // Get accountants with their performance this week
      const accountants = await ctx.prisma.user.findMany({
        select: {
          id: true,
          fullName: true,
        },
      });

      const accountantStats = await Promise.all(
        accountants.map(async (acc) => {
          const requests = await ctx.prisma.clientRequest.findMany({
            where: {
              assignedTo: acc.id,
              classification: 'REQUEST',
              receivedAt: { gte: weekStart },
            },
            select: {
              responseTimeMinutes: true,
              slaBreached: true,
            },
          });

          const total = requests.length;
          const violations = requests.filter((r) => r.slaBreached).length;
          const compliant = total - violations;
          const compliancePercent = total > 0 ? (compliant / total) * 100 : 100;

          const responseTimes = requests
            .filter((r) => r.responseTimeMinutes !== null)
            .map((r) => r.responseTimeMinutes as number);
          const avgResponseMinutes =
            responseTimes.length > 0
              ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
              : 0;

          return {
            id: acc.id,
            name: acc.fullName,
            totalRequests: total,
            violations,
            compliancePercent: Math.round(compliancePercent * 100) / 100,
            avgResponseMinutes: Math.round(avgResponseMinutes * 100) / 100,
          };
        })
      );

      // Top 5 accountants by compliance (only those with requests)
      const topAccountants = accountantStats
        .filter((a) => a.totalRequests > 0)
        .sort(
          (a, b) =>
            b.compliancePercent - a.compliancePercent || a.avgResponseMinutes - b.avgResponseMinutes
        )
        .slice(0, 5)
        .map((a) => ({
          id: a.id,
          name: a.name,
          avgResponseMinutes: a.avgResponseMinutes,
          compliancePercent: a.compliancePercent,
        }));

      // Accountants needing attention (violations > 0 this week)
      const attentionNeeded = accountantStats
        .filter((a) => a.violations > 0)
        .sort((a, b) => b.violations - a.violations)
        .map((a) => ({
          id: a.id,
          name: a.name,
          violationsCount: a.violations,
          avgResponseMinutes: a.avgResponseMinutes,
        }));

      // Calculate 7-day response time chart data
      const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      const responseTimeChartData: Array<{
        date: Date;
        dayLabel: string;
        avgResponseMinutes: number;
        requestCount: number;
      }> = [];

      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dayRequests = await ctx.prisma.clientRequest.findMany({
          where: {
            classification: 'REQUEST',
            receivedAt: { gte: dayStart, lte: dayEnd },
            responseTimeMinutes: { not: null },
          },
          select: {
            responseTimeMinutes: true,
          },
        });

        const responseTimes = dayRequests.map((r) => r.responseTimeMinutes as number);
        const avgTime =
          responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0;

        responseTimeChartData.push({
          date: dayStart,
          dayLabel: dayLabels[dayStart.getDay()] ?? '',
          avgResponseMinutes: Math.round(avgTime * 100) / 100,
          requestCount: dayRequests.length,
        });
      }

      // Calculate violations for each of the last 7 days
      const violationsLast7Days: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dayViolations = await ctx.prisma.clientRequest.count({
          where: {
            slaBreached: true,
            classification: 'REQUEST',
            receivedAt: { gte: dayStart, lte: dayEnd },
          },
        });

        violationsLast7Days.push(dayViolations);
      }

      return {
        slaCompliancePercent: Math.round(currentCompliancePercent * 100) / 100,
        avgResponseTimeMinutes: Math.round(currentAvgResponseTime * 100) / 100,
        totalViolationsToday: todayViolations,
        totalViolationsWeek: weekViolations,
        activeAlertsCount: activeAlerts,
        slaComplianceTrend: Math.round(slaComplianceTrend * 100) / 100,
        responseTimeTrend: Math.round(responseTimeTrend * 100) / 100,
        recentRequests,
        topAccountants,
        attentionNeeded,
        responseTimeChartData,
        violationsLast7Days,
      };
    }),

  /**
   * Get detailed accountant performance statistics
   *
   * Returns per-accountant metrics including requests, violations,
   * response time stats (avg, min, max, median), and assigned chats.
   *
   * @param accountantId - Optional filter by specific accountant
   * @param dateFrom - Optional start date filter
   * @param dateTo - Optional end date filter
   * @param sortBy - Sort field (responseTime, violations, compliance)
   * @param sortOrder - Sort direction (asc, desc)
   * @returns Accountant statistics with performance metrics
   * @authorization Managers and admins only
   */
  getAccountantStats: managerProcedure
    .input(
      z.object({
        accountantId: z.string().uuid().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        sortBy: z.enum(['responseTime', 'violations', 'compliance']).default('compliance'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      })
    )
    .output(
      z.object({
        items: z.array(
          z.object({
            accountantId: z.string().uuid(),
            accountantName: z.string(),
            email: z.string(),
            totalRequests: z.number(),
            answeredRequests: z.number(),
            violations: z.number(),
            compliancePercent: z.number(),
            avgResponseMinutes: z.number(),
            minResponseMinutes: z.number(),
            maxResponseMinutes: z.number(),
            medianResponseMinutes: z.number(),
            assignedChats: z.number(),
          })
        ),
        total: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build user filter
      const userWhere: Prisma.UserWhereInput = {};
      if (input.accountantId) {
        userWhere.id = input.accountantId;
      }

      // Fetch accountants
      const accountants = await ctx.prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      });

      // Build request date filter
      const dateFilter: Prisma.DateTimeFilter = {};
      if (input.dateFrom) {
        dateFilter.gte = input.dateFrom;
      }
      if (input.dateTo) {
        dateFilter.lte = input.dateTo;
      }

      // Get stats for each accountant
      const stats = await Promise.all(
        accountants.map(async (acc) => {
          // Build where clause for requests
          const requestWhere: Prisma.ClientRequestWhereInput = {
            assignedTo: acc.id,
            classification: 'REQUEST',
          };
          if (Object.keys(dateFilter).length > 0) {
            requestWhere.receivedAt = dateFilter;
          }

          // Get requests for this accountant
          const requests = await ctx.prisma.clientRequest.findMany({
            where: requestWhere,
            select: {
              status: true,
              responseTimeMinutes: true,
              slaBreached: true,
            },
          });

          // Count assigned chats
          const assignedChats = await ctx.prisma.chat.count({
            where: {
              assignedAccountantId: acc.id,
            },
          });

          const totalRequests = requests.length;
          const answeredRequests = requests.filter(
            (r) => r.status === 'answered' || r.status === 'escalated'
          ).length;
          const violations = requests.filter((r) => r.slaBreached).length;
          const compliancePercent =
            totalRequests > 0 ? ((totalRequests - violations) / totalRequests) * 100 : 100;

          // Calculate response time stats
          const responseTimes = requests
            .filter((r) => r.responseTimeMinutes !== null)
            .map((r) => r.responseTimeMinutes as number)
            .sort((a, b) => a - b);

          let avgResponseMinutes = 0;
          let minResponseMinutes = 0;
          let maxResponseMinutes = 0;
          let medianResponseMinutes = 0;

          if (responseTimes.length > 0) {
            avgResponseMinutes = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            minResponseMinutes = responseTimes[0] ?? 0;
            maxResponseMinutes = responseTimes[responseTimes.length - 1] ?? 0;
            medianResponseMinutes = responseTimes[Math.floor(responseTimes.length / 2)] ?? 0;
          }

          return {
            accountantId: acc.id,
            accountantName: acc.fullName,
            email: acc.email,
            totalRequests,
            answeredRequests,
            violations,
            compliancePercent: Math.round(compliancePercent * 100) / 100,
            avgResponseMinutes: Math.round(avgResponseMinutes * 100) / 100,
            minResponseMinutes: Math.round(minResponseMinutes * 100) / 100,
            maxResponseMinutes: Math.round(maxResponseMinutes * 100) / 100,
            medianResponseMinutes: Math.round(medianResponseMinutes * 100) / 100,
            assignedChats,
          };
        })
      );

      // Sort results
      const sorted = [...stats].sort((a, b) => {
        let comparison = 0;
        switch (input.sortBy) {
          case 'responseTime':
            comparison = a.avgResponseMinutes - b.avgResponseMinutes;
            break;
          case 'violations':
            comparison = a.violations - b.violations;
            break;
          case 'compliance':
          default:
            comparison = a.compliancePercent - b.compliancePercent;
            break;
        }
        return input.sortOrder === 'asc' ? comparison : -comparison;
      });

      return {
        items: sorted,
        total: sorted.length,
      };
    }),

  /**
   * Export analytics report in CSV or JSON format
   *
   * Generates a downloadable report for SLA compliance,
   * accountant performance, or violations data.
   * Returns a data URL for MVP (no blob storage).
   *
   * @param reportType - Type of report (sla_compliance, accountant_performance, violations)
   * @param dateFrom - Start date for report
   * @param dateTo - End date for report
   * @param chatId - Optional filter by chat
   * @param accountantId - Optional filter by accountant
   * @param format - Export format (csv, json)
   * @returns Download URL, filename, expiration, and row count
   * @authorization Managers and admins only
   */
  exportReport: managerProcedure
    .input(
      z.object({
        reportType: z.enum(['sla_compliance', 'accountant_performance', 'violations']),
        dateFrom: z.coerce.date(),
        dateTo: z.coerce.date(),
        chatId: z.string().optional(),
        accountantId: z.string().uuid().optional(),
        format: z.enum(['csv', 'json']).default('csv'),
      })
    )
    .output(
      z.object({
        downloadUrl: z.string().url(),
        filename: z.string(),
        expiresAt: z.date(),
        rowCount: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build base where clause
      const baseWhere: Prisma.ClientRequestWhereInput = {
        receivedAt: {
          gte: input.dateFrom,
          lte: input.dateTo,
        },
        classification: 'REQUEST',
      };

      if (input.chatId) {
        baseWhere.chatId = BigInt(input.chatId);
      }
      if (input.accountantId) {
        baseWhere.assignedTo = input.accountantId;
      }

      let data: Record<string, unknown>[] = [];
      let headers: string[] = [];

      switch (input.reportType) {
        case 'sla_compliance': {
          const requests = await ctx.prisma.clientRequest.findMany({
            where: baseWhere,
            select: {
              id: true,
              chatId: true,
              clientUsername: true,
              receivedAt: true,
              responseAt: true,
              responseTimeMinutes: true,
              slaBreached: true,
              status: true,
              chat: {
                select: {
                  title: true,
                  slaThresholdMinutes: true,
                },
              },
              assignedUser: {
                select: {
                  fullName: true,
                },
              },
            },
            orderBy: { receivedAt: 'desc' },
          });

          headers = [
            'request_id',
            'chat_id',
            'chat_title',
            'client_username',
            'accountant',
            'received_at',
            'response_at',
            'response_time_minutes',
            'sla_threshold_minutes',
            'sla_breached',
            'status',
          ];

          data = requests.map((r) => ({
            request_id: r.id,
            chat_id: r.chatId.toString(),
            chat_title: r.chat?.title ?? '',
            client_username: r.clientUsername ?? '',
            accountant: r.assignedUser?.fullName ?? '',
            received_at: r.receivedAt.toISOString(),
            response_at: r.responseAt?.toISOString() ?? '',
            response_time_minutes: r.responseTimeMinutes ?? '',
            sla_threshold_minutes: r.chat?.slaThresholdMinutes ?? '',
            sla_breached: r.slaBreached ? 'Yes' : 'No',
            status: r.status,
          }));
          break;
        }

        case 'accountant_performance': {
          const accountantFilter: Prisma.UserWhereInput = {};
          if (input.accountantId) {
            accountantFilter.id = input.accountantId;
          }

          const accountants = await ctx.prisma.user.findMany({
            where: accountantFilter,
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          });

          headers = [
            'accountant_id',
            'accountant_name',
            'email',
            'total_requests',
            'answered_requests',
            'violations',
            'compliance_percent',
            'avg_response_minutes',
          ];

          const statsPromises = accountants.map(async (acc) => {
            const requests = await ctx.prisma.clientRequest.findMany({
              where: {
                ...baseWhere,
                assignedTo: acc.id,
              },
              select: {
                status: true,
                slaBreached: true,
                responseTimeMinutes: true,
              },
            });

            const totalRequests = requests.length;
            const answeredRequests = requests.filter(
              (r) => r.status === 'answered' || r.status === 'escalated'
            ).length;
            const violations = requests.filter((r) => r.slaBreached).length;
            const compliancePercent =
              totalRequests > 0
                ? Math.round(((totalRequests - violations) / totalRequests) * 10000) / 100
                : 100;
            const responseTimes = requests
              .filter((r) => r.responseTimeMinutes !== null)
              .map((r) => r.responseTimeMinutes as number);
            const avgResponseMinutes =
              responseTimes.length > 0
                ? Math.round(
                    (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 100
                  ) / 100
                : 0;

            return {
              accountant_id: acc.id,
              accountant_name: acc.fullName,
              email: acc.email,
              total_requests: totalRequests,
              answered_requests: answeredRequests,
              violations,
              compliance_percent: compliancePercent,
              avg_response_minutes: avgResponseMinutes,
            };
          });

          data = await Promise.all(statsPromises);
          break;
        }

        case 'violations': {
          const violationRequests = await ctx.prisma.clientRequest.findMany({
            where: {
              ...baseWhere,
              slaBreached: true,
            },
            select: {
              id: true,
              chatId: true,
              clientUsername: true,
              messageText: true,
              receivedAt: true,
              responseAt: true,
              responseTimeMinutes: true,
              status: true,
              chat: {
                select: {
                  title: true,
                  slaThresholdMinutes: true,
                },
              },
              assignedUser: {
                select: {
                  fullName: true,
                },
              },
              slaAlerts: {
                select: {
                  alertType: true,
                  alertSentAt: true,
                },
                orderBy: { alertSentAt: 'desc' },
                take: 1,
              },
            },
            orderBy: { receivedAt: 'desc' },
          });

          headers = [
            'request_id',
            'chat_id',
            'chat_title',
            'client_username',
            'message_preview',
            'accountant',
            'received_at',
            'response_at',
            'response_time_minutes',
            'sla_threshold_minutes',
            'overtime_minutes',
            'alert_type',
            'alert_sent_at',
            'status',
          ];

          data = violationRequests.map((r) => {
            const slaThreshold = r.chat?.slaThresholdMinutes ?? 60;
            const overtime =
              r.responseTimeMinutes !== null ? r.responseTimeMinutes - slaThreshold : 0;
            const latestAlert = r.slaAlerts[0];

            return {
              request_id: r.id,
              chat_id: r.chatId.toString(),
              chat_title: r.chat?.title ?? '',
              client_username: r.clientUsername ?? '',
              message_preview:
                r.messageText.length > 50 ? r.messageText.slice(0, 50) + '...' : r.messageText,
              accountant: r.assignedUser?.fullName ?? '',
              received_at: r.receivedAt.toISOString(),
              response_at: r.responseAt?.toISOString() ?? '',
              response_time_minutes: r.responseTimeMinutes ?? '',
              sla_threshold_minutes: slaThreshold,
              overtime_minutes: overtime > 0 ? overtime : 0,
              alert_type: latestAlert?.alertType ?? '',
              alert_sent_at: latestAlert?.alertSentAt?.toISOString() ?? '',
              status: r.status,
            };
          });
          break;
        }
      }

      // Format dates for filename
      const dateFromStr = input.dateFrom.toISOString().split('T')[0];
      const dateToStr = input.dateTo.toISOString().split('T')[0];
      const filename = `${input.reportType}-${dateFromStr}-${dateToStr}.${input.format}`;

      // Generate content based on format
      let content: string;
      if (input.format === 'json') {
        content = JSON.stringify(data, null, 2);
      } else {
        // CSV format
        const csvRows = [headers.join(',')];
        for (const row of data) {
          const values = headers.map((h) => {
            const val = row[h];
            // Escape quotes and wrap in quotes if contains comma or newline
            if (
              typeof val === 'string' &&
              (val.includes(',') || val.includes('"') || val.includes('\n'))
            ) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return String(val ?? '');
          });
          csvRows.push(values.join(','));
        }
        content = csvRows.join('\n');
      }

      // Create data URL (MVP solution without blob storage)
      const mimeType = input.format === 'json' ? 'application/json' : 'text/csv';
      const base64Content = Buffer.from(content, 'utf-8').toString('base64');
      const downloadUrl = `data:${mimeType};base64,${base64Content}`;

      // Set expiration to 1 hour from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      return {
        downloadUrl,
        filename,
        expiresAt,
        rowCount: data.length,
      };
    }),

  /**
   * Get response time history with configurable granularity
   *
   * Returns time series data for response time analytics page.
   * Automatically selects hourly or daily granularity based on date range.
   *
   * @param periodStart - Start date
   * @param periodEnd - End date
   * @param chatId - Optional filter by chat
   * @param accountantId - Optional filter by accountant
   * @returns Time series data with summary statistics
   * @authorization All authenticated users (read-only)
   */
  getResponseTimeHistory: authedProcedure
    .input(
      z.object({
        periodStart: z.coerce.date(),
        periodEnd: z.coerce.date(),
        chatId: z.string().optional(),
        accountantId: z.string().uuid().optional(),
      })
    )
    .output(
      z.object({
        dataPoints: z.array(
          z.object({
            timestamp: z.date(),
            label: z.string(),
            avgResponseMinutes: z.number(),
            medianResponseMinutes: z.number(),
            p95ResponseMinutes: z.number(),
            requestCount: z.number(),
          })
        ),
        summary: z.object({
          avgResponseMinutes: z.number(),
          medianResponseMinutes: z.number(),
          p95ResponseMinutes: z.number(),
          minResponseMinutes: z.number(),
          maxResponseMinutes: z.number(),
          totalRequests: z.number(),
          avgTrendPercent: z.number(),
          medianTrendPercent: z.number(),
          p95TrendPercent: z.number(),
        }),
        granularity: z.enum(['hour', 'day']),
      })
    )
    .query(async ({ ctx, input }) => {
      const { periodStart, periodEnd, chatId, accountantId } = input;

      // Determine granularity: hourly if < 3 days, otherwise daily
      const diffDays = Math.ceil(
        (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      const granularity: 'hour' | 'day' = diffDays < 3 ? 'hour' : 'day';

      // Build where clause
      const where: Prisma.ClientRequestWhereInput = {
        classification: 'REQUEST',
        receivedAt: { gte: periodStart, lte: periodEnd },
        responseTimeMinutes: { not: null },
      };
      if (chatId) {
        where.chatId = BigInt(chatId);
      }
      if (accountantId) {
        where.assignedTo = accountantId;
      }

      // Fetch all requests in period
      const requests = await ctx.prisma.clientRequest.findMany({
        where,
        select: {
          receivedAt: true,
          responseTimeMinutes: true,
        },
        orderBy: { receivedAt: 'asc' },
      });

      // Group by time bucket
      const buckets = new Map<string, number[]>();
      const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

      requests.forEach((r) => {
        const date = new Date(r.receivedAt);
        let key: string;
        if (granularity === 'hour') {
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
        } else {
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        }
        if (!buckets.has(key)) {
          buckets.set(key, []);
        }
        buckets.get(key)!.push(r.responseTimeMinutes as number);
      });

      // Calculate percentile helper
      const percentile = (arr: number[], p: number): number => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)] ?? 0;
      };

      // Build data points
      const dataPoints: Array<{
        timestamp: Date;
        label: string;
        avgResponseMinutes: number;
        medianResponseMinutes: number;
        p95ResponseMinutes: number;
        requestCount: number;
      }> = [];

      // Generate all time slots in range
      const current = new Date(periodStart);
      while (current <= periodEnd) {
        let key: string;
        let label: string;
        if (granularity === 'hour') {
          key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}-${current.getHours()}`;
          label = `${current.getHours()}:00`;
        } else {
          key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`;
          label = `${dayLabels[current.getDay()]} ${current.getDate()}`;
        }

        const times = buckets.get(key) ?? [];
        const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

        dataPoints.push({
          timestamp: new Date(current),
          label,
          avgResponseMinutes: Math.round(avg * 100) / 100,
          medianResponseMinutes: Math.round(percentile(times, 50) * 100) / 100,
          p95ResponseMinutes: Math.round(percentile(times, 95) * 100) / 100,
          requestCount: times.length,
        });

        // Increment
        if (granularity === 'hour') {
          current.setHours(current.getHours() + 1);
        } else {
          current.setDate(current.getDate() + 1);
        }
      }

      // Calculate summary from all requests
      const allTimes = requests.map((r) => r.responseTimeMinutes as number);
      const totalRequests = allTimes.length;

      const summaryAvg =
        totalRequests > 0 ? allTimes.reduce((a, b) => a + b, 0) / totalRequests : 0;
      const summaryMedian = percentile(allTimes, 50);
      const summaryP95 = percentile(allTimes, 95);
      const summaryMin = totalRequests > 0 ? Math.min(...allTimes) : 0;
      const summaryMax = totalRequests > 0 ? Math.max(...allTimes) : 0;

      // Calculate previous period for trends
      const periodLength = periodEnd.getTime() - periodStart.getTime();
      const prevStart = new Date(periodStart.getTime() - periodLength);
      const prevEnd = new Date(periodStart.getTime() - 1);

      const prevWhere: Prisma.ClientRequestWhereInput = {
        ...where,
        receivedAt: { gte: prevStart, lte: prevEnd },
      };

      const prevRequests = await ctx.prisma.clientRequest.findMany({
        where: prevWhere,
        select: { responseTimeMinutes: true },
      });

      const prevTimes = prevRequests.map((r) => r.responseTimeMinutes as number);
      const prevAvg =
        prevTimes.length > 0 ? prevTimes.reduce((a, b) => a + b, 0) / prevTimes.length : 0;
      const prevMedian = percentile(prevTimes, 50);
      const prevP95 = percentile(prevTimes, 95);

      // Calculate trend percentages
      const calcTrend = (current: number, previous: number): number => {
        if (previous === 0) return 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      return {
        dataPoints,
        summary: {
          avgResponseMinutes: Math.round(summaryAvg * 100) / 100,
          medianResponseMinutes: Math.round(summaryMedian * 100) / 100,
          p95ResponseMinutes: Math.round(summaryP95 * 100) / 100,
          minResponseMinutes: Math.round(summaryMin * 100) / 100,
          maxResponseMinutes: Math.round(summaryMax * 100) / 100,
          totalRequests,
          avgTrendPercent: calcTrend(summaryAvg, prevAvg),
          medianTrendPercent: calcTrend(summaryMedian, prevMedian),
          p95TrendPercent: calcTrend(summaryP95, prevP95),
        },
        granularity,
      };
    }),

  /**
   * Get response time distribution by buckets
   *
   * Returns count and percentage of requests in each time bucket.
   *
   * @param periodStart - Start date
   * @param periodEnd - End date
   * @param chatId - Optional filter by chat
   * @param accountantId - Optional filter by accountant
   * @returns Bucket distribution data
   * @authorization All authenticated users (read-only)
   */
  getResponseTimeDistribution: authedProcedure
    .input(
      z.object({
        periodStart: z.coerce.date(),
        periodEnd: z.coerce.date(),
        chatId: z.string().optional(),
        accountantId: z.string().uuid().optional(),
      })
    )
    .output(
      z.object({
        buckets: z.array(
          z.object({
            label: z.string(),
            minMinutes: z.number(),
            maxMinutes: z.number().nullable(),
            count: z.number(),
            percentage: z.number(),
          })
        ),
        totalRequests: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { periodStart, periodEnd, chatId, accountantId } = input;

      // Build where clause
      const where: Prisma.ClientRequestWhereInput = {
        classification: 'REQUEST',
        receivedAt: { gte: periodStart, lte: periodEnd },
        responseTimeMinutes: { not: null },
      };
      if (chatId) {
        where.chatId = BigInt(chatId);
      }
      if (accountantId) {
        where.assignedTo = accountantId;
      }

      // Fetch all requests
      const requests = await ctx.prisma.clientRequest.findMany({
        where,
        select: { responseTimeMinutes: true },
      });

      const totalRequests = requests.length;

      // Define buckets
      const bucketDefs = [
        { label: '0-15 мин', min: 0, max: 15 },
        { label: '15-30 мин', min: 15, max: 30 },
        { label: '30-60 мин', min: 30, max: 60 },
        { label: '60+ мин', min: 60, max: null },
      ];

      // Count requests in each bucket
      const buckets = bucketDefs.map((def) => {
        const count = requests.filter((r) => {
          const time = r.responseTimeMinutes as number;
          if (def.max === null) {
            return time >= def.min;
          }
          return time >= def.min && time < def.max;
        }).length;

        return {
          label: def.label,
          minMinutes: def.min,
          maxMinutes: def.max,
          count,
          percentage: totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0,
        };
      });

      return {
        buckets,
        totalRequests,
      };
    }),
});

/**
 * Analytics Router Contract
 *
 * tRPC router для аналитики SLA и dashboard.
 * Используется Admin Panel для отображения метрик и отчётов.
 *
 * @module contracts/analytics.router
 */

import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const DashboardInput = z.object({
  timezone: z.string().default('Europe/Moscow'),
});

export const AccountantStatsInput = z.object({
  accountantId: z.string().uuid().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  sortBy: z.enum(['responseTime', 'violations', 'compliance']).default('compliance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const SlaComplianceInput = z.object({
  chatId: z.string().optional(),
  accountantId: z.string().uuid().optional(),
  dateFrom: z.date(),
  dateTo: z.date(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
});

export const ResponseTimeInput = z.object({
  chatId: z.string().optional(),
  accountantId: z.string().uuid().optional(),
  dateFrom: z.date(),
  dateTo: z.date(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
});

export const ExportReportInput = z.object({
  reportType: z.enum(['sla_compliance', 'accountant_performance', 'violations']),
  dateFrom: z.date(),
  dateTo: z.date(),
  chatId: z.string().optional(),
  accountantId: z.string().uuid().optional(),
  format: z.enum(['csv', 'json']).default('csv'),
});

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

export const DashboardOutput = z.object({
  // Main KPIs
  slaCompliancePercent: z.number(), // 0-100
  avgResponseTimeMinutes: z.number(),
  totalViolationsToday: z.number(),
  totalViolationsWeek: z.number(),
  activeAlertsCount: z.number(),

  // Trends (vs previous period)
  slaComplianceTrend: z.number(), // +/- percent
  responseTimeTrend: z.number(), // +/- minutes

  // Recent activity
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

  // Top performers
  topAccountants: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      avgResponseMinutes: z.number(),
      compliancePercent: z.number(),
    })
  ),

  // Worst performers (for attention)
  attentionNeeded: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      violationsCount: z.number(),
      avgResponseMinutes: z.number(),
    })
  ),
});

export const AccountantStatsOutput = z.object({
  items: z.array(
    z.object({
      accountantId: z.string().uuid(),
      accountantName: z.string(),
      email: z.string(),

      // Performance
      totalRequests: z.number(),
      answeredRequests: z.number(),
      violations: z.number(),
      compliancePercent: z.number(),

      // Response time
      avgResponseMinutes: z.number(),
      minResponseMinutes: z.number(),
      maxResponseMinutes: z.number(),
      medianResponseMinutes: z.number(),

      // Chats
      assignedChats: z.number(),
    })
  ),
  total: z.number(),
});

export const SlaComplianceOutput = z.object({
  overall: z.object({
    totalRequests: z.number(),
    compliant: z.number(),
    violated: z.number(),
    compliancePercent: z.number(),
  }),
  timeline: z.array(
    z.object({
      period: z.string(), // ISO date or date range
      totalRequests: z.number(),
      compliant: z.number(),
      violated: z.number(),
      compliancePercent: z.number(),
    })
  ),
  byChat: z
    .array(
      z.object({
        chatId: z.string(),
        chatTitle: z.string().nullable(),
        totalRequests: z.number(),
        compliancePercent: z.number(),
      })
    )
    .optional(),
});

export const ResponseTimeOutput = z.object({
  overall: z.object({
    avgMinutes: z.number(),
    minMinutes: z.number(),
    maxMinutes: z.number(),
    medianMinutes: z.number(),
    p90Minutes: z.number(), // 90th percentile
    p95Minutes: z.number(), // 95th percentile
  }),
  timeline: z.array(
    z.object({
      period: z.string(),
      avgMinutes: z.number(),
      requestCount: z.number(),
    })
  ),
  distribution: z.array(
    z.object({
      bucket: z.string(), // "0-15", "15-30", "30-60", "60+"
      count: z.number(),
      percent: z.number(),
    })
  ),
});

export const ExportReportOutput = z.object({
  downloadUrl: z.string().url(),
  filename: z.string(),
  expiresAt: z.date(),
  rowCount: z.number(),
});

// ============================================================================
// ROUTER DEFINITION (tRPC Contract)
// ============================================================================

/**
 * Analytics Router Procedures:
 *
 * Queries:
 * - getDashboard: Получить данные для главного dashboard
 * - getAccountantStats: Получить статистику по бухгалтерам
 * - getSlaCompliance: Получить данные по SLA compliance (timeline)
 * - getResponseTime: Получить данные по времени ответа (timeline)
 * - exportReport: Экспортировать отчёт в CSV/JSON
 */

export const analyticsRouterContract = {
  // Queries
  getDashboard: {
    input: DashboardInput,
    output: DashboardOutput,
    description: 'Получить данные для главного dashboard (KPIs, trends, recent activity)',
  },

  getAccountantStats: {
    input: AccountantStatsInput,
    output: AccountantStatsOutput,
    description: 'Получить статистику производительности бухгалтеров',
  },

  getSlaCompliance: {
    input: SlaComplianceInput,
    output: SlaComplianceOutput,
    description: 'Получить данные по SLA compliance за период',
  },

  getResponseTime: {
    input: ResponseTimeInput,
    output: ResponseTimeOutput,
    description: 'Получить статистику времени ответа за период',
  },

  exportReport: {
    input: ExportReportInput,
    output: ExportReportOutput,
    description: 'Сгенерировать и экспортировать отчёт в CSV/JSON',
  },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DashboardOutput = z.infer<typeof DashboardOutput>;
export type AccountantStatsOutput = z.infer<typeof AccountantStatsOutput>;
export type SlaComplianceOutput = z.infer<typeof SlaComplianceOutput>;
export type ResponseTimeOutput = z.infer<typeof ResponseTimeOutput>;
export type ExportReportOutput = z.infer<typeof ExportReportOutput>;

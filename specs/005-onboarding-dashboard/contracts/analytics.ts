// tRPC Router Definition for Analytics
// Path: backend/src/api/trpc/routers/analytics.ts

export const analyticsRouter = router({
  // Widget: SLA Compliance
  getSlaCompliance: protectedProcedure
    .input(
      z.object({
        period: z.enum(['today', 'week', 'month']).default('today'),
        timezone: z.string().default('UTC'), // For correct day boundaries
      })
    )
    .query(async ({ ctx, input }) => {
      // Returns SlaComplianceMetric
    }),

  // Widget: Response Time
  getResponseTime: protectedProcedure
    .input(
      z.object({
        period: z.enum(['today', 'week', 'month']).default('today'),
        timezone: z.string().default('UTC'),
      })
    )
    .query(async ({ ctx, input }) => {
      // Returns ResponseTimeMetric
    }),

  // Widget: Violations Count
  getViolationsCount: protectedProcedure
    .input(
      z.object({
        period: z.enum(['today', 'week', 'month']).default('today'),
        timezone: z.string().default('UTC'),
      })
    )
    .query(async ({ ctx, input }) => {
      // Returns number
    }),

  // Widget: Active Alerts
  getActiveAlerts: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Returns ActiveAlertItem[]
    }),
});

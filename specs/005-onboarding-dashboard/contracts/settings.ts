// tRPC Router Definition for Settings (Wizard support)
// Path: backend/src/api/trpc/routers/settings.ts

export const settingsRouter = router({

  // Wizard Step 1: Validate & Save Bot Token
  setupTelegramBot: protectedProcedure
    .input(z.object({
      token: z.string().min(10),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Call Telegram getMe
      // 2. If valid, save to GlobalSettings
      // Returns { success: true, botUsername: string }
    }),

  // Wizard Step 2: Save Working Hours
  updateWorkingSchedule: protectedProcedure
    .input(z.object({
      schedule: z.array(z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        isActive: z.boolean(),
      })),
      timezone: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Transactional update of WorkingSchedule table
    }),

  // Wizard Step 3: Save SLA Config
  updateSlaThresholds: protectedProcedure
    .input(z.object({
      responseThresholdMinutes: z.number().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Update GlobalSettings
    }),

  // Finalize Wizard
  completeOnboarding: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Set User.isOnboardingComplete = true
    }),
});

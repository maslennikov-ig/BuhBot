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

import { router, managerProcedure } from '../trpc.js';

/**
 * Survey router for campaign management
 */
export const surveyRouter = router({
  /**
   * Get survey-related global settings
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
      },
    });

    return (
      settings || {
        surveyValidityDays: 7,
        surveyReminderDay: 2,
        lowRatingThreshold: 3,
        surveyQuarterDay: 1,
      }
    );
  }),

  // TODO: T059 - Implement survey.list procedure
  // TODO: T060 - Implement survey.getById procedure
  // TODO: T061 - Implement survey.create procedure
  // TODO: T062 - Implement survey.close procedure
  // TODO: T063 - Implement survey.sendNow procedure
  // TODO: T064 - Implement survey.getDeliveries procedure
  // TODO: T066 - Implement survey.updateSettings procedure
});

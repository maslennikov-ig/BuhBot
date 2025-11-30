import { z } from 'zod';
import { router, authedProcedure } from '../trpc.js';
import { appNotificationService } from '../../../services/notification/app-notification.service.js';
import { TRPCError } from '@trpc/server';

export const notificationRouter = router({
  /**
   * List notifications for the current user
   */
  list: authedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.number().default(0), // offset
      })
    )
    .query(async ({ ctx, input }) => {
      const notifications = await appNotificationService.getUserNotifications(
        ctx.user.id,
        input.limit,
        input.cursor
      );

      const unreadCount = await appNotificationService.getUnreadCount(ctx.user.id);

      return {
        items: notifications,
        unreadCount,
        nextCursor: notifications.length === input.limit ? input.cursor + input.limit : undefined,
      };
    }),

  /**
   * Get unread count
   */
  getUnreadCount: authedProcedure.query(async ({ ctx }) => {
    return appNotificationService.getUnreadCount(ctx.user.id);
  }),

  /**
   * Mark a notification as read
   */
  markAsRead: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await appNotificationService.markAsRead(input.id, ctx.user.id);
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Notification not found or access denied',
        });
      }
    }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: authedProcedure.mutation(async ({ ctx }) => {
    await appNotificationService.markAllAsRead(ctx.user.id);
    return { success: true };
  }),

  /**
   * Delete a notification
   */
  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await appNotificationService.delete(input.id, ctx.user.id);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Notification not found or access denied',
        });
      }
    }),
});

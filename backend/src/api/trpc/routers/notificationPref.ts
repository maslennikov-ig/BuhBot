/**
 * Notification Preferences Router - User Notification Settings Management
 *
 * tRPC router for managing per-user notification preferences.
 * Supports self-service toggling as well as manager/admin overrides.
 *
 * Procedures:
 * Queries:
 * - get: Get own notification preferences (authed)
 *
 * Mutations:
 * - update: Toggle own notification preference (authed)
 * - override: Lock/override preference for a managed accountant (manager)
 * - adminOverride: Override any user's preference (admin)
 *
 * @module api/trpc/routers/notificationPref
 */

import { router, authedProcedure, managerProcedure, adminProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All supported notification type values
 */
const NOTIFICATION_TYPES = [
  'sla_warning',
  'sla_breach',
  'new_request',
  'assignment',
  'chat_linked',
] as const;

/**
 * Zod enum for notification types
 */
const NotificationTypeSchema = z.enum(NOTIFICATION_TYPES);

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Input schema for toggling own notification preference
 */
const UpdatePrefInput = z.object({
  notificationType: NotificationTypeSchema,
  isEnabled: z.boolean(),
});

/**
 * Input schema for manager/admin override of a user's preference
 */
const OverridePrefInput = z.object({
  userId: z.string().uuid(),
  notificationType: NotificationTypeSchema,
  isEnabled: z.boolean(),
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build the default preferences object for a user when no DB records exist.
 * All notification types default to enabled.
 *
 * @param userId - UUID of the user
 * @returns Array of default preference objects (not persisted)
 */
function buildDefaultPreferences(userId: string) {
  return NOTIFICATION_TYPES.map((notificationType) => ({
    id: null as string | null,
    notificationType,
    isEnabled: true,
    overriddenBy: null as string | null,
    userId,
  }));
}

// ============================================================================
// ROUTER DEFINITION
// ============================================================================

/**
 * Notification preferences router
 */
export const notificationPrefRouter = router({
  /**
   * Get own notification preferences
   *
   * Returns the current user's notification preference settings.
   * If no preferences have been saved yet, returns defaults (all enabled).
   *
   * @returns Array of notification preferences with id, type, enabled state, and override info
   * @authorization All authenticated users
   */
  get: authedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.prisma.notificationPreference.findMany({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        notificationType: true,
        isEnabled: true,
        overriddenBy: true,
      },
    });

    // If no preferences exist at all, return defaults (all enabled)
    if (prefs.length === 0) {
      return buildDefaultPreferences(ctx.user.id).map((p) => ({
        id: p.id,
        notificationType: p.notificationType,
        isEnabled: p.isEnabled,
        overriddenBy: p.overriddenBy,
      }));
    }

    // Fill in any missing types with defaults (in case new types were added)
    const savedTypes = new Set(prefs.map((p) => p.notificationType));
    const missing = NOTIFICATION_TYPES.filter((t) => !savedTypes.has(t)).map(
      (notificationType) => ({
        id: null as string | null,
        notificationType,
        isEnabled: true,
        overriddenBy: null as string | null,
      })
    );

    return [
      ...prefs.map((p) => ({
        id: p.id,
        notificationType: p.notificationType,
        isEnabled: p.isEnabled,
        overriddenBy: p.overriddenBy,
      })),
      ...missing,
    ];
  }),

  /**
   * Toggle own notification preference
   *
   * Allows an authenticated user to enable or disable a notification type
   * for themselves. Throws FORBIDDEN if the preference has been locked by
   * a manager or admin (overriddenBy is set).
   *
   * @param input.notificationType - The notification type to update
   * @param input.isEnabled - Whether the notification should be enabled
   * @returns { success: boolean }
   * @authorization All authenticated users
   */
  update: authedProcedure.input(UpdatePrefInput).mutation(async ({ ctx, input }) => {
    // Check if this preference is locked by a manager/admin
    const existing = await ctx.prisma.notificationPreference.findUnique({
      where: {
        unique_user_notification_type: {
          userId: ctx.user.id,
          notificationType: input.notificationType,
        },
      },
      select: { overriddenBy: true },
    });

    if (existing?.overriddenBy) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Эта настройка заблокирована менеджером',
      });
    }

    // Upsert the preference (no override — user owns this change)
    await ctx.prisma.notificationPreference.upsert({
      where: {
        unique_user_notification_type: {
          userId: ctx.user.id,
          notificationType: input.notificationType,
        },
      },
      create: {
        userId: ctx.user.id,
        notificationType: input.notificationType,
        isEnabled: input.isEnabled,
        overriddenBy: null,
      },
      update: {
        isEnabled: input.isEnabled,
      },
    });

    return { success: true };
  }),

  /**
   * Manager override: Lock/set preference for a managed accountant
   *
   * Allows a manager to override a notification preference for an accountant
   * they manage. The preference will be locked (overriddenBy is set) so the
   * accountant cannot change it themselves.
   *
   * @param input.userId - UUID of the target accountant
   * @param input.notificationType - The notification type to override
   * @param input.isEnabled - The enforced value
   * @returns { success: boolean }
   * @authorization Manager or Admin
   */
  override: managerProcedure.input(OverridePrefInput).mutation(async ({ ctx, input }) => {
    // Validate target user is an accountant (only accountant preferences can be overridden)
    const targetUser = await ctx.prisma.user.findUnique({
      where: { id: input.userId },
      select: { role: true },
    });
    if (!targetUser || targetUser.role !== 'accountant') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Можно управлять только настройками бухгалтеров',
      });
    }

    // Admins can override any accountant's preferences; managers only their managed accountants
    if (ctx.user.role !== 'admin') {
      const relation = await ctx.prisma.userManager.findUnique({
        where: {
          unique_manager_accountant: {
            managerId: ctx.user.id,
            accountantId: input.userId,
          },
        },
        select: { id: true },
      });

      if (!relation) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Вы не управляете этим бухгалтером',
        });
      }
    }

    // Upsert with overriddenBy set to the current manager
    await ctx.prisma.notificationPreference.upsert({
      where: {
        unique_user_notification_type: {
          userId: input.userId,
          notificationType: input.notificationType,
        },
      },
      create: {
        userId: input.userId,
        notificationType: input.notificationType,
        isEnabled: input.isEnabled,
        overriddenBy: ctx.user.id,
      },
      update: {
        isEnabled: input.isEnabled,
        overriddenBy: ctx.user.id,
      },
    });

    return { success: true };
  }),

  /**
   * Admin override: Set preference for any user
   *
   * Allows an admin to override any user's notification preference.
   * The preference will be locked (overriddenBy is set).
   *
   * @param input.userId - UUID of the target user
   * @param input.notificationType - The notification type to override
   * @param input.isEnabled - The enforced value
   * @returns { success: boolean }
   * @authorization Admin only
   */
  adminOverride: adminProcedure.input(OverridePrefInput).mutation(async ({ ctx, input }) => {
    // Verify target user exists
    const targetUser = await ctx.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Пользователь не найден',
      });
    }

    // Upsert with overriddenBy set to the current admin
    await ctx.prisma.notificationPreference.upsert({
      where: {
        unique_user_notification_type: {
          userId: input.userId,
          notificationType: input.notificationType,
        },
      },
      create: {
        userId: input.userId,
        notificationType: input.notificationType,
        isEnabled: input.isEnabled,
        overriddenBy: ctx.user.id,
      },
      update: {
        isEnabled: input.isEnabled,
        overriddenBy: ctx.user.id,
      },
    });

    return { success: true };
  }),
});

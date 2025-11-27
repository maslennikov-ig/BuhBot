/**
 * Auth Router - Authentication & User Management
 *
 * Procedures:
 * - me: Get current authenticated user profile
 * - listUsers: List all users (for assignment dropdowns)
 *
 * @module api/trpc/routers/auth
 */

import { router, authedProcedure } from '../trpc.js';
import { z } from 'zod';

/**
 * User role schema (matches Prisma UserRole enum)
 */
const UserRoleSchema = z.enum(['admin', 'manager', 'observer']);

/**
 * Auth router for authentication and user management
 */
export const authRouter = router({
  /**
   * Get current authenticated user profile
   *
   * Returns user info from context (validated by context.ts)
   *
   * @returns User profile with role
   * @authorization All authenticated users
   */
  me: authedProcedure
    .output(
      z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        fullName: z.string(),
        role: UserRoleSchema,
        isOnboardingComplete: z.boolean(),
        createdAt: z.date(),
        telegramId: z.string().nullable().optional(),
        telegramUsername: z.string().nullable().optional(),
        telegramAccount: z.object({
          id: z.string(),
          telegramId: z.string(),
          username: z.string().nullable(),
          firstName: z.string().nullable(),
          lastName: z.string().nullable(),
          photoUrl: z.string().nullable(),
          authDate: z.string(),
          linkedAt: z.date(),
        }).nullable().optional(),
      })
    )
    .query(async ({ ctx }) => {
      // User is guaranteed to be non-null by authedProcedure middleware
      const user = ctx.user;

      // Fetch full user profile from database (context only has basic info)
      const dbUser = await ctx.prisma.user.findUnique({
        where: { id: user.id },
        include: {
          telegramAccount: true,
        },
      });

      if (!dbUser) {
        // This should never happen (user was validated in context)
        // But handle gracefully for type safety
        throw new Error('User not found in database');
      }

      return {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.fullName,
        role: dbUser.role,
        isOnboardingComplete: dbUser.isOnboardingComplete,
        createdAt: dbUser.createdAt,
        telegramId: dbUser.telegramId?.toString() ?? null,
        telegramUsername: dbUser.telegramUsername,
        telegramAccount: dbUser.telegramAccount ? {
          id: dbUser.telegramAccount.id,
          telegramId: dbUser.telegramAccount.telegramId.toString(),
          username: dbUser.telegramAccount.username,
          firstName: dbUser.telegramAccount.firstName,
          lastName: dbUser.telegramAccount.lastName,
          photoUrl: dbUser.telegramAccount.photoUrl,
          authDate: dbUser.telegramAccount.authDate.toString(),
          linkedAt: dbUser.telegramAccount.linkedAt,
        } : null,
      };
    }),

  /**
   * Update current user profile
   *
   * @param fullName - User's full name
   * @param telegramUsername - User's Telegram username (optional)
   * @returns Success status
   * @authorization All authenticated users
   */
  updateProfile: authedProcedure
    .input(
      z.object({
        fullName: z.string().min(1, 'Имя обязательно'),
        telegramUsername: z
          .string()
          .transform((val) => (val.startsWith('@') ? val.slice(1) : val))
          .refine((val) => !val || /^[a-zA-Z0-9_]{5,32}$/.test(val), {
            message: 'Неверный формат username (5-32 символа, латиница, цифры, _)',
          })
          .optional()
          .nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          fullName: input.fullName,
          telegramUsername: input.telegramUsername ?? null,
        },
      });

      return { success: true };
    }),

  /**
   * List all users (for admin/manager assignment dropdowns)
   *
   * @param role - Optional filter by role
   * @returns Array of users
   * @authorization All authenticated users
   */
  listUsers: authedProcedure
    .input(
      z.object({
        role: UserRoleSchema.optional(),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          email: z.string().email(),
          fullName: z.string(),
          role: UserRoleSchema,
        })
      )
    )
    .query(async ({ ctx, input }) => {
      // Build where clause based on optional role filter
      const where = input.role ? { role: input.role } : {};

      // Fetch users from database
      const users = await ctx.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
        orderBy: {
          fullName: 'asc',
        },
      });

      return users;
    }),

  /**
   * Mark onboarding as complete for the current user
   *
   * @returns Success status
   * @authorization All authenticated users
   */
  completeOnboarding: authedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.user.update({
      where: { id: ctx.user.id },
      data: { isOnboardingComplete: true },
    });

    return { success: true };
  }),
});

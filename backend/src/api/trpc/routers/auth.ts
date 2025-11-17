/**
 * Auth Router - Authentication & User Management
 *
 * Procedures:
 * - me: Get current authenticated user profile
 * - listUsers: List all users (for assignment dropdowns)
 *
 * @module api/trpc/routers/auth
 */

import { router, authedProcedure } from '../trpc';
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
        createdAt: z.date(),
      })
    )
    .query(async ({ ctx }) => {
      // User is guaranteed to be non-null by authedProcedure middleware
      const user = ctx.user;

      // Fetch full user profile from database (context only has basic info)
      const dbUser = await ctx.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
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
        createdAt: dbUser.createdAt,
      };
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
      const where = input.role ? { role: input.role } : undefined;

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
});

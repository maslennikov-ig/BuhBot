/**
 * Auth Router - Authentication & User Management
 *
 * Procedures:
 * - me: Get current authenticated user profile
 * - listUsers: List all users (for assignment dropdowns)
 *
 * @module api/trpc/routers/auth
 */

import { router, authedProcedure, adminProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { supabase } from '../../../lib/supabase.js';
import env, { isDevMode } from '../../../config/env.js';
import logger from '../../../utils/logger.js';

/**
 * User role schema (matches Prisma UserRole enum)
 */
const UserRoleSchema = z.enum(['admin', 'manager', 'observer']);
type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Cast database role string to UserRole type
 * Database stores role as string for compatibility, but we validate on read
 */
const asUserRole = (role: string): UserRole => role as UserRole;

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
        telegramAccount: z
          .object({
            id: z.string(),
            telegramId: z.string(),
            username: z.string().nullable(),
            firstName: z.string().nullable(),
            lastName: z.string().nullable(),
            photoUrl: z.string().nullable(),
            authDate: z.string(),
            linkedAt: z.date(),
          })
          .nullable()
          .optional(),
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
        // In DEV_MODE, auto-create dev user if not found (e.g. seed not run)
        if (isDevMode) {
          logger.warn('DEV_MODE: Auto-creating dev user (seed not run)', {
            userId: user.id,
            service: 'auth',
          });
          const created = await ctx.prisma.user.create({
            data: {
              id: user.id,
              email: user.email,
              fullName: user.fullName ?? 'DEV Admin',
              role: 'admin',
              isOnboardingComplete: true,
            },
            include: { telegramAccount: true },
          });
          return {
            id: created.id,
            email: created.email,
            fullName: created.fullName,
            role: asUserRole(created.role),
            isOnboardingComplete: created.isOnboardingComplete,
            createdAt: created.createdAt,
            telegramId: created.telegramId?.toString() ?? null,
            telegramUsername: created.telegramUsername,
            telegramAccount: null,
          };
        }
        throw new Error('User not found in database');
      }

      return {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.fullName,
        role: asUserRole(dbUser.role),
        isOnboardingComplete: dbUser.isOnboardingComplete,
        createdAt: dbUser.createdAt,
        telegramId: dbUser.telegramId?.toString() ?? null,
        telegramUsername: dbUser.telegramUsername,
        telegramAccount: dbUser.telegramAccount
          ? {
              id: dbUser.telegramAccount.id,
              telegramId: dbUser.telegramAccount.telegramId.toString(),
              username: dbUser.telegramAccount.username,
              firstName: dbUser.telegramAccount.firstName,
              lastName: dbUser.telegramAccount.lastName,
              photoUrl: dbUser.telegramAccount.photoUrl,
              authDate: dbUser.telegramAccount.authDate.toString(),
              linkedAt: dbUser.telegramAccount.linkedAt,
            }
          : null,
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
          telegramId: z.string().nullable(),
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
          telegramId: true,
        },
        orderBy: {
          fullName: 'asc',
        },
      });

      return users.map((user) => ({
        ...user,
        role: asUserRole(user.role),
        telegramId: user.telegramId?.toString() ?? null,
      }));
    }),

  /**
   * Update a user's role
   *
   * @param userId - Target user ID
   * @param role - New role
   * @returns Success status
   * @authorization Admin only
   */
  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        role: UserRoleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });

      return { success: true };
    }),

  /**
   * Set or clear a user's Telegram ID
   *
   * Allows admins to manually associate a Telegram ID with a user profile.
   * Validates uniqueness against the TelegramAccount table to prevent conflicts.
   *
   * @param userId - Target user ID
   * @param telegramId - Telegram ID as numeric string, or null to clear
   * @returns Success status
   * @authorization Admin only
   */
  setUserTelegramId: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        telegramId: z.string().regex(/^\d+$/, 'Telegram ID должен быть числом').nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate user exists
      const targetUser = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Пользователь не найден',
        });
      }

      // If telegramId provided, check uniqueness against TelegramAccount table
      if (input.telegramId) {
        const existingAccount = await ctx.prisma.telegramAccount.findUnique({
          where: { telegramId: BigInt(input.telegramId) },
        });

        if (existingAccount && existingAccount.userId !== input.userId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Этот Telegram ID уже привязан к другому пользователю',
          });
        }

        // Also check if another User already has this telegramId
        const existingUser = await ctx.prisma.user.findFirst({
          where: {
            telegramId: BigInt(input.telegramId),
            id: { not: input.userId },
          },
        });

        if (existingUser) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Этот Telegram ID уже привязан к другому пользователю',
          });
        }
      }

      // Update User.telegramId
      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: {
          telegramId: input.telegramId ? BigInt(input.telegramId) : null,
        },
      });

      logger.info('[Audit] Admin set user Telegram ID', {
        adminId: ctx.user.id,
        targetUserId: input.userId,
        telegramId: input.telegramId,
      });

      return { success: true };
    }),

  /**
   * Create a new user in the system
   *
   * Creates a user via Supabase Auth invite and stores profile in database.
   * Supabase will automatically send an invitation email with password setup link.
   *
   * @param email - User email address
   * @param fullName - User's full name
   * @param role - User role (admin, manager, observer)
   * @returns Created user info
   * @authorization Admin only
   */
  createUser: adminProcedure
    .input(
      z.object({
        email: z.string().email('Неверный формат email'),
        fullName: z.string().min(1, 'Имя обязательно'),
        role: UserRoleSchema,
      })
    )
    .output(
      z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        fullName: z.string(),
        role: UserRoleSchema,
        inviteSent: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // DEV_MODE: Supabase invite requires real credentials
      if (isDevMode) {
        throw new Error(
          'Создание пользователей недоступно в DEV_MODE (нет реальных Supabase-ключей)'
        );
      }

      // Check if user with this email already exists in our database
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new Error('Пользователь с таким email уже существует');
      }

      // Invite user via Supabase Auth (sends email automatically)
      const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
        input.email,
        {
          redirectTo: `${env.FRONTEND_URL}/set-password`,
          data: {
            full_name: input.fullName,
            role: input.role,
          },
        }
      );

      if (authError) {
        // If user already exists in Supabase Auth but not in our DB
        if (authError.message.includes('already been registered')) {
          throw new Error(
            'Пользователь с таким email уже зарегистрирован в системе аутентификации'
          );
        }
        throw new Error(`Ошибка отправки приглашения: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Не удалось создать пользователя');
      }

      // Create user profile in our database with Supabase Auth ID
      const newUser = await ctx.prisma.user.create({
        data: {
          id: authData.user.id, // Use Supabase Auth user ID
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          isOnboardingComplete: true, // Skip onboarding (all settings available in /settings)
        },
      });

      return {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: asUserRole(newUser.role),
        inviteSent: true,
      };
    }),

  /**
   * Delete a user from the system
   *
   * Removes user and all associated data (telegram account, assigned chats reassigned to null).
   * Cannot delete yourself or the last admin.
   *
   * @param userId - Target user ID to delete
   * @returns Success status
   * @authorization Admin only
   */
  deleteUser: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Prevent self-deletion
      if (input.userId === ctx.user.id) {
        throw new Error('Нельзя удалить самого себя');
      }

      // Check if user exists
      const userToDelete = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
      });

      if (!userToDelete) {
        throw new Error('Пользователь не найден');
      }

      // Prevent deletion of last admin
      if (userToDelete.role === 'admin') {
        // Use raw query with text cast to avoid Prisma pg-adapter enum type mismatch
        const result = await ctx.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM users WHERE role::text = 'admin'
        `;
        const adminCount = Number(result[0].count);

        if (adminCount <= 1) {
          throw new Error('Нельзя удалить последнего администратора');
        }
      }

      // Unassign chats from this user
      await ctx.prisma.chat.updateMany({
        where: { assignedAccountantId: input.userId },
        data: { assignedAccountantId: null },
      });

      // Delete telegram account if exists
      await ctx.prisma.telegramAccount.deleteMany({
        where: { userId: input.userId },
      });

      // Delete user
      await ctx.prisma.user.delete({
        where: { id: input.userId },
      });

      return { success: true };
    }),
});

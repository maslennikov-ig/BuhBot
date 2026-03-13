/**
 * Auth Router - Authentication & User Management
 *
 * Procedures:
 * - me: Get current authenticated user profile
 * - updateProfile: Update own profile (fullName, telegramUsername)
 * - listUsers: List all users (for assignment dropdowns)
 * - updateUser: Admin update user profile/role
 * - updateUserRole: Admin change user role
 * - setUserTelegramId: Admin set/clear user Telegram ID
 * - createUser: Admin create and invite new user
 * - deleteUser: Admin delete user
 * - deactivateUser: Admin deactivate user account
 * - reactivateUser: Admin reactivate user account
 *
 * @module api/trpc/routers/auth
 */

import { router, authedProcedure, adminProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { supabase } from '../../../lib/supabase.js';
import env, { isDevMode } from '../../../config/env.js';
import logger from '../../../utils/logger.js';
import { randomBytes } from 'crypto';

/**
 * User role schema (matches Prisma UserRole enum)
 */
const UserRoleSchema = z.enum(['admin', 'manager', 'observer', 'accountant']);
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
        isActive: z.boolean(),
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
            isActive: created.isActive,
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
        isActive: dbUser.isActive,
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
          isActive: z.boolean(),
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
          isActive: true,
          telegramId: true,
        },
        orderBy: {
          fullName: 'asc',
        },
      });

      return users.map((user) => ({
        ...user,
        role: asUserRole(user.role),
        isActive: user.isActive,
        telegramId: user.telegramId?.toString() ?? null,
      }));
    }),

  /**
   * Update user profile fields and/or role
   *
   * Email editing is intentionally excluded to avoid split-brain state
   * with Supabase Auth (CR-1). Will be added when Supabase email sync
   * is implemented.
   *
   * @param userId - Target user ID
   * @param fullName - New full name (optional)
   * @param role - New role (optional)
   * @returns Success status
   * @authorization Admin only
   */
  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        fullName: z.string().min(1).optional(),
        role: UserRoleSchema.optional(),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const targetUser = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Пользователь не найден',
        });
      }

      const updateData: { fullName?: string; role?: string } = {};
      if (input.fullName !== undefined) updateData.fullName = input.fullName;
      if (input.role !== undefined) updateData.role = input.role;

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Не указаны поля для обновления',
        });
      }

      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: updateData,
      });

      logger.info('[Audit] Admin updated user', {
        adminId: ctx.user.id,
        targetUserId: input.userId,
        updatedFields: Object.keys(updateData),
      });

      return { success: true };
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

      logger.info('[Audit] Admin updated user role', {
        adminId: ctx.user.id,
        targetUserId: input.userId,
        newRole: input.role,
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
   * @param role - User role (admin, manager, observer, accountant)
   * @returns Created user info
   * @authorization Admin only
   */
  createUser: adminProcedure
    .input(
      z.object({
        email: z.string().email('Неверный формат email'),
        fullName: z.string().min(1, 'Имя обязательно'),
        role: UserRoleSchema,
        managerIds: z.array(z.string().uuid()).optional(),
      })
    )
    .output(
      z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        fullName: z.string(),
        role: UserRoleSchema,
        inviteSent: z.boolean(),
        verificationLink: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // DEV_MODE: Create user directly in DB without Supabase invite
      if (isDevMode) {
        const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
        if (existing) {
          throw new Error('Пользователь с таким email уже существует');
        }

        const devUserId = crypto.randomUUID();
        const isAccountant = input.role === 'accountant';

        const newUser = await ctx.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              id: devUserId,
              email: input.email,
              fullName: input.fullName,
              role: input.role,
              isOnboardingComplete: !isAccountant,
            },
          });

          if (isAccountant) {
            if (input.managerIds && input.managerIds.length > 0) {
              await tx.userManager.createMany({
                data: input.managerIds.map((managerId) => ({
                  managerId,
                  accountantId: user.id,
                })),
              });
            }

            const tokenValue = randomBytes(16).toString('base64url');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            await tx.verificationToken.create({
              data: { userId: user.id, token: tokenValue, expiresAt },
            });

            return { user, tokenValue };
          }

          return { user, tokenValue: undefined };
        });

        const botUsername = env.BOT_USERNAME ?? 'dev_bot';
        return {
          id: newUser.user.id,
          email: newUser.user.email,
          fullName: newUser.user.fullName,
          role: asUserRole(newUser.user.role),
          inviteSent: false,
          verificationLink:
            isAccountant && newUser.tokenValue
              ? `https://t.me/${botUsername}?start=verify_${newUser.tokenValue}`
              : undefined,
        };
      }

      // Check if user with this email already exists in our database
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new Error('Пользователь с таким email уже существует');
      }

      // managerIds only applies to accountant role — reject if passed for other roles
      if (input.role !== 'accountant' && input.managerIds && input.managerIds.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'managerIds можно указать только для роли accountant',
        });
      }

      // Validate managerIds if provided for accountant role
      if (input.role === 'accountant' && input.managerIds && input.managerIds.length > 0) {
        const managers = await ctx.prisma.user.findMany({
          where: {
            id: { in: input.managerIds },
            role: { in: ['admin', 'manager'] },
          },
          select: { id: true },
        });
        if (managers.length !== input.managerIds.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Один или несколько указанных менеджеров не найдены или не имеют роль менеджера/администратора.',
          });
        }
      }

      // For accountant: silent creation without invite email (Telegram-first onboarding)
      if (input.role === 'accountant') {
        if (!env.BOT_USERNAME) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'BOT_USERNAME не настроен. Невозможно создать ссылку для Telegram.',
          });
        }

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: input.email,
          email_confirm: true,
          user_metadata: {
            full_name: input.fullName,
            role: input.role,
          },
        });

        if (authError) {
          if (authError.message.includes('already been registered')) {
            throw new Error(
              'Пользователь с таким email уже зарегистрирован в системе аутентификации'
            );
          }
          throw new Error(`Ошибка создания пользователя: ${authError.message}`);
        }

        if (!authData.user) {
          throw new Error('Не удалось создать пользователя');
        }

        let newUser;
        let verificationLink: string | undefined;
        try {
          const result = await ctx.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                id: authData.user.id,
                email: input.email,
                fullName: input.fullName,
                role: input.role,
                isOnboardingComplete: false,
              },
            });

            // Create UserManager records
            if (input.managerIds && input.managerIds.length > 0) {
              await tx.userManager.createMany({
                data: input.managerIds.map((managerId) => ({
                  managerId,
                  accountantId: user.id,
                })),
              });
            }

            // Create verification token for Telegram linking
            const tokenValue = randomBytes(16).toString('base64url');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

            await tx.verificationToken.create({
              data: {
                userId: user.id,
                token: tokenValue,
                expiresAt,
              },
            });

            return { user, tokenValue };
          });

          newUser = result.user;
          // BOT_USERNAME is guaranteed to be set — guarded at the top of this block
          verificationLink = `https://t.me/${env.BOT_USERNAME}?start=verify_${result.tokenValue}`;
        } catch (dbError) {
          try {
            await supabase.auth.admin.deleteUser(authData.user.id);
          } catch (cleanupError) {
            logger.error('Failed to clean up Supabase Auth user after DB transaction failure', {
              supabaseUserId: authData.user.id,
              error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            });
          }
          throw dbError;
        }

        return {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: asUserRole(newUser.role),
          inviteSent: false,
          verificationLink,
        };
      }

      // Non-accountant: Invite user via Supabase Auth (sends email automatically)
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

      let newUser;
      try {
        newUser = await ctx.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              id: authData.user.id,
              email: input.email,
              fullName: input.fullName,
              role: input.role,
              isOnboardingComplete: true,
            },
          });

          return user;
        });
      } catch (dbError) {
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
        } catch (cleanupError) {
          logger.error('Failed to clean up Supabase Auth user after DB transaction failure', {
            supabaseUserId: authData.user.id,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        }
        throw dbError;
      }

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

      // Delete related records (UserManager, VerificationToken, NotificationPreference, TelegramAccount)
      // Also clear overriddenBy references in other users' preferences (FK SET NULL handles DB level,
      // but we explicitly clear to ensure consistency)
      await Promise.all([
        ctx.prisma.userManager.deleteMany({
          where: { OR: [{ managerId: input.userId }, { accountantId: input.userId }] },
        }),
        ctx.prisma.verificationToken.deleteMany({
          where: { userId: input.userId },
        }),
        ctx.prisma.notificationPreference.deleteMany({
          where: { userId: input.userId },
        }),
        ctx.prisma.notificationPreference.updateMany({
          where: { overriddenBy: input.userId },
          data: { overriddenBy: null },
        }),
        ctx.prisma.telegramAccount.deleteMany({
          where: { userId: input.userId },
        }),
      ]);

      // Delete user
      await ctx.prisma.user.delete({
        where: { id: input.userId },
      });

      return { success: true };
    }),

  /**
   * Deactivate a user account
   *
   * Sets isActive=false. For accountants: checks no assigned chats remain.
   * For managers: checks no orphaned accountants (managed only by this manager).
   *
   * @param userId - Target user ID
   * @returns Success status with optional warnings
   * @authorization Admin only
   */
  deactivateUser: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Нельзя деактивировать самого себя',
        });
      }

      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        include: {
          assignedChats: { select: { id: true, title: true } },
          managedAccountants: {
            select: {
              accountant: {
                select: {
                  id: true,
                  fullName: true,
                  managedByManagers: { select: { managerId: true } },
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });
      }

      if (!user.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Пользователь уже деактивирован' });
      }

      // Check no assigned chats remain (any role can be assigned to chats)
      if (user.assignedChats.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Невозможно деактивировать: у пользователя есть назначенные чаты (${user.assignedChats.length}). Сначала переназначьте чаты.`,
        });
      }

      // For managers: check for orphaned accountants
      if (['admin', 'manager'].includes(user.role) && user.managedAccountants.length > 0) {
        const orphans = user.managedAccountants.filter(
          (um) => um.accountant.managedByManagers.length <= 1
        );
        if (orphans.length > 0) {
          const orphanNames = orphans.map((o) => o.accountant.fullName).join(', ');
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Невозможно деактивировать: бухгалтеры ${orphanNames} останутся без менеджера. Сначала назначьте им другого менеджера.`,
          });
        }
      }

      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { isActive: false },
      });

      logger.info('[Audit] User deactivated', {
        adminId: ctx.user.id,
        targetUserId: input.userId,
      });

      return { success: true };
    }),

  /**
   * Reactivate a deactivated user account
   *
   * @param userId - Target user ID
   * @returns Success status
   * @authorization Admin only
   */
  reactivateUser: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });
      }

      if (user.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Пользователь уже активен' });
      }

      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { isActive: true },
      });

      logger.info('[Audit] User reactivated', {
        adminId: ctx.user.id,
        targetUserId: input.userId,
      });

      return { success: true };
    }),
});

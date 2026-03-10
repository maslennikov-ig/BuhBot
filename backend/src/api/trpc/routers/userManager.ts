/**
 * UserManager Router - Manager-Accountant M:N Relationship Management
 *
 * Procedures:
 * - assign: Assign an accountant to a manager
 * - unassign: Remove an accountant from a manager
 * - reassign: Atomically move an accountant from one manager to another
 * - listByManager: List accountants supervised by a manager
 * - listByAccountant: List managers overseeing an accountant
 *
 * @module api/trpc/routers/userManager
 */

import { router, authedProcedure, managerProcedure, adminProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

/**
 * UserManager router for managing Manager-Accountant M:N relationships
 */
export const userManagerRouter = router({
  /**
   * Assign an accountant to a manager
   *
   * Creates a new UserManager record linking the specified manager and accountant.
   * Validates that both users exist with the correct roles before creating the link.
   *
   * @param managerId - UUID of the manager (must have admin or manager role)
   * @param accountantId - UUID of the accountant (must have accountant role)
   * @returns { success: true } on successful assignment
   * @throws NOT_FOUND if either user does not exist
   * @throws BAD_REQUEST if role validation fails or assignment already exists
   * @authorization Admin only
   */
  assign: adminProcedure
    .input(
      z.object({
        managerId: z.string().uuid(),
        accountantId: z.string().uuid(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate manager exists and has a manager-capable role
      const manager = await ctx.prisma.user.findUnique({
        where: { id: input.managerId },
        select: { id: true, role: true, fullName: true },
      });

      if (!manager) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Пользователь-менеджер с ID ${input.managerId} не найден`,
        });
      }

      if (!['admin', 'manager'].includes(manager.role)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Пользователь "${manager.fullName}" не является менеджером или администратором`,
        });
      }

      // Validate accountant exists and has the accountant role
      const accountant = await ctx.prisma.user.findUnique({
        where: { id: input.accountantId },
        select: { id: true, role: true, fullName: true },
      });

      if (!accountant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Пользователь-бухгалтер с ID ${input.accountantId} не найден`,
        });
      }

      if (accountant.role !== 'accountant') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Пользователь "${accountant.fullName}" не является бухгалтером`,
        });
      }

      // Check for duplicate assignment
      const existing = await ctx.prisma.userManager.findUnique({
        where: {
          unique_manager_accountant: {
            managerId: input.managerId,
            accountantId: input.accountantId,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Бухгалтер "${accountant.fullName}" уже закреплён за менеджером "${manager.fullName}"`,
        });
      }

      // Create the assignment
      await ctx.prisma.userManager.create({
        data: {
          managerId: input.managerId,
          accountantId: input.accountantId,
        },
      });

      return { success: true };
    }),

  /**
   * Remove an accountant from a manager
   *
   * Deletes the UserManager record linking the specified manager and accountant.
   * Silently succeeds if the record does not exist (idempotent).
   *
   * @param managerId - UUID of the manager
   * @param accountantId - UUID of the accountant
   * @returns { success: true }
   * @authorization Admin only
   */
  unassign: adminProcedure
    .input(
      z.object({
        managerId: z.string().uuid(),
        accountantId: z.string().uuid(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.userManager.deleteMany({
        where: {
          managerId: input.managerId,
          accountantId: input.accountantId,
        },
      });

      return { success: true };
    }),

  /**
   * Reassign an accountant from one manager to another
   *
   * Atomically removes the existing manager link and creates a new one in a
   * single database transaction to prevent orphaned or duplicate records.
   *
   * @param accountantId - UUID of the accountant to reassign
   * @param oldManagerId - UUID of the manager to remove the accountant from
   * @param newManagerId - UUID of the manager to assign the accountant to
   * @returns { success: true }
   * @throws NOT_FOUND if the new manager does not exist
   * @throws BAD_REQUEST if the new manager does not have a manager-capable role
   * @authorization Admin only
   */
  reassign: adminProcedure
    .input(
      z.object({
        accountantId: z.string().uuid(),
        oldManagerId: z.string().uuid(),
        newManagerId: z.string().uuid(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate new manager exists and has a manager-capable role
      const newManager = await ctx.prisma.user.findUnique({
        where: { id: input.newManagerId },
        select: { id: true, role: true, fullName: true },
      });

      if (!newManager) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Новый менеджер с ID ${input.newManagerId} не найден`,
        });
      }

      if (!['admin', 'manager'].includes(newManager.role)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Пользователь "${newManager.fullName}" не является менеджером или администратором`,
        });
      }

      // Check if the new assignment already exists
      const existingNew = await ctx.prisma.userManager.findUnique({
        where: {
          unique_manager_accountant: {
            managerId: input.newManagerId,
            accountantId: input.accountantId,
          },
        },
      });

      if (existingNew) {
        // Just remove old link; new one already exists
        await ctx.prisma.userManager.deleteMany({
          where: {
            managerId: input.oldManagerId,
            accountantId: input.accountantId,
          },
        });
      } else {
        // Execute as a transaction: delete old link, create new one
        await ctx.prisma.$transaction([
          ctx.prisma.userManager.deleteMany({
            where: {
              managerId: input.oldManagerId,
              accountantId: input.accountantId,
            },
          }),
          ctx.prisma.userManager.create({
            data: {
              managerId: input.newManagerId,
              accountantId: input.accountantId,
            },
          }),
        ]);
      }

      return { success: true };
    }),

  /**
   * List accountants supervised by a manager
   *
   * Returns all accountants linked to the specified manager. Managers may only
   * query their own accountants unless they have admin role.
   *
   * @param managerId - UUID of the manager (optional, defaults to ctx.user.id)
   * @returns Array of accountant profiles
   * @authorization Admins and managers only
   */
  listByManager: managerProcedure
    .input(
      z.object({
        managerId: z.string().uuid().optional(),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          fullName: z.string(),
          email: z.string().email(),
          telegramUsername: z.string().nullable(),
          isActive: z.boolean(),
        })
      )
    )
    .query(async ({ ctx, input }) => {
      // Default to the calling user's own ID
      const targetManagerId = input.managerId ?? ctx.user.id;

      // Non-admin managers may only query their own accountants
      if (ctx.user.role !== 'admin' && targetManagerId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Менеджер может просматривать только своих бухгалтеров',
        });
      }

      const records = await ctx.prisma.userManager.findMany({
        where: { managerId: targetManagerId },
        select: {
          accountant: {
            select: {
              id: true,
              fullName: true,
              email: true,
              telegramUsername: true,
              isActive: true,
            },
          },
        },
        orderBy: {
          accountant: { fullName: 'asc' },
        },
      });

      return records.map((r) => r.accountant);
    }),

  /**
   * List managers overseeing an accountant
   *
   * Returns all managers linked to the specified accountant. Accountant-role
   * users may only query their own managers. Admins and managers may query any.
   *
   * @param accountantId - UUID of the accountant (optional, defaults to ctx.user.id for accountant role)
   * @returns Array of manager profiles
   * @throws FORBIDDEN if a non-admin/manager user attempts to query another user's managers
   * @authorization All authenticated users
   */
  listByAccountant: authedProcedure
    .input(
      z.object({
        accountantId: z.string().uuid().optional(),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          fullName: z.string(),
          email: z.string().email(),
        })
      )
    )
    .query(async ({ ctx, input }) => {
      const isPrivileged = ['admin', 'manager'].includes(ctx.user.role);

      // Default to the calling user's own ID for accountant role
      const targetAccountantId = input.accountantId ?? ctx.user.id;

      // Non-admin/manager users may only query their own managers
      if (!isPrivileged && targetAccountantId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Вы можете просматривать только своих менеджеров',
        });
      }

      const records = await ctx.prisma.userManager.findMany({
        where: { accountantId: targetAccountantId },
        select: {
          manager: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: {
          manager: { fullName: 'asc' },
        },
      });

      return records.map((r) => r.manager);
    }),
});

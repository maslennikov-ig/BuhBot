import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { authedProcedure, router } from '../trpc.js';
import { telegramAuthService } from '../../../services/telegram/auth.service.js';
import { isRateLimited } from '../../../services/telegram/rate-limiter.js';
import logger from '../../../utils/logger.js';

const LinkTelegramInput = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

export const userRouter = router({
  /**
   * Link Telegram account to the current user
   */
  linkTelegram: authedProcedure.input(LinkTelegramInput).mutation(async ({ ctx, input }) => {
    // 0. Rate limiting check (5 attempts per minute per user)
    if (isRateLimited(ctx.user.id)) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Слишком много попыток. Подождите минуту перед повторной попыткой.',
      });
    }

    // 1. Verify Telegram authentication data
    const validatedData = telegramAuthService.verifyAuthData(input);

    if (!validatedData) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Неверные или устаревшие данные авторизации Telegram',
      });
    }

    const telegramId = BigInt(validatedData.id);

    // 2. Check if this Telegram account is already linked to ANOTHER user
    const existingLink = await ctx.prisma.telegramAccount.findUnique({
      where: { telegramId },
      include: { user: true },
    });

    if (existingLink && existingLink.userId !== ctx.user.id) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Этот Telegram аккаунт уже привязан к другому пользователю',
      });
    }

    // 3. Link account (create or update)
    // We use upsert to handle re-linking or updating details
    await ctx.prisma.telegramAccount.upsert({
      where: { userId: ctx.user.id },
      create: {
        userId: ctx.user.id,
        telegramId,
        username: validatedData.username ?? null,
        firstName: validatedData.first_name ?? null,
        lastName: validatedData.last_name ?? null,
        photoUrl: validatedData.photo_url ?? null,
        authDate: BigInt(validatedData.auth_date),
      },
      update: {
        telegramId,
        username: validatedData.username ?? null,
        firstName: validatedData.first_name ?? null,
        lastName: validatedData.last_name ?? null,
        photoUrl: validatedData.photo_url ?? null,
        authDate: BigInt(validatedData.auth_date),
        linkedAt: new Date(), // Update linkedAt on re-link
      },
    });

    logger.info('[Audit] Telegram account linked', {
      userId: ctx.user.id,
      telegramId,
      username: validatedData.username,
    });

    // 4. Update User model's telegram fields for backward compatibility/easier access
    // (Optional, depending on if we want to keep them in sync or migrate away)
    // The spec implies we might use the new table, but keeping User fields sync is good for existing logic
    await ctx.prisma.user.update({
      where: { id: ctx.user.id },
      data: {
        telegramId,
        telegramUsername: validatedData.username ?? null,
      },
    });

    return { success: true };
  }),

  /**
   * Unlink Telegram account
   */
  unlinkTelegram: authedProcedure.mutation(async ({ ctx }) => {
    // 1. Check if linked
    const link = await ctx.prisma.telegramAccount.findUnique({
      where: { userId: ctx.user.id },
    });

    if (!link) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Telegram аккаунт не привязан',
      });
    }

    // 2. Delete link
    await ctx.prisma.telegramAccount.delete({
      where: { userId: ctx.user.id },
    });

    logger.info('[Audit] Telegram account unlinked', {
      userId: ctx.user.id,
      telegramId: link.telegramId,
    });

    // 3. Clear User fields
    await ctx.prisma.user.update({
      where: { id: ctx.user.id },
      data: {
        telegramId: null,
        telegramUsername: null,
      },
    });

    return { success: true };
  }),

  /**
   * List users (with optional role filter)
   */
  list: authedProcedure
    .input(
      z
        .object({
          role: z
            .union([
              z.enum(['admin', 'manager', 'observer']),
              z.array(z.enum(['admin', 'manager', 'observer'])),
            ])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      console.log('[DEBUG] user.list input:', input);
      const start = Date.now();

      const where: any = {};

      if (input?.role) {
        if (Array.isArray(input.role)) {
          where.role = { in: input.role };
        } else {
          where.role = input.role;
        }
      }

      console.log('[DEBUG] user.list query where:', JSON.stringify(where));

      const users = await ctx.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
        orderBy: { fullName: 'asc' },
      });

      console.log(
        `[DEBUG] user.list finished in ${Date.now() - start}ms. Found ${users.length} users.`
      );

      return users;
    }),
});

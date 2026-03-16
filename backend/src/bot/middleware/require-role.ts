/**
 * Role-based Access Control Middleware
 *
 * Provides middleware for Telegraf bot commands:
 * - requireRole(minRole) — checks user has at least the given role level
 * - requireAuth() — only checks the user is registered (any role)
 *
 * Attaches the user object to ctx.state.user for downstream handlers.
 *
 * @module bot/middleware/require-role
 */

import type { MiddlewareFn } from 'telegraf';
import type { BotContext } from '../bot.js';
import { findUserByTelegramId } from '../utils/user.js';
import { hasMinRole, type UserRole } from '../utils/roles.js';

// Extend BotContext state to carry the authenticated user
declare module '../bot.js' {
  interface BotState {
    user?: {
      id: string;
      email: string;
      fullName: string;
      role: string;
      telegramId: bigint | null;
      telegramUsername: string | null;
      isOnboardingComplete: boolean;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
  }
}

/**
 * Middleware that requires the user to have at least the given role.
 * Looks up the user by telegramId, verifies role hierarchy, and attaches to ctx.state.user.
 *
 * @param minRole - Minimum role level required (e.g. 'accountant', 'manager', 'admin')
 */
export function requireRole(minRole: UserRole): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    if (!ctx.from) {
      return;
    }

    const user = await findUserByTelegramId(ctx.from.id);

    if (!user) {
      await ctx.reply('Вы не привязаны к системе BuhBot.');
      return;
    }

    if (!hasMinRole(user.role, minRole)) {
      await ctx.reply('У вас недостаточно прав для этой команды.');
      return;
    }

    ctx.state['user'] = user;
    return next();
  };
}

/**
 * Middleware that requires only authentication (any role).
 * Attaches user to ctx.state.user.
 */
export function requireAuth(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    if (!ctx.from) {
      return;
    }

    const user = await findUserByTelegramId(ctx.from.id);

    if (!user) {
      await ctx.reply('Вы не привязаны к системе BuhBot.');
      return;
    }

    ctx.state['user'] = user;
    return next();
  };
}

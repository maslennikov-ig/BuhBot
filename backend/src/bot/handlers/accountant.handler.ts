/**
 * Accountant Handler
 *
 * Telegram bot commands for accountants:
 * - /mystats   — Personal statistics
 * - /mychats   — List assigned chats
 * - /newchat   — Create self-service chat invitation
 * - /notifications — View notification preferences
 *
 * @module bot/handlers/accountant.handler
 */

import { randomBytes } from 'crypto';
import { bot, BotContext } from '../bot.js';
import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import env from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { redis } from '../../lib/redis.js';
import { findUserByTelegramId } from '../utils/user.js';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a cryptographically random base64url token.
 * Matches the format used by chats.createInvitation.
 */
function generateToken(byteLength: number): string {
  return randomBytes(byteLength).toString('base64url');
}

// ============================================================================
// Handler registration
// ============================================================================

/**
 * Register all accountant-facing bot commands.
 */
export function registerAccountantHandler(): void {
  // --------------------------------------------------------------------------
  // /mystats — personal statistics
  // --------------------------------------------------------------------------
  bot.command('mystats', async (ctx: BotContext) => {
    try {
      if (!ctx.from) {
        return;
      }

      const user = await findUserByTelegramId(ctx.from.id);

      if (!user) {
        await ctx.reply('Вы не привязаны к системе BuhBot.');
        return;
      }

      if (user.role !== 'accountant') {
        await ctx.reply('Эта команда доступна только для бухгалтеров.');
        return;
      }

      logger.info('Processing /mystats', {
        userId: user.id,
        telegramId: ctx.from.id,
        service: 'accountant-handler',
      });

      // Parallelize independent queries
      const [assignedChatsCount, requests] = await Promise.all([
        prisma.chat.count({
          where: { assignedAccountantId: user.id, deletedAt: null },
        }),
        prisma.clientRequest.findMany({
          where: {
            chat: { assignedAccountantId: user.id },
            classification: 'REQUEST',
          },
          select: {
            responseTimeMinutes: true,
            slaBreached: true,
            responseAt: true,
          },
        }),
      ]);

      const totalRequests = requests.length;
      const answeredRequests = requests.filter((r) => r.responseAt !== null);
      const answeredCount = answeredRequests.length;

      // Average response time (only for answered requests)
      const responseTimes = answeredRequests
        .map((r) => r.responseTimeMinutes)
        .filter((t): t is number => t !== null && t !== undefined);

      const avgResponseTime =
        responseTimes.length > 0
          ? Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length)
          : null;

      // SLA compliance: % of answered requests that were NOT breached
      const withinSlaCount = answeredRequests.filter((r) => !r.slaBreached).length;
      const slaCompliancePercent =
        answeredCount > 0 ? Math.round((withinSlaCount / answeredCount) * 100) : null;

      const avgTimeText = avgResponseTime !== null ? `${avgResponseTime} мин` : 'нет данных';
      const slaText = slaCompliancePercent !== null ? `${slaCompliancePercent}%` : 'нет данных';

      const message = [
        `📊 *Ваша статистика*`,
        ``,
        `👤 ${user.fullName}`,
        ``,
        `💬 Назначенных чатов: *${assignedChatsCount}*`,
        `📨 Всего запросов: *${totalRequests}*`,
        `✅ Отвечено: *${answeredCount}*`,
        `⏱ Среднее время ответа: *${avgTimeText}*`,
        `🎯 Соблюдение SLA: *${slaText}*`,
      ].join('\n');

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling /mystats', {
        error: errorMessage,
        telegramId: ctx.from?.id,
        service: 'accountant-handler',
      });
      await ctx.reply('Произошла ошибка при получении статистики. Попробуйте позже.');
    }
  });

  // --------------------------------------------------------------------------
  // /mychats — list assigned chats
  // --------------------------------------------------------------------------
  bot.command('mychats', async (ctx: BotContext) => {
    try {
      if (!ctx.from) {
        return;
      }

      const user = await findUserByTelegramId(ctx.from.id);

      if (!user) {
        await ctx.reply('Вы не привязаны к системе BuhBot.');
        return;
      }

      if (user.role !== 'accountant') {
        await ctx.reply('Эта команда доступна только для бухгалтеров.');
        return;
      }

      logger.info('Processing /mychats', {
        userId: user.id,
        telegramId: ctx.from.id,
        service: 'accountant-handler',
      });

      const chats = await prisma.chat.findMany({
        where: { assignedAccountantId: user.id, deletedAt: null },
        select: {
          id: true,
          title: true,
          clientTier: true,
          monitoringEnabled: true,
          slaEnabled: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (chats.length === 0) {
        await ctx.reply('У вас нет назначенных чатов.');
        return;
      }

      const tierLabel: Record<string, string> = {
        basic: 'Basic (120 мин)',
        standard: 'Standard (60 мин)',
        vip: 'VIP (30 мин)',
        premium: 'Premium (15 мин)',
      };

      const lines = chats.map((chat, index) => {
        const title = chat.title ?? `Чат ${chat.id}`;
        const tier = tierLabel[chat.clientTier] ?? chat.clientTier;
        const monitoring = chat.monitoringEnabled ? '🟢 мониторинг вкл' : '🔴 мониторинг выкл';
        return `${index + 1}. *${title}*\n   Тариф: ${tier} | ${monitoring}`;
      });

      const message = [`💬 *Ваши назначенные чаты* (${chats.length}):`, ``, ...lines].join('\n');

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling /mychats', {
        error: errorMessage,
        telegramId: ctx.from?.id,
        service: 'accountant-handler',
      });
      await ctx.reply('Произошла ошибка при получении списка чатов. Попробуйте позже.');
    }
  });

  // --------------------------------------------------------------------------
  // /newchat — self-service chat invitation
  // --------------------------------------------------------------------------
  bot.command('newchat', async (ctx: BotContext) => {
    try {
      if (!ctx.from) {
        return;
      }

      const user = await findUserByTelegramId(ctx.from.id);

      if (!user) {
        await ctx.reply('Вы не привязаны к системе BuhBot.');
        return;
      }

      if (user.role !== 'accountant') {
        await ctx.reply('Эта команда доступна только для бухгалтеров.');
        return;
      }

      logger.info('Processing /newchat', {
        userId: user.id,
        telegramId: ctx.from.id,
        service: 'accountant-handler',
      });

      const token = generateToken(16);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await prisma.chatInvitation.create({
        data: {
          token,
          expiresAt,
          createdBy: user.id,
          assignedAccountantId: user.id,
        },
      });

      const botUsername = env.BOT_USERNAME ?? 'buhbot';
      const inviteLink = `https://t.me/${botUsername}?start=${token}`;

      const message = [
        `🔗 *Ссылка для подключения нового чата*`,
        ``,
        `Отправьте эту ссылку клиенту для подключения чата:`,
        ``,
        inviteLink,
        ``,
        `⏰ Ссылка действительна 24 часа.`,
      ].join('\n');

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling /newchat', {
        error: errorMessage,
        telegramId: ctx.from?.id,
        service: 'accountant-handler',
      });
      await ctx.reply('Произошла ошибка при создании приглашения. Попробуйте позже.');
    }
  });

  // --------------------------------------------------------------------------
  // /notifications — view notification preferences
  // --------------------------------------------------------------------------
  bot.command('notifications', async (ctx: BotContext) => {
    try {
      if (!ctx.from) {
        return;
      }

      const user = await findUserByTelegramId(ctx.from.id);

      if (!user) {
        await ctx.reply('Вы не привязаны к системе BuhBot.');
        return;
      }

      if (user.role !== 'accountant') {
        await ctx.reply('Эта команда доступна только для бухгалтеров.');
        return;
      }

      logger.info('Processing /notifications', {
        userId: user.id,
        telegramId: ctx.from.id,
        service: 'accountant-handler',
      });

      const preferences = await prisma.notificationPreference.findMany({
        where: { userId: user.id },
        select: { notificationType: true, isEnabled: true, overriddenBy: true },
        orderBy: { notificationType: 'asc' },
      });

      const typeLabel: Record<string, string> = {
        sla_warning: 'Предупреждение SLA',
        sla_breach: 'Нарушение SLA',
        new_request: 'Новый запрос',
        assignment: 'Назначение чата',
        chat_linked: 'Подключение чата',
      };

      const preferenceLines =
        preferences.length > 0
          ? preferences.map((pref) => {
              const label = typeLabel[pref.notificationType] ?? pref.notificationType;
              const status = pref.isEnabled ? '✅ вкл' : '❌ выкл';
              const locked = pref.overriddenBy ? ' 🔒' : '';
              return `• ${label}: ${status}${locked}`;
            })
          : ['• Настройки по умолчанию (все уведомления включены)'];

      const message = [
        `🔔 *Настройки уведомлений*`,
        ``,
        ...preferenceLines,
        ``,
        `ℹ️ Для изменения настроек используйте веб-панель: ${env.FRONTEND_URL}`,
        ``,
        `🔒 — настройка заблокирована менеджером`,
      ].join('\n');

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling /notifications', {
        error: errorMessage,
        telegramId: ctx.from?.id,
        service: 'accountant-handler',
      });
      await ctx.reply('Произошла ошибка при получении настроек уведомлений. Попробуйте позже.');
    }
  });

  // --------------------------------------------------------------------------
  // Callback: request_password_email — generate password setup link
  // --------------------------------------------------------------------------
  const COOLDOWN_TTL = 300; // 5 minutes in seconds

  bot.action('request_password_email', async (ctx: BotContext) => {
    try {
      if (!ctx.from) {
        return;
      }

      // Rate limiting: one request per 5 minutes per user
      const cooldownKey = `cooldown:password_request:${ctx.from.id}`;
      const lastRequest = await redis.get(cooldownKey);
      if (lastRequest) {
        const elapsed = Date.now() - parseInt(lastRequest, 10);
        const remainingSec = Math.max(0, COOLDOWN_TTL - Math.floor(elapsed / 1000));
        const waitText =
          remainingSec < 60 ? `${remainingSec} сек.` : `${Math.ceil(remainingSec / 60)} мин.`;
        await ctx.answerCbQuery(`Подождите ${waitText} перед повторным запросом.`);
        return;
      }

      const user = await findUserByTelegramId(ctx.from.id);

      if (!user) {
        await ctx.answerCbQuery('Вы не привязаны к системе BuhBot.');
        return;
      }

      // Only accountants can use this feature
      if (user.role !== 'accountant') {
        await ctx.answerCbQuery('Эта функция доступна только для бухгалтеров.');
        return;
      }

      logger.info('Processing password setup request', {
        userId: user.id,
        telegramId: ctx.from.id,
        service: 'accountant-handler',
      });

      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
        options: {
          redirectTo: `${env.FRONTEND_URL}/set-password`,
        },
      });

      if (error || !data.properties?.action_link) {
        logger.error('Failed to generate password link', {
          error: error?.message,
          userId: user.id,
          service: 'accountant-handler',
        });
        await ctx.answerCbQuery('Ошибка при создании ссылки. Попробуйте позже.');
        return;
      }

      await redis.set(cooldownKey, Date.now().toString(), 'EX', COOLDOWN_TTL);

      // Remove inline keyboard from original message after use
      try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      } catch {
        // Message may have been already edited or deleted
      }

      await ctx.answerCbQuery('Ссылка отправлена!');
      const sentMsg = await ctx.reply(
        '🔑 *Установка пароля*\n\n' +
          'Перейдите по ссылке ниже для установки пароля:\n\n' +
          data.properties.action_link +
          '\n\n⏰ Ссылка действительна 1 час. После использования она станет недействительной.' +
          '\n\n⚠️ _Это сообщение будет автоматически удалено через 5 минут._',
        { parse_mode: 'Markdown' }
      );

      // Auto-delete after 5 minutes to reduce security exposure
      setTimeout(
        () => {
          ctx.telegram.deleteMessage(sentMsg.chat.id, sentMsg.message_id).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes('message to delete not found')) {
              logger.warn('Failed to auto-delete password recovery message', {
                chatId: sentMsg.chat.id,
                messageId: sentMsg.message_id,
                error: msg,
                service: 'accountant-handler',
              });
            }
          });
        },
        5 * 60 * 1000
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling password setup request', {
        error: errorMessage,
        telegramId: ctx.from?.id,
        service: 'accountant-handler',
      });
      await ctx.answerCbQuery('Произошла ошибка. Попробуйте позже.');
    }
  });

  logger.info('Accountant handler registered', { service: 'accountant-handler' });
}

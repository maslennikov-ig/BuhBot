/**
 * System Handler
 *
 * Handles system commands:
 * - /info - Show bot information and status
 *
 * @module bot/handlers/system.handler
 */

import { bot, BotContext } from '../bot.js';
import logger from '../../utils/logger.js';
import env from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Read version from package.json at startup (works in production builds)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '../../../package.json');

let BOT_VERSION = '1.0.0';
try {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  BOT_VERSION = packageJson.version || '1.0.0';
} catch {
  // Fallback to hardcoded version if package.json is not accessible
  logger.warn('Could not read package.json version, using fallback', {
    service: 'system-handler',
  });
}

/**
 * Register system handlers
 */
export function registerSystemHandler(): void {
  // Handle /info command
  bot.command('info', async (ctx: BotContext) => {
    try {
      const infoMessage = `🤖 *BuhBot Info*\n\n🔹 *Версия:* ${BOT_VERSION}\n🔹 *Среда:* ${env.NODE_ENV}\n🔹 *Тип чата:* ${ctx.chat?.type}\n\nСистема работает в штатном режиме.`;

      await ctx.reply(infoMessage, { parse_mode: 'Markdown' });

      logger.info('Info command processed', {
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        service: 'system-handler',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling /info', {
        error: errorMessage,
        service: 'system-handler',
      });
      await ctx.reply('Ошибка получения информации.');
    }
  });

  // Handle /diagnose command
  bot.command('diagnose', async (ctx: BotContext) => {
    try {
      const chatId = ctx.chat?.id;

      if (!chatId) {
        await ctx.reply('Команда доступна только в групповых чатах.');
        return;
      }

      // Get bot info (includes Privacy Mode status)
      const botInfo = await ctx.telegram.getMe();

      // Get bot's member status in this chat
      const chatMember = await ctx.telegram.getChatMember(chatId, botInfo.id);
      const memberStatus = chatMember.status;

      // Query DB for chat record
      const chatRecord = await prisma.chat.findUnique({
        where: { id: BigInt(chatId) },
        select: {
          id: true,
          chatType: true,
          title: true,
          slaEnabled: true,
          monitoringEnabled: true,
        },
      });

      // Query DB for message count in last 24h
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const messageCount = await prisma.chatMessage.count({
        where: {
          chatId: BigInt(chatId),
          telegramDate: { gte: twentyFourHoursAgo },
        },
      });

      // Determine verdict
      let verdict: string;
      const chatType = ctx.chat?.type;
      const privacyModeOn = !botInfo.can_read_all_group_messages;

      if (privacyModeOn && memberStatus !== 'administrator' && chatType === 'supergroup') {
        verdict =
          'ПРОБЛЕМА: Privacy Mode включён, бот НЕ администратор. Бот не видит обычные сообщения в supergroup. Решение: назначьте бота администратором.';
      } else if (privacyModeOn && memberStatus === 'administrator') {
        verdict = 'OK: Privacy Mode включён, но бот — администратор. Сообщения должны приходить.';
      } else {
        verdict = 'OK: Privacy Mode выключен. Бот видит все сообщения.';
      }

      if (!chatRecord) {
        verdict += ' | Чат НЕ зарегистрирован в БД. Используйте /connect.';
      } else if (messageCount === 0) {
        verdict += ' | За последние 24ч нет сообщений.';
      }

      const diagnosticMessage =
        `Диагностика чата ${chatId}:\n\n` +
        `Privacy Mode: ${botInfo.can_read_all_group_messages ? 'ВЫКЛ (бот видит все)' : 'ВКЛ (нужны права админа для supergroup)'}\n` +
        `Статус бота: ${memberStatus}\n` +
        `Тип чата: ${chatType}\n` +
        `В базе данных: ${chatRecord ? 'Да' : 'Нет'}\n` +
        `SLA: ${chatRecord?.slaEnabled ? 'Вкл' : 'Выкл'}\n` +
        `Мониторинг: ${chatRecord?.monitoringEnabled ? 'Вкл' : 'Выкл'}\n` +
        `Сообщений за 24ч: ${messageCount}\n\n` +
        `Вердикт: ${verdict}`;

      await ctx.reply(diagnosticMessage);

      logger.info('Diagnose command processed', {
        chatId,
        userId: ctx.from?.id,
        memberStatus,
        privacyModeOn,
        chatRecordExists: !!chatRecord,
        messageCount,
        verdict,
        service: 'system-handler',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling /diagnose', {
        error: errorMessage,
        service: 'system-handler',
      });
      await ctx.reply('Ошибка при диагностике.');
    }
  });

  logger.info('System handler registered', { service: 'system-handler' });
}

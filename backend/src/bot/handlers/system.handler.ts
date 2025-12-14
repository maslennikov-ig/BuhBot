/**
 * System Handler
 *
 * Handles system commands:
 * - /info - Show bot information and status
 * - /version - Show current version
 *
 * @module bot/handlers/system.handler
 */

import { bot, BotContext } from '../bot.js';
import logger from '../../utils/logger.js';
import env from '../../config/env.js';

// Package version will be read from process.env.npm_package_version or hardcoded
const BOT_VERSION = process.env.npm_package_version || '1.0.0';

/**
 * Register system handlers
 */
export function registerSystemHandler(): void {
  // Handle /info command
  bot.command('info', async (ctx: BotContext) => {
    try {
      const infoMessage = `🤖 *BuhBot Info*\n\n🔹 *Версия:* ${BOT_VERSION}\n🔹 *Среда:* ${env.NODE_ENV}\n🔹 *ID Чата:* 
${ctx.chat?.id}
🔹 *Тип чата:* ${ctx.chat?.type}\n🔹 *Ваш ID:* 
${ctx.from?.id}

Система работает в штатном режиме.`;

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
        service: 'system-handler'
      });
      await ctx.reply('Ошибка получения информации.');
    }
  });

  // Handle /version command
  bot.command('version', async (ctx: BotContext) => {
    try {
      await ctx.reply(`v${BOT_VERSION}`);
    } catch (error) {
      logger.error('Error handling /version', {
        error: error instanceof Error ? error.message : String(error),
        service: 'system-handler'
      });
    }
  });

  logger.info('System handler registered', { service: 'system-handler' });
}

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

  logger.info('System handler registered', { service: 'system-handler' });
}

/**
 * Telegraf Bot Instance
 *
 * Creates and configures the main Telegram bot instance for BuhBot.
 * Uses Telegraf 4.16.x with TypeScript support.
 *
 * Features:
 * - Type-safe context handling
 * - Global error handling with logging
 * - Graceful shutdown support
 *
 * @module bot/bot
 */

import { Telegraf, Context } from 'telegraf';
import logger from '../utils/logger.js';
import env from '../config/env.js';

/**
 * Extended context type for BuhBot
 * Can be extended with custom properties if needed
 */
export type BotContext = Context;

/**
 * Telegram bot token from environment
 */
const token = env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
}

/**
 * Main Telegraf bot instance
 *
 * @example
 * ```typescript
 * import { bot } from './bot.js';
 *
 * bot.on(message('text'), (ctx) => {
 *   ctx.reply('Hello!');
 * });
 * ```
 */
export const bot = new Telegraf<BotContext>(token);

/**
 * Global error handler for unhandled bot errors
 * Logs errors with full context for debugging
 */
bot.catch((err, ctx) => {
  logger.error('Telegraf bot error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    updateType: ctx.updateType,
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
    service: 'telegram-bot',
  });
});

/**
 * Stop the bot gracefully
 * Called during application shutdown
 *
 * @param signal - Signal that triggered the shutdown (e.g., 'SIGINT', 'SIGTERM')
 */
export function stopBot(signal: string): void {
  logger.info('Stopping Telegram bot...', { signal, service: 'telegram-bot' });
  bot.stop(signal);
  logger.info('Telegram bot stopped', { service: 'telegram-bot' });
}


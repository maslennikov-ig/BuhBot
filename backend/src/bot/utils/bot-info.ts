/**
 * Cached Bot Info & Shared Messages
 *
 * Provides cached getMe() result and reusable bot message templates.
 * Avoids repeated Telegram API calls for static bot properties.
 *
 * @module bot/utils/bot-info
 */

import { bot } from '../bot.js';
import logger from '../../utils/logger.js';

/** Cached result of getMe() — bot properties are static per token */
let cachedBotInfo: Awaited<ReturnType<typeof bot.telegram.getMe>> | null = null;

/**
 * Get bot info with caching.
 * First call hits Telegram API; subsequent calls return cached result.
 */
export async function getBotInfo(): Promise<Awaited<ReturnType<typeof bot.telegram.getMe>>> {
  if (!cachedBotInfo) {
    cachedBotInfo = await bot.telegram.getMe();
  }
  return cachedBotInfo;
}

/**
 * Clear cached bot info (useful for tests or after BotFather changes).
 */
export function clearBotInfoCache(): void {
  cachedBotInfo = null;
}

/**
 * Check if Privacy Mode is enabled (bot cannot read all group messages).
 * Uses cached bot info.
 */
export async function isPrivacyModeOn(): Promise<boolean> {
  const info = await getBotInfo();
  return !info.can_read_all_group_messages;
}

/**
 * Generate Privacy Mode warning message with step-by-step admin promotion guide.
 * Handles undefined bot username gracefully.
 */
export function privacyModeWarning(botUsername: string | undefined): string {
  const usernameRef = botUsername ? `@${botUsername}` : 'бота';
  return (
    '⚠️ Для корректной работы боту нужны права администратора.\n\n' +
    'Без прав админа бот не видит обычные сообщения в групповых чатах.\n\n' +
    'Как исправить:\n' +
    '1. Откройте настройки группы\n' +
    '2. Перейдите в «Администраторы»\n' +
    `3. Назначьте ${usernameRef} администратором\n` +
    '4. Достаточно минимальных прав (только «Управление чатом»)'
  );
}

/**
 * Initialize bot info cache. Call once on startup.
 * Logs Privacy Mode status.
 */
export async function initBotInfo(): Promise<void> {
  try {
    const info = await getBotInfo();
    if (!info.can_read_all_group_messages) {
      logger.warn(
        'Privacy Mode is ON: bot cannot read messages in groups where it is not admin. ' +
          'Disable via BotFather or ensure bot is admin in all monitored groups.',
        { service: 'bot-info' }
      );
    } else {
      logger.info('Privacy Mode is OFF: bot can read all group messages', {
        service: 'bot-info',
      });
    }
  } catch (error) {
    logger.warn('Failed to initialize bot info cache', {
      error: error instanceof Error ? error.message : String(error),
      service: 'bot-info',
    });
  }
}

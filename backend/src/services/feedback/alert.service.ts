/**
 * Low-Rating Alert Service
 *
 * Sends alerts to managers when clients submit low ratings (<=3 stars).
 * Uses the existing alert queue infrastructure for reliable delivery.
 *
 * Alert Flow:
 * 1. Client submits low rating via survey
 * 2. queueLowRatingAlert() queues the alert job
 * 3. Alert worker processes job and calls sendLowRatingAlert()
 * 4. Managers receive Telegram message with feedback details
 *
 * @module services/feedback/alert
 */

import { prisma } from '../../lib/prisma.js';
import { bot } from '../../bot/bot.js';
import { buildLowRatingAlertKeyboard } from '../../bot/keyboards/alert.keyboard.js';
import { escapeHtml, truncateText } from '../alerts/format.service.js';
import logger from '../../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parameters for sending a low-rating alert
 */
export interface LowRatingAlertParams {
  /** UUID of the feedback response */
  feedbackId: string;
  /** Telegram chat ID where the feedback originated */
  chatId: bigint;
  /** Rating value (1-3 for low ratings) */
  rating: number;
  /** Client's Telegram username (may be null or undefined) */
  clientUsername?: string | null | undefined;
  /** Client's comment (may be null or undefined) */
  comment?: string | null | undefined;
}

// ============================================================================
// ALERT FUNCTIONS
// ============================================================================

/**
 * Send low-rating alert to managers
 *
 * Retrieves manager IDs from chat settings or global settings,
 * formats the alert message, and sends to each manager via Telegram.
 *
 * @param params - Alert parameters
 * @throws Error if chat not found
 *
 * @example
 * ```typescript
 * await sendLowRatingAlert({
 *   feedbackId: 'uuid-123',
 *   chatId: BigInt(-100123456789),
 *   rating: 2,
 *   clientUsername: 'john_doe',
 *   comment: 'Very slow response time',
 * });
 * ```
 */
export async function sendLowRatingAlert(params: LowRatingAlertParams): Promise<void> {
  const { feedbackId, chatId, rating, clientUsername, comment } = params;

  logger.info('Sending low-rating alert', {
    feedbackId,
    chatId: chatId.toString(),
    rating,
    service: 'feedback-alert',
  });

  try {
    // Get chat info for the alert (exclude soft-deleted chats, gh-209)
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, deletedAt: null },
      select: {
        title: true,
        managerTelegramIds: true,
      },
    });

    if (!chat) {
      logger.error('Chat not found for low-rating alert', {
        feedbackId,
        chatId: chatId.toString(),
        service: 'feedback-alert',
      });
      throw new Error(`Chat not found: ${chatId}`);
    }

    // Get manager IDs (chat-specific or global fallback)
    const managerIds = await getManagerIds(chat.managerTelegramIds);

    if (managerIds.length === 0) {
      logger.warn('No managers found for low-rating alert', {
        feedbackId,
        chatId: chatId.toString(),
        service: 'feedback-alert',
      });
      return;
    }

    // Format the alert message
    const message = formatLowRatingMessage({
      rating,
      clientUsername: clientUsername ?? null,
      comment: comment ?? null,
      chatTitle: chat.title,
    });

    // Build keyboard with action buttons
    const keyboard = buildLowRatingAlertKeyboard({
      feedbackId,
      chatId: chatId.toString(),
    });

    // Send to each manager
    let successCount = 0;
    let failCount = 0;

    for (const managerId of managerIds) {
      try {
        await bot.telegram.sendMessage(managerId, message, {
          parse_mode: 'HTML',
          ...keyboard,
        });

        logger.debug('Low-rating alert sent to manager', {
          managerId,
          feedbackId,
          service: 'feedback-alert',
        });

        successCount++;
      } catch (error) {
        logger.error('Failed to send low-rating alert to manager', {
          managerId,
          feedbackId,
          error: error instanceof Error ? error.message : String(error),
          service: 'feedback-alert',
        });
        failCount++;
      }
    }

    logger.info('Low-rating alert delivery completed', {
      feedbackId,
      successCount,
      failCount,
      totalManagers: managerIds.length,
      service: 'feedback-alert',
    });
  } catch (error) {
    logger.error('Failed to send low-rating alert', {
      feedbackId,
      chatId: chatId.toString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: 'feedback-alert',
    });
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get manager Telegram IDs for alert delivery
 *
 * Falls back to global managers if no chat-specific managers configured.
 *
 * @param chatManagerIds - Chat-specific manager IDs
 * @returns Array of manager Telegram user IDs
 */
async function getManagerIds(chatManagerIds: string[]): Promise<string[]> {
  // Use chat-specific managers if available
  if (chatManagerIds && chatManagerIds.length > 0) {
    return chatManagerIds;
  }

  // Fall back to global managers
  const globalSettings = await prisma.globalSettings.findUnique({
    where: { id: 'default' },
    select: { globalManagerIds: true },
  });

  return globalSettings?.globalManagerIds ?? [];
}

/**
 * Format low-rating alert message data
 */
interface LowRatingMessageData {
  /** Rating value (1-5) */
  rating: number;
  /** Client's Telegram username */
  clientUsername: string | null;
  /** Client's comment */
  comment: string | null;
  /** Chat title */
  chatTitle: string | null;
}

/**
 * Get star emoji representation for rating
 *
 * @param rating - Rating value (1-5)
 * @returns Star emoji string
 */
function getRatingStars(rating: number): string {
  const filled = '\u2B50'; // Star
  const empty = '\u2606'; // White star (outline)
  return filled.repeat(rating) + empty.repeat(5 - rating);
}

/**
 * Format low-rating alert message for Telegram
 *
 * @param data - Message data
 * @returns Formatted HTML message
 */
function formatLowRatingMessage(data: LowRatingMessageData): string {
  const { rating, clientUsername, comment, chatTitle } = data;

  const stars = getRatingStars(rating);
  const title = chatTitle ? escapeHtml(chatTitle) : '(личный чат)';
  const client = clientUsername ? `@${escapeHtml(clientUsername)}` : '(неизвестен)';

  const lines = [
    `\uD83D\uDCE2 <b>НИЗКАЯ ОЦЕНКА</b>`, // Loudspeaker
    '',
    `${stars} <b>Оценка: ${rating}/5</b>`,
    '',
    `\uD83D\uDC64 Клиент: ${client}`, // Bust in silhouette
    `\uD83D\uDCAC Чат: ${title}`, // Speech balloon
  ];

  // Add comment if provided
  if (comment) {
    const truncatedComment = truncateText(comment, 300);
    lines.push('');
    lines.push(`\uD83D\uDCDD Комментарий:`); // Memo
    lines.push(`<i>${escapeHtml(truncatedComment)}</i>`);
  }

  lines.push('');
  lines.push('<b>Требуется внимание!</b>');

  return lines.join('\n');
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  sendLowRatingAlert,
};

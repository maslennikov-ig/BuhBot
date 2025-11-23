/**
 * Alert Callback Handler
 *
 * Handles inline keyboard button callbacks for SLA alerts.
 * Registered callbacks:
 * - notify_{alertId}: Send reminder to accountant
 * - resolve_{alertId}: Mark alert as resolved
 *
 * Uses Telegraf's action() middleware for pattern matching.
 *
 * @module bot/handlers/alert-callback.handler
 */

import { bot } from '../bot.js';
import { prisma } from '../../lib/prisma.js';
import { resolveAlert, getAlertById } from '../../services/alerts/alert.service.js';
import { cancelEscalation } from '../../services/alerts/escalation.service.js';
import { cancelAllEscalations } from '../../queues/alert.queue.js';
import {
  formatAccountantNotification,
  formatResolutionConfirmation,
  escapeHtml,
} from '../../services/alerts/format.service.js';
import { buildResolvedKeyboard, buildAccountantNotificationKeyboard } from '../keyboards/alert.keyboard.js';
import logger from '../../utils/logger.js';

/**
 * Register alert callback handlers
 *
 * Must be called during bot initialization to enable
 * inline keyboard button handling.
 *
 * Handlers:
 * 1. notify_{alertId} - Notifies the assigned accountant
 * 2. resolve_{alertId} - Marks the alert as resolved
 *
 * @example
 * ```typescript
 * import { registerAlertCallbackHandler } from './handlers/alert-callback.handler.js';
 *
 * // During bot initialization
 * registerAlertCallbackHandler();
 * ```
 */
export function registerAlertCallbackHandler(): void {
  logger.info('Registering alert callback handlers', { service: 'bot' });

  // Handle "Notify accountant" button
  bot.action(/^notify_(.+)$/, async (ctx) => {
    const alertId = ctx.match[1];
    const userId = ctx.from?.id?.toString();

    if (!alertId) {
      await ctx.answerCbQuery('Некорректные данные');
      return;
    }

    logger.info('Notify accountant callback received', {
      alertId,
      userId,
      service: 'alert-callback',
    });

    try {
      // Get alert with request and chat data
      const alert = await getAlertById(alertId);

      if (!alert) {
        logger.warn('Alert not found for notify callback', {
          alertId,
          service: 'alert-callback',
        });
        await ctx.answerCbQuery('Оповещение не найдено');
        return;
      }

      // Get request with chat data
      const request = await prisma.clientRequest.findUnique({
        where: { id: alert.requestId },
        include: {
          chat: true,
        },
      });

      if (!request || !request.chat) {
        logger.warn('Request or chat not found for notify', {
          alertId,
          requestId: alert.requestId,
          service: 'alert-callback',
        });
        await ctx.answerCbQuery('Данные запроса не найдены');
        return;
      }

      // Get accountant to notify
      const accountantUsername = request.chat.accountantUsername;

      if (!accountantUsername) {
        logger.warn('No accountant assigned to chat', {
          chatId: String(request.chatId),
          service: 'alert-callback',
        });
        await ctx.answerCbQuery('Бухгалтер не назначен для этого чата');
        return;
      }

      // Build keyboard with chat link
      const keyboard = buildAccountantNotificationKeyboard(String(request.chatId));

      // Try to send notification
      let notificationSent = false;

      try {
        // Try to send to chat where accountant is - they should see the message
        // We can't send to @username directly, but we can mention them in the group
        const mentionMessage = formatAccountantNotification(
          request.chat.title,
          alert.minutesElapsed,
          request.messageText
        ) + `\n\n@${escapeHtml(accountantUsername)}`;

        await bot.telegram.sendMessage(
          String(request.chatId),
          mentionMessage,
          {
            parse_mode: 'HTML',
            ...keyboard,
          }
        );

        notificationSent = true;
        logger.info('Accountant notified via group mention', {
          alertId,
          chatId: String(request.chatId),
          accountantUsername,
          service: 'alert-callback',
        });
      } catch (error) {
        logger.error('Failed to notify accountant in group', {
          alertId,
          chatId: String(request.chatId),
          error: error instanceof Error ? error.message : String(error),
          service: 'alert-callback',
        });
      }

      if (notificationSent) {
        await ctx.answerCbQuery('Уведомление отправлено бухгалтеру');
      } else {
        await ctx.answerCbQuery('Не удалось отправить уведомление');
      }
    } catch (error) {
      logger.error('Notify callback error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        alertId,
        service: 'alert-callback',
      });
      await ctx.answerCbQuery('Ошибка при отправке уведомления');
    }
  });

  // Handle "Mark resolved" button
  bot.action(/^resolve_(.+)$/, async (ctx) => {
    const alertId = ctx.match[1];
    const userId = ctx.from?.id?.toString();

    if (!alertId) {
      await ctx.answerCbQuery('Некорректные данные');
      return;
    }

    logger.info('Resolve alert callback received', {
      alertId,
      userId,
      service: 'alert-callback',
    });

    try {
      // Get alert to verify it exists and is not already resolved
      const alert = await getAlertById(alertId);

      if (!alert) {
        logger.warn('Alert not found for resolve callback', {
          alertId,
          service: 'alert-callback',
        });
        await ctx.answerCbQuery('Оповещение не найдено');
        return;
      }

      if (alert.resolvedAction !== null) {
        logger.info('Alert already resolved', {
          alertId,
          resolvedAction: alert.resolvedAction,
          service: 'alert-callback',
        });
        await ctx.answerCbQuery('Уже отмечено как решённое');
        return;
      }

      // Resolve the alert
      await resolveAlert(alertId, 'mark_resolved', userId);

      // Cancel pending escalations
      await cancelEscalation(alertId);
      await cancelAllEscalations(alert.requestId);

      // Get request to update its status
      const request = await prisma.clientRequest.findUnique({
        where: { id: alert.requestId },
        include: { chat: true },
      });

      if (request) {
        // Update request status to answered
        await prisma.clientRequest.update({
          where: { id: request.id },
          data: {
            status: 'answered',
            responseAt: new Date(),
          },
        });

        // Update the original message to show resolved status
        if (ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message) {
          const originalText = ctx.callbackQuery.message.text;
          const updatedText = originalText + formatResolutionConfirmation('mark_resolved');

          // Build minimal keyboard with just chat link
          const keyboard = buildResolvedKeyboard(String(request.chatId));

          try {
            await ctx.editMessageText(updatedText, {
              parse_mode: 'HTML',
              ...keyboard,
            });
          } catch (editError) {
            // Message might be too old to edit
            logger.warn('Could not edit resolved message', {
              alertId,
              error: editError instanceof Error ? editError.message : String(editError),
              service: 'alert-callback',
            });
          }
        }
      }

      await ctx.answerCbQuery('Отмечено как решённое');

      logger.info('Alert resolved via callback', {
        alertId,
        userId,
        requestId: alert.requestId,
        service: 'alert-callback',
      });
    } catch (error) {
      logger.error('Resolve callback error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        alertId,
        service: 'alert-callback',
      });
      await ctx.answerCbQuery('Ошибка при обработке');
    }
  });

  logger.info('Alert callback handlers registered', { service: 'bot' });
}

export default registerAlertCallbackHandler;

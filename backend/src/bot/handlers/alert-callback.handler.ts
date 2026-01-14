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

      // Get request with chat data including assigned accountant
      const request = await prisma.clientRequest.findUnique({
        where: { id: alert.requestId },
        include: {
          chat: {
            include: {
              assignedAccountant: true,
            },
          },
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

      // Get accountant to notify - check multiple sources in priority order:
      // 1. assignedAccountant relation (new primary method)
      // 2. accountantUsernames array (multiple accountants)
      // 3. accountantUsername (legacy single field)
      let accountantUsername: string | null = null;

      if (request.chat.assignedAccountant?.telegramUsername) {
        accountantUsername = request.chat.assignedAccountant.telegramUsername;
        logger.debug('Using assignedAccountant.telegramUsername', {
          accountantUsername,
          service: 'alert-callback',
        });
      } else if (request.chat.accountantUsernames && request.chat.accountantUsernames.length > 0) {
        accountantUsername = request.chat.accountantUsernames[0] ?? null;
        logger.debug('Using accountantUsernames[0]', {
          accountantUsername,
          service: 'alert-callback',
        });
      } else if (request.chat.accountantUsername) {
        accountantUsername = request.chat.accountantUsername;
        logger.debug('Using legacy accountantUsername', {
          accountantUsername,
          service: 'alert-callback',
        });
      }

      if (!accountantUsername) {
        logger.warn('No accountant assigned to chat', {
          chatId: String(request.chatId),
          assignedAccountantId: request.chat.assignedAccountantId,
          accountantUsernames: request.chat.accountantUsernames,
          service: 'alert-callback',
        });
        await ctx.answerCbQuery('Бухгалтер не назначен для этого чата');
        return;
      }

      // Build keyboard with chat link (use invite link if available)
      const keyboard = buildAccountantNotificationKeyboard(
        String(request.chatId),
        request.chat.inviteLink,
        request.chat.chatType
      );

      // Build notification message
      const notificationMessage = formatAccountantNotification(
        request.chat.title,
        alert.minutesElapsed,
        request.messageText
      );

      // Try to send notification - prefer DM to accountant(s), fallback to group mention
      let notificationSent = false;

      // Priority 1: Send to all accountants' DMs
      // Collect all unique accountant telegram IDs
      const accountantTelegramIds = new Set<string>();

      // Add assigned accountant if exists
      if (request.chat.assignedAccountant?.telegramId) {
        accountantTelegramIds.add(request.chat.assignedAccountant.telegramId.toString());
      }

      // Add accountants from accountantUsernames array
      if (request.chat.accountantUsernames && request.chat.accountantUsernames.length > 0) {
        // Query users by telegram username
        const normalizedUsernames = request.chat.accountantUsernames.map(u => u.replace(/^@/, ''));

        try {
          const accountantUsers = await prisma.user.findMany({
            where: {
              telegramUsername: {
                in: normalizedUsernames,
              },
            },
            select: { telegramId: true, telegramUsername: true },
          });

          // Add found telegram IDs to set (automatic deduplication)
          for (const user of accountantUsers) {
            if (user.telegramId) {
              accountantTelegramIds.add(user.telegramId.toString());
            }
          }

          // Log if some usernames not found
          const foundUsernames = new Set(accountantUsers.map(u => u.telegramUsername).filter((u): u is string => u !== null));
          const notFoundUsernames = normalizedUsernames.filter(u => !foundUsernames.has(u));
          if (notFoundUsernames.length > 0) {
            logger.warn('Some accountant usernames not found in database', {
              notFound: notFoundUsernames,
              chatId: String(request.chatId),
              service: 'alert-callback',
            });
          }
        } catch (error) {
          logger.error('Failed to lookup accountant users by username', {
            error: error instanceof Error ? error.message : String(error),
            usernames: normalizedUsernames,
            service: 'alert-callback',
          });
        }
      }

      // Send notifications to all found accountants
      let successCount = 0;
      let failCount = 0;

      for (const telegramId of accountantTelegramIds) {
        try {
          await bot.telegram.sendMessage(
            telegramId,
            notificationMessage,
            {
              parse_mode: 'HTML',
              ...keyboard,
            }
          );

          successCount++;
          logger.info('Accountant notified via DM', {
            alertId,
            accountantTelegramId: telegramId,
            service: 'alert-callback',
          });
        } catch (error) {
          failCount++;
          // DM failed - maybe bot blocked
          logger.warn('Failed to notify accountant via DM', {
            alertId,
            accountantTelegramId: telegramId,
            error: error instanceof Error ? error.message : String(error),
            service: 'alert-callback',
          });
        }
      }

      // If at least one DM succeeded, consider notification sent
      if (successCount > 0) {
        notificationSent = true;
        logger.info('Accountants notified via DM', {
          alertId,
          successCount,
          failCount,
          totalAccountants: accountantTelegramIds.size,
          service: 'alert-callback',
        });
      }

      // Priority 2: Fallback to group mention if DM failed or no telegram_id
      if (!notificationSent) {
        try {
          const mentionMessage = notificationMessage + `\n\n@${escapeHtml(accountantUsername)}`;

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

          // Build minimal keyboard with just chat link (use invite link if available)
          const keyboard = buildResolvedKeyboard(
            String(request.chatId),
            request.chat?.inviteLink,
            request.chat?.chatType
          );

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

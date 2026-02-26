/**
 * Alert Service
 *
 * Manages SLA alert lifecycle:
 * - Create alerts for warnings and breaches
 * - Resolve alerts via manual action or accountant response
 * - Query active alerts
 * - Track delivery status
 *
 * @module services/alerts/alert.service
 */

import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { queueAlert, scheduleEscalation } from '../../queues/setup.js';
import type { SlaAlert, AlertType, AlertAction, AlertDeliveryStatus } from '@prisma/client';
import { appNotificationService } from '../notification/app-notification.service.js';

/** UUID v4 format validation (gh-121) */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Re-export types for consumers
export type { SlaAlert, AlertType, AlertAction, AlertDeliveryStatus };

/**
 * Parameters for creating a new alert
 */
export interface CreateAlertParams {
  /** Unique identifier for the client request */
  requestId: string;
  /** Type of alert: warning (80% threshold) or breach (100% threshold) */
  alertType: 'warning' | 'breach';
  /** Minutes elapsed since request received */
  minutesElapsed: number;
  /** Current escalation level (default: 1) */
  escalationLevel?: number;
}

/**
 * Parameters for resolving an alert
 */
export interface ResolveAlertParams {
  /** Resolution action type */
  action: AlertAction;
  /** User ID who resolved (Telegram user ID as string) */
  userId?: string;
  /** Optional resolution notes */
  notes?: string;
}

/**
 * Default escalation configuration
 */
const DEFAULT_ESCALATION_CONFIG = {
  maxEscalations: 5,
  escalationIntervalMin: 30,
};

/**
 * Create a new SLA alert
 *
 * Creates an alert record in the database, queues it for delivery,
 * and schedules the next escalation if applicable.
 *
 * @param params - Alert creation parameters
 * @returns Created SlaAlert record
 *
 * @example
 * ```typescript
 * const alert = await createAlert({
 *   requestId: 'uuid-123',
 *   alertType: 'breach',
 *   minutesElapsed: 65,
 * });
 * ```
 */
export async function createAlert(params: CreateAlertParams): Promise<SlaAlert> {
  const { requestId, alertType, minutesElapsed, escalationLevel = 1 } = params;

  // Validate UUID format (gh-121)
  if (!UUID_REGEX.test(requestId)) {
    throw new Error(`Invalid requestId format: ${requestId}`);
  }

  logger.info('Creating SLA alert', {
    requestId,
    alertType,
    minutesElapsed,
    escalationLevel,
    service: 'alert',
  });

  try {
    // Idempotency: check for existing unresolved alert at same level (gh-99)
    const existingAlert = await prisma.slaAlert.findFirst({
      where: {
        requestId,
        alertType,
        escalationLevel,
        resolvedAction: null,
      },
    });

    if (existingAlert) {
      logger.info('Duplicate alert skipped (already exists)', {
        existingAlertId: existingAlert.id,
        requestId,
        alertType,
        escalationLevel,
        service: 'alert',
      });
      return existingAlert;
    }

    // Get request with chat and manager info
    const request = await prisma.clientRequest.findUnique({
      where: { id: requestId },
      include: {
        chat: true,
      },
    });

    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    // Get global settings for escalation config
    const globalSettings = await prisma.globalSettings.findUnique({
      where: { id: 'default' },
    });

    const maxEscalations =
      globalSettings?.maxEscalations ?? DEFAULT_ESCALATION_CONFIG.maxEscalations;
    const escalationIntervalMin =
      globalSettings?.escalationIntervalMin ?? DEFAULT_ESCALATION_CONFIG.escalationIntervalMin;

    // Calculate next escalation time
    const nextEscalationAt =
      escalationLevel < maxEscalations
        ? new Date(Date.now() + escalationIntervalMin * 60 * 1000)
        : null;

    // Create alert record
    const alert = await prisma.slaAlert.create({
      data: {
        requestId,
        alertType,
        minutesElapsed,
        escalationLevel,
        deliveryStatus: 'pending',
        nextEscalationAt,
      },
    });

    logger.info('SLA alert created', {
      alertId: alert.id,
      requestId,
      alertType,
      escalationLevel,
      nextEscalationAt: nextEscalationAt?.toISOString(),
      service: 'alert',
    });

    // Get manager IDs to notify
    const managerIds = await getManagerIdsForChat(request.chatId);

    if (managerIds.length === 0) {
      logger.warn('No managers found to notify for alert', {
        alertId: alert.id,
        chatId: String(request.chatId),
        service: 'alert',
      });
    } else {
      // Queue alert for delivery, with error recovery (gh-91)
      try {
        await queueAlert({
          requestId,
          alertType,
          managerIds,
          escalationLevel,
        });

        logger.info('Alert queued for delivery', {
          alertId: alert.id,
          managerCount: managerIds.length,
          service: 'alert',
        });
      } catch (queueError) {
        // Queue failed — mark alert as pending so reconciliation job can retry
        logger.error('Failed to queue alert, marking as pending for reconciliation', {
          alertId: alert.id,
          requestId,
          error: queueError instanceof Error ? queueError.message : String(queueError),
          service: 'alert',
        });
        // deliveryStatus is already 'pending' from creation, no update needed
        // The SLA reconciliation job will pick up undelivered alerts
      }

      // Create in-app notifications for managers (non-critical, don't fail on error)
      try {
        await createNotificationsForManagers(
          managerIds,
          alert,
          request.chat?.title ?? 'Неизвестный чат',
          request.clientUsername,
          request.messageText
        );
      } catch (notifError) {
        logger.error('Failed to create in-app notifications', {
          alertId: alert.id,
          error: notifError instanceof Error ? notifError.message : String(notifError),
          service: 'alert',
        });
      }
    }

    // Schedule next escalation if not at max level
    if (nextEscalationAt && escalationLevel < maxEscalations) {
      await scheduleEscalation(
        {
          requestId,
          alertType: 'breach', // Escalations are always breach-level
          managerIds,
          escalationLevel: escalationLevel + 1,
        },
        escalationIntervalMin
      );

      logger.info('Next escalation scheduled', {
        alertId: alert.id,
        nextLevel: escalationLevel + 1,
        delayMinutes: escalationIntervalMin,
        service: 'alert',
      });
    }

    return alert;
  } catch (error) {
    logger.error('Failed to create alert', {
      requestId,
      alertType,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: 'alert',
    });
    throw error;
  }
}

/**
 * Resolve an alert
 *
 * Marks the alert as resolved with the specified action and user.
 *
 * @param alertId - UUID of the SlaAlert
 * @param action - Resolution action type
 * @param userId - Optional user ID who resolved
 * @returns Updated SlaAlert record
 */
export async function resolveAlert(
  alertId: string,
  action: AlertAction,
  userId?: string
): Promise<SlaAlert> {
  // Validate UUID format (gh-121)
  if (!UUID_REGEX.test(alertId)) {
    throw new Error(`Invalid alertId format: ${alertId}`);
  }

  logger.info('Resolving alert', {
    alertId,
    action,
    userId,
    service: 'alert',
  });

  try {
    const alert = await prisma.slaAlert.update({
      where: { id: alertId },
      data: {
        resolvedAction: action,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId ?? null,
        nextEscalationAt: null, // Clear pending escalation
      },
    });

    logger.info('Alert resolved', {
      alertId,
      action,
      userId,
      service: 'alert',
    });

    return alert;
  } catch (error) {
    logger.error('Failed to resolve alert', {
      alertId,
      action,
      error: error instanceof Error ? error.message : String(error),
      service: 'alert',
    });
    throw error;
  }
}

/**
 * Resolve all active alerts for a request
 *
 * Called when accountant responds to client message.
 *
 * @param requestId - UUID of the ClientRequest
 * @param action - Resolution action type
 * @param userId - Optional user ID who resolved
 * @returns Number of alerts resolved
 */
export async function resolveAlertsForRequest(
  requestId: string,
  action: AlertAction,
  userId?: string
): Promise<number> {
  logger.info('Resolving all alerts for request', {
    requestId,
    action,
    userId,
    service: 'alert',
  });

  try {
    const result = await prisma.slaAlert.updateMany({
      where: {
        requestId,
        resolvedAction: null, // Only unresolved alerts
      },
      data: {
        resolvedAction: action,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId ?? null,
        nextEscalationAt: null,
      },
    });

    logger.info('Alerts resolved for request', {
      requestId,
      count: result.count,
      action,
      service: 'alert',
    });

    return result.count;
  } catch (error) {
    logger.error('Failed to resolve alerts for request', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      service: 'alert',
    });
    throw error;
  }
}

/**
 * Get active (unresolved) alerts
 *
 * @param chatId - Optional filter by chat ID
 * @returns List of active SlaAlert records with related data
 */
export async function getActiveAlerts(chatId?: string): Promise<SlaAlert[]> {
  try {
    const alerts = await prisma.slaAlert.findMany({
      where: {
        resolvedAction: null,
        ...(chatId && {
          request: {
            chatId: BigInt(chatId),
          },
        }),
      },
      include: {
        request: {
          include: {
            chat: true,
          },
        },
      },
      orderBy: {
        alertSentAt: 'desc',
      },
    });

    return alerts;
  } catch (error) {
    logger.error('Failed to get active alerts', {
      chatId,
      error: error instanceof Error ? error.message : String(error),
      service: 'alert',
    });
    throw error;
  }
}

/**
 * Get alert by ID
 *
 * @param alertId - UUID of the SlaAlert
 * @returns SlaAlert record with related data or null
 */
export async function getAlertById(alertId: string): Promise<SlaAlert | null> {
  // Validate UUID format (gh-121)
  if (!UUID_REGEX.test(alertId)) {
    return null;
  }

  try {
    const alert = await prisma.slaAlert.findUnique({
      where: { id: alertId },
      include: {
        request: {
          include: {
            chat: true,
          },
        },
      },
    });

    return alert;
  } catch (error) {
    logger.error('Failed to get alert by ID', {
      alertId,
      error: error instanceof Error ? error.message : String(error),
      service: 'alert',
    });
    throw error;
  }
}

/**
 * Update alert delivery status
 *
 * @param alertId - UUID of the SlaAlert
 * @param status - New delivery status
 * @param telegramMessageId - Optional Telegram message ID
 * @returns Updated SlaAlert record
 */
export async function updateDeliveryStatus(
  alertId: string,
  status: AlertDeliveryStatus,
  telegramMessageId?: bigint
): Promise<SlaAlert> {
  try {
    const data: Record<string, unknown> = {
      deliveryStatus: status,
    };

    if (status === 'delivered') {
      data['deliveredAt'] = new Date();
    }

    if (telegramMessageId !== undefined) {
      data['telegramMessageId'] = telegramMessageId;
    }

    const alert = await prisma.slaAlert.update({
      where: { id: alertId },
      data,
    });

    logger.debug('Alert delivery status updated', {
      alertId,
      status,
      telegramMessageId: telegramMessageId?.toString(),
      service: 'alert',
    });

    return alert;
  } catch (error) {
    logger.error('Failed to update delivery status', {
      alertId,
      status,
      error: error instanceof Error ? error.message : String(error),
      service: 'alert',
    });
    throw error;
  }
}

/**
 * Get manager Telegram IDs for a chat
 *
 * Returns chat-specific managers if configured,
 * otherwise falls back to global managers.
 *
 * @param chatId - Telegram chat ID as bigint
 * @returns Array of manager Telegram user IDs
 */
async function getManagerIdsForChat(chatId: bigint): Promise<string[]> {
  try {
    // First, check chat-specific managers (exclude soft-deleted chats, gh-209)
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, deletedAt: null },
      select: { managerTelegramIds: true },
    });

    if (chat?.managerTelegramIds && chat.managerTelegramIds.length > 0) {
      return chat.managerTelegramIds;
    }

    // Fall back to global managers
    const globalSettings = await prisma.globalSettings.findUnique({
      where: { id: 'default' },
      select: { globalManagerIds: true },
    });

    return globalSettings?.globalManagerIds ?? [];
  } catch (error) {
    logger.error('Failed to get manager IDs for chat', {
      chatId: String(chatId),
      error: error instanceof Error ? error.message : String(error),
      service: 'alert',
    });
    return [];
  }
}

/**
 * Update escalation level for an alert
 *
 * @param alertId - UUID of the SlaAlert
 * @param level - New escalation level
 * @param nextEscalationAt - When to escalate next (null if max reached)
 * @returns Updated SlaAlert record
 */
export async function updateEscalationLevel(
  alertId: string,
  level: number,
  nextEscalationAt: Date | null
): Promise<SlaAlert> {
  try {
    const alert = await prisma.slaAlert.update({
      where: { id: alertId },
      data: {
        escalationLevel: level,
        nextEscalationAt,
      },
    });

    logger.info('Alert escalation level updated', {
      alertId,
      level,
      nextEscalationAt: nextEscalationAt?.toISOString(),
      service: 'alert',
    });

    return alert;
  } catch (error) {
    logger.error('Failed to update escalation level', {
      alertId,
      level,
      error: error instanceof Error ? error.message : String(error),
      service: 'alert',
    });
    throw error;
  }
}

/**
 * Create in-app notifications for managers when SLA alert is triggered
 *
 * Finds users by their Telegram IDs and creates notifications for them.
 *
 * @param managerTelegramIds - Array of manager Telegram IDs
 * @param alert - The SlaAlert record
 * @param chatTitle - Title of the chat
 * @param clientUsername - Client's username (optional)
 * @param messagePreview - Preview of the message
 */
async function createNotificationsForManagers(
  managerTelegramIds: string[],
  alert: SlaAlert,
  chatTitle: string,
  clientUsername: string | null,
  messagePreview: string
): Promise<void> {
  try {
    // Find users by their Telegram IDs
    const users = await prisma.user.findMany({
      where: {
        telegramId: {
          in: managerTelegramIds.map((id) => BigInt(id)),
        },
      },
      select: { id: true, telegramId: true },
    });

    if (users.length === 0) {
      logger.warn('No users found for manager Telegram IDs', {
        managerTelegramIds,
        service: 'alert',
      });
      return;
    }

    // Prepare notification content
    const isWarning = alert.alertType === 'warning';
    const title = isWarning ? `⚠️ SLA предупреждение` : `🚨 SLA нарушение`;

    const clientInfo = clientUsername ? `@${clientUsername}` : 'Клиент';
    const preview =
      messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview;

    const message = isWarning
      ? `${clientInfo} в чате "${chatTitle}" ждёт ответа ${alert.minutesElapsed} мин. Сообщение: "${preview}"`
      : `${clientInfo} в чате "${chatTitle}" не получил ответ уже ${alert.minutesElapsed} мин! Сообщение: "${preview}"`;

    // Create notifications for all found users
    const notifications = users.map((user) =>
      appNotificationService.create({
        userId: user.id,
        title,
        message,
        type: isWarning ? 'warning' : 'error',
        link: '/alerts',
      })
    );

    await Promise.all(notifications);

    logger.info('In-app notifications created for managers', {
      alertId: alert.id,
      userCount: users.length,
      alertType: alert.alertType,
      service: 'alert',
    });
  } catch (error) {
    // Don't fail the alert creation if notification fails
    logger.error('Failed to create in-app notifications', {
      alertId: alert.id,
      error: error instanceof Error ? error.message : String(error),
      service: 'alert',
    });
  }
}

export default {
  createAlert,
  resolveAlert,
  resolveAlertsForRequest,
  getActiveAlerts,
  getAlertById,
  updateDeliveryStatus,
  updateEscalationLevel,
};

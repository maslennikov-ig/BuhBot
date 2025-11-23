/**
 * Escalation Service
 *
 * Manages alert escalation scheduling and processing.
 * Escalations increase urgency when alerts remain unresolved.
 *
 * Escalation Levels:
 * - Level 1: Initial alert (default)
 * - Level 2-5: Increasing urgency escalations
 *
 * Configuration:
 * - maxEscalations: Maximum escalation level (default: 5)
 * - escalationIntervalMin: Minutes between escalations (default: 30)
 *
 * @module services/alerts/escalation.service
 */

import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { scheduleEscalation, cancelEscalation as cancelEscalationJob } from '../../queues/setup.js';
import { getAlertById, updateEscalationLevel } from './alert.service.js';

/**
 * Escalation configuration
 */
export interface EscalationConfig {
  /** Maximum number of escalation levels (default: 5) */
  maxEscalations: number;
  /** Minutes between escalation notifications (default: 30) */
  escalationIntervalMin: number;
}

/**
 * Default escalation configuration
 */
const DEFAULT_ESCALATION_CONFIG: EscalationConfig = {
  maxEscalations: 5,
  escalationIntervalMin: 30,
};

/**
 * Get escalation configuration from global settings
 *
 * @returns Escalation configuration
 */
async function getEscalationConfig(): Promise<EscalationConfig> {
  try {
    const globalSettings = await prisma.globalSettings.findUnique({
      where: { id: 'default' },
    });

    if (!globalSettings) {
      return DEFAULT_ESCALATION_CONFIG;
    }

    return {
      maxEscalations: globalSettings.maxEscalations ?? DEFAULT_ESCALATION_CONFIG.maxEscalations,
      escalationIntervalMin: globalSettings.escalationIntervalMin ?? DEFAULT_ESCALATION_CONFIG.escalationIntervalMin,
    };
  } catch (error) {
    logger.error('Failed to get escalation config, using defaults', {
      error: error instanceof Error ? error.message : String(error),
      service: 'escalation',
    });
    return DEFAULT_ESCALATION_CONFIG;
  }
}

/**
 * Get manager IDs for escalation
 *
 * @param chatId - Telegram chat ID as bigint
 * @returns Array of manager Telegram user IDs
 */
async function getManagerIdsForChat(chatId: bigint): Promise<string[]> {
  try {
    // Check chat-specific managers first
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
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
    logger.error('Failed to get manager IDs', {
      chatId: String(chatId),
      error: error instanceof Error ? error.message : String(error),
      service: 'escalation',
    });
    return [];
  }
}

/**
 * Schedule next escalation for an alert
 *
 * Checks if max escalations reached and schedules the next
 * escalation job if appropriate.
 *
 * @param alertId - UUID of the SlaAlert
 * @param currentLevel - Current escalation level
 * @param config - Optional escalation configuration
 *
 * @example
 * ```typescript
 * // Schedule next escalation after current one is processed
 * await scheduleNextEscalation('uuid-alert-123', 1);
 * // Will schedule level 2 escalation in 30 minutes
 * ```
 */
export async function scheduleNextEscalation(
  alertId: string,
  currentLevel: number,
  config?: EscalationConfig
): Promise<void> {
  logger.info('Scheduling next escalation', {
    alertId,
    currentLevel,
    service: 'escalation',
  });

  try {
    // Get configuration
    const escalationConfig = config ?? await getEscalationConfig();
    const { maxEscalations, escalationIntervalMin } = escalationConfig;

    // Check if max escalations reached
    if (currentLevel >= maxEscalations) {
      logger.info('Max escalations reached, no further escalation', {
        alertId,
        currentLevel,
        maxEscalations,
        service: 'escalation',
      });

      // Update alert to mark no more escalations
      await updateEscalationLevel(alertId, currentLevel, null);
      return;
    }

    // Get alert with request data
    const alert = await getAlertById(alertId);

    if (!alert) {
      logger.error('Alert not found for escalation', {
        alertId,
        service: 'escalation',
      });
      return;
    }

    // Check if alert is already resolved
    if (alert.resolvedAction !== null) {
      logger.info('Alert already resolved, skipping escalation', {
        alertId,
        resolvedAction: alert.resolvedAction,
        service: 'escalation',
      });
      return;
    }

    // Get request to check chat
    const request = await prisma.clientRequest.findUnique({
      where: { id: alert.requestId },
      include: { chat: true },
    });

    if (!request) {
      logger.error('Request not found for escalation', {
        alertId,
        requestId: alert.requestId,
        service: 'escalation',
      });
      return;
    }

    // Check if request is already answered
    if (request.status === 'answered') {
      logger.info('Request already answered, skipping escalation', {
        alertId,
        requestId: request.id,
        service: 'escalation',
      });
      return;
    }

    // Get manager IDs
    const managerIds = await getManagerIdsForChat(request.chatId);

    if (managerIds.length === 0) {
      logger.warn('No managers to escalate to', {
        alertId,
        chatId: String(request.chatId),
        service: 'escalation',
      });
      return;
    }

    const nextLevel = currentLevel + 1;
    const nextEscalationAt = new Date(Date.now() + escalationIntervalMin * 60 * 1000);

    // Schedule escalation job
    await scheduleEscalation(
      {
        requestId: alert.requestId,
        alertType: 'breach', // Escalations are always breach-level
        managerIds,
        escalationLevel: nextLevel,
      },
      escalationIntervalMin
    );

    // Update alert with next escalation time
    await updateEscalationLevel(alertId, currentLevel, nextEscalationAt);

    logger.info('Next escalation scheduled', {
      alertId,
      nextLevel,
      delayMinutes: escalationIntervalMin,
      nextEscalationAt: nextEscalationAt.toISOString(),
      service: 'escalation',
    });
  } catch (error) {
    logger.error('Failed to schedule next escalation', {
      alertId,
      currentLevel,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: 'escalation',
    });
    throw error;
  }
}

/**
 * Cancel pending escalation for an alert
 *
 * Cancels the scheduled escalation job and clears the
 * nextEscalationAt timestamp in the database.
 *
 * @param alertId - UUID of the SlaAlert
 *
 * @example
 * ```typescript
 * // Cancel escalation when alert is resolved
 * await cancelEscalation('uuid-alert-123');
 * ```
 */
export async function cancelEscalation(alertId: string): Promise<void> {
  logger.info('Cancelling escalation', {
    alertId,
    service: 'escalation',
  });

  try {
    // Get current alert to find escalation level
    const alert = await getAlertById(alertId);

    if (!alert) {
      logger.warn('Alert not found when cancelling escalation', {
        alertId,
        service: 'escalation',
      });
      return;
    }

    // Cancel jobs at all pending levels
    let cancelledCount = 0;
    for (let level = alert.escalationLevel; level <= 5; level++) {
      const cancelled = await cancelEscalationJob(alert.requestId, level);
      if (cancelled) {
        cancelledCount++;
      }
    }

    // Clear next escalation timestamp
    await prisma.slaAlert.update({
      where: { id: alertId },
      data: { nextEscalationAt: null },
    });

    logger.info('Escalation cancelled', {
      alertId,
      cancelledCount,
      service: 'escalation',
    });
  } catch (error) {
    logger.error('Failed to cancel escalation', {
      alertId,
      error: error instanceof Error ? error.message : String(error),
      service: 'escalation',
    });
    throw error;
  }
}

/**
 * Process an escalation (called by escalation job)
 *
 * Updates the alert escalation level and triggers notification.
 * This is typically called by the alert worker when processing
 * an escalation job.
 *
 * @param alertId - UUID of the SlaAlert
 *
 * @example
 * ```typescript
 * // Process escalation when job fires
 * await processEscalation('uuid-alert-123');
 * ```
 */
export async function processEscalation(alertId: string): Promise<void> {
  logger.info('Processing escalation', {
    alertId,
    service: 'escalation',
  });

  try {
    const alert = await getAlertById(alertId);

    if (!alert) {
      logger.error('Alert not found for escalation processing', {
        alertId,
        service: 'escalation',
      });
      return;
    }

    // Check if already resolved
    if (alert.resolvedAction !== null) {
      logger.info('Alert resolved, skipping escalation processing', {
        alertId,
        resolvedAction: alert.resolvedAction,
        service: 'escalation',
      });
      return;
    }

    const newLevel = alert.escalationLevel + 1;

    // Update escalation level in database
    await updateEscalationLevel(alertId, newLevel, null);

    logger.info('Escalation processed', {
      alertId,
      newLevel,
      service: 'escalation',
    });
  } catch (error) {
    logger.error('Failed to process escalation', {
      alertId,
      error: error instanceof Error ? error.message : String(error),
      service: 'escalation',
    });
    throw error;
  }
}

/**
 * Check if alert needs immediate escalation
 *
 * Used during startup to catch up on missed escalations.
 *
 * @param alertId - UUID of the SlaAlert
 * @returns true if escalation is overdue
 */
export async function isEscalationOverdue(alertId: string): Promise<boolean> {
  try {
    const alert = await prisma.slaAlert.findUnique({
      where: { id: alertId },
      select: { nextEscalationAt: true, resolvedAction: true },
    });

    if (!alert || alert.resolvedAction !== null) {
      return false;
    }

    if (!alert.nextEscalationAt) {
      return false;
    }

    return new Date() > alert.nextEscalationAt;
  } catch (error) {
    logger.error('Failed to check escalation status', {
      alertId,
      error: error instanceof Error ? error.message : String(error),
      service: 'escalation',
    });
    return false;
  }
}

export default {
  scheduleNextEscalation,
  cancelEscalation,
  processEscalation,
  isEscalationOverdue,
};

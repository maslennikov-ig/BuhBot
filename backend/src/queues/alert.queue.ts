/**
 * Alert Queue Module
 *
 * Re-exports alert queue functionality from setup.js and provides
 * additional helper functions for formatted alert operations.
 *
 * Queue Types:
 * - send-alert: Immediate alert delivery
 * - escalation: Delayed escalation notifications
 *
 * @module queues/alert.queue
 */

import {
  alertQueue,
  queueAlert,
  scheduleEscalation,
  cancelEscalation,
  type AlertJobData,
} from './setup.js';
import logger from '../utils/logger.js';

// Re-export core functionality
export {
  alertQueue,
  queueAlert,
  scheduleEscalation,
  cancelEscalation,
  type AlertJobData,
};

/**
 * Extended alert data with pre-formatted content
 */
export interface FormattedAlertData extends AlertJobData {
  /** Pre-formatted HTML message */
  formattedMessage?: string;
  /** Chat ID for keyboard buttons */
  chatId?: string;
}

/**
 * Queue an alert with formatted message
 *
 * Convenience wrapper that adds formatted content to alert job data.
 *
 * @param data - Formatted alert data
 * @returns The created job
 *
 * @example
 * ```typescript
 * await queueAlertWithFormat({
 *   requestId: 'uuid-123',
 *   alertType: 'breach',
 *   managerIds: ['123456789'],
 *   escalationLevel: 1,
 *   formattedMessage: '<b>НАРУШЕНИЕ SLA</b>...',
 *   chatId: '-100123456789',
 * });
 * ```
 */
export async function queueAlertWithFormat(data: FormattedAlertData) {
  logger.info('Queueing formatted alert', {
    requestId: data.requestId,
    alertType: data.alertType,
    escalationLevel: data.escalationLevel,
    managerCount: data.managerIds.length,
    hasFormattedMessage: !!data.formattedMessage,
    service: 'alert-queue',
  });

  // Queue the alert with extended data
  // The worker will use formattedMessage if provided
  const job = await alertQueue.add('send-alert', data);

  logger.info('Formatted alert queued', {
    jobId: job.id,
    requestId: data.requestId,
    service: 'alert-queue',
  });

  return job;
}

/**
 * Cancel all pending escalations for a request
 *
 * Cancels escalation jobs at all levels (1-5).
 *
 * @param requestId - UUID of the ClientRequest
 * @returns Number of cancelled jobs
 */
export async function cancelAllEscalations(requestId: string): Promise<number> {
  logger.info('Cancelling all escalations', {
    requestId,
    service: 'alert-queue',
  });

  let cancelledCount = 0;

  // Try to cancel escalations at all levels (1-5)
  for (let level = 1; level <= 5; level++) {
    const cancelled = await cancelEscalation(requestId, level);
    if (cancelled) {
      cancelledCount++;
    }
  }

  logger.info('Escalations cancelled', {
    requestId,
    cancelledCount,
    service: 'alert-queue',
  });

  return cancelledCount;
}

/**
 * Get count of pending alert jobs
 *
 * @returns Count of waiting and delayed jobs
 */
export async function getPendingAlertCount(): Promise<number> {
  try {
    const counts = await alertQueue.getJobCounts('waiting', 'delayed');
    return (counts['waiting'] ?? 0) + (counts['delayed'] ?? 0);
  } catch (error) {
    logger.error('Failed to get pending alert count', {
      error: error instanceof Error ? error.message : String(error),
      service: 'alert-queue',
    });
    return 0;
  }
}

/**
 * Get count of active (processing) alert jobs
 *
 * @returns Count of active jobs
 */
export async function getActiveAlertCount(): Promise<number> {
  try {
    const counts = await alertQueue.getJobCounts('active');
    return counts['active'] ?? 0;
  } catch (error) {
    logger.error('Failed to get active alert count', {
      error: error instanceof Error ? error.message : String(error),
      service: 'alert-queue',
    });
    return 0;
  }
}

export default {
  alertQueue,
  queueAlert,
  queueAlertWithFormat,
  scheduleEscalation,
  cancelEscalation,
  cancelAllEscalations,
  getPendingAlertCount,
  getActiveAlertCount,
};

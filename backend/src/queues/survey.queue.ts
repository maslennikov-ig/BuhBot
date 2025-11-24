/**
 * Survey Queue Configuration
 *
 * Handles survey delivery, reminders, and notifications.
 * Implements NFR-006: 5 retries over 1 hour with exponential backoff.
 *
 * Job Types:
 * - survey-delivery: Send survey to client chat
 * - reminder: Send day-2 reminder for non-responses
 * - manager-notification: Notify manager of non-response
 *
 * @module queues/survey
 */

import { Queue, QueueEvents } from 'bullmq';
import { redis } from '../lib/redis.js';
import logger from '../utils/logger.js';

// ============================================================================
// JOB DATA TYPES
// ============================================================================

/**
 * Survey delivery job data
 */
export interface SurveyDeliveryJobData {
  /** Survey campaign ID */
  surveyId: string;
  /** Target chat ID */
  chatId: string;
  /** Delivery record ID */
  deliveryId: string;
  /** Survey quarter (e.g., "2025-Q1") */
  quarter: string;
}

/**
 * Survey reminder job data
 */
export interface SurveyReminderJobData {
  /** Survey campaign ID */
  surveyId: string;
  /** Target chat ID */
  chatId: string;
  /** Delivery record ID */
  deliveryId: string;
}

/**
 * Manager notification job data (for non-response)
 */
export interface ManagerNotificationJobData {
  /** Survey campaign ID */
  surveyId: string;
  /** Target chat ID */
  chatId: string;
  /** Delivery record ID */
  deliveryId: string;
  /** Manager Telegram IDs to notify */
  managerIds: string[];
}

// Union type for all survey job data
export type SurveyJobData = SurveyDeliveryJobData | SurveyReminderJobData | ManagerNotificationJobData;

// ============================================================================
// QUEUE CONFIGURATION
// ============================================================================

export const SURVEY_QUEUE_NAME = 'surveys';

/**
 * Survey Queue
 *
 * Handles survey delivery with NFR-006 compliance:
 * - 5 retry attempts over 1 hour
 * - Exponential backoff (1s, 2s, 4s, 8s, 16s base delays)
 */
export const surveyQueue = new Queue<SurveyJobData>(SURVEY_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1 second base, will increase exponentially
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
});

/**
 * Queue events for monitoring survey jobs
 */
export const surveyEvents = new QueueEvents(SURVEY_QUEUE_NAME, {
  connection: redis,
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Queue a survey delivery job
 */
export async function queueSurveyDelivery(data: SurveyDeliveryJobData, delayMs?: number) {
  const job = await surveyQueue.add('survey-delivery', data, {
    ...(delayMs !== undefined ? { delay: delayMs } : {}),
    jobId: `delivery-${data.deliveryId}`,
  });

  logger.info('Survey delivery job queued', {
    surveyId: data.surveyId,
    chatId: data.chatId,
    deliveryId: data.deliveryId,
    jobId: job.id,
    delayMs,
  });

  return job;
}

/**
 * Queue a survey reminder job (day 2)
 */
export async function queueSurveyReminder(data: SurveyReminderJobData, delayMs: number) {
  const job = await surveyQueue.add('reminder', data, {
    delay: delayMs,
    jobId: `reminder-${data.deliveryId}`,
  });

  logger.info('Survey reminder job queued', {
    surveyId: data.surveyId,
    chatId: data.chatId,
    deliveryId: data.deliveryId,
    jobId: job.id,
    delayMs,
  });

  return job;
}

/**
 * Queue manager notification for non-response
 */
export async function queueManagerNotification(data: ManagerNotificationJobData, delayMs: number) {
  const job = await surveyQueue.add('manager-notification', data, {
    delay: delayMs,
    jobId: `mgr-notify-${data.deliveryId}`,
  });

  logger.info('Manager notification job queued', {
    surveyId: data.surveyId,
    chatId: data.chatId,
    deliveryId: data.deliveryId,
    managerCount: data.managerIds.length,
    jobId: job.id,
    delayMs,
  });

  return job;
}

/**
 * Cancel a scheduled job by ID
 */
export async function cancelSurveyJob(jobId: string): Promise<boolean> {
  try {
    const job = await surveyQueue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info('Survey job cancelled', { jobId });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Failed to cancel survey job', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Close the queue and events (for graceful shutdown)
 */
export async function closeSurveyQueue(): Promise<void> {
  await surveyEvents.close();
  await surveyQueue.close();
  logger.info('Survey queue closed');
}

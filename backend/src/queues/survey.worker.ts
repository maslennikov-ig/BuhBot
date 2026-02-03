/**
 * Survey Worker
 *
 * Processes survey delivery, reminder, and notification jobs.
 * Implements NFR-006: 5 retries over 1 hour with exponential backoff.
 *
 * Job Types:
 * - survey-delivery: Send initial survey to client
 * - reminder: Send day-2 reminder
 * - manager-notification: Notify manager of non-response
 *
 * @module queues/survey.worker
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { bot } from '../bot/bot.js';
import logger from '../utils/logger.js';
import { registerWorker } from './setup.js';
import {
  SURVEY_QUEUE_NAME,
  type SurveyDeliveryJobData,
  type SurveyReminderJobData,
  type ManagerNotificationJobData,
  type SurveyJobData,
  queueSurveyReminder,
  queueManagerNotification,
} from './survey.queue.js';
import {
  createSurveyRatingKeyboard,
  SURVEY_MESSAGE_TEXT,
  SURVEY_REMINDER_TEXT,
} from '../bot/keyboards/survey.keyboard.js';
import {
  queueConfig,
  getSurveyReminderDelayMs,
  getSurveyManagerNotifyDelayMs,
} from '../config/queue.config.js';
import type { DeliveryStatus } from '@prisma/client';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Delay before sending reminder (configurable, default 2 days) */
const REMINDER_DELAY_MS = getSurveyReminderDelayMs();

/** Delay before notifying manager about non-response (configurable, default 5 days after reminder = 7 days total) */
const MANAGER_NOTIFY_DELAY_MS = getSurveyManagerNotifyDelayMs();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Update survey delivery status in database
 *
 * @param deliveryId - The delivery record ID
 * @param status - New delivery status
 * @param messageId - Optional Telegram message ID
 */
async function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus,
  messageId?: bigint
): Promise<void> {
  const updateData: {
    status: DeliveryStatus;
    messageId?: bigint;
    deliveredAt?: Date;
    reminderSentAt?: Date;
    managerNotifiedAt?: Date;
  } = { status };

  // Set timestamp based on status
  switch (status) {
    case 'delivered':
      updateData.deliveredAt = new Date();
      if (messageId) {
        updateData.messageId = messageId;
      }
      break;
    case 'reminded':
      updateData.reminderSentAt = new Date();
      break;
    case 'expired':
      updateData.managerNotifiedAt = new Date();
      break;
  }

  await prisma.surveyDelivery.update({
    where: { id: deliveryId },
    data: updateData,
  });

  logger.debug('Delivery status updated', { deliveryId, status });
}

/**
 * Get delivery by ID with related data
 *
 * @param deliveryId - The delivery record ID
 * @returns Delivery record with chat and survey data
 */
async function getDeliveryById(deliveryId: string) {
  return prisma.surveyDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      chat: true,
      survey: true,
    },
  });
}

// ============================================================================
// JOB PROCESSORS
// ============================================================================

/**
 * Process survey delivery job
 *
 * Sends the initial survey message to the client chat with rating buttons.
 * On success, schedules a reminder for day 2.
 *
 * @param job - BullMQ job with survey delivery data
 */
async function processSurveyDelivery(job: Job<SurveyDeliveryJobData>): Promise<void> {
  const { surveyId, chatId, deliveryId, quarter } = job.data;

  logger.info('Processing survey delivery', {
    surveyId,
    chatId,
    deliveryId,
    quarter,
    jobId: job.id,
    attempt: job.attemptsMade + 1,
    service: 'survey-worker',
  });

  try {
    // Build inline keyboard with rating buttons
    const keyboard = createSurveyRatingKeyboard(surveyId, deliveryId);

    // Send survey message to chat
    const message = await bot.telegram.sendMessage(chatId, SURVEY_MESSAGE_TEXT, {
      parse_mode: 'Markdown',
      ...keyboard,
    });

    // Update delivery status to 'delivered'
    await updateDeliveryStatus(deliveryId, 'delivered', BigInt(message.message_id));

    // Schedule reminder for day 2
    await queueSurveyReminder({ surveyId, chatId, deliveryId }, REMINDER_DELAY_MS);

    // Increment delivered count on survey
    await prisma.feedbackSurvey.update({
      where: { id: surveyId },
      data: { deliveredCount: { increment: 1 } },
    });

    logger.info('Survey delivered successfully', {
      surveyId,
      chatId,
      deliveryId,
      messageId: message.message_id,
      service: 'survey-worker',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Survey delivery failed', {
      surveyId,
      chatId,
      deliveryId,
      error: errorMessage,
      attempt: job.attemptsMade + 1,
      maxAttempts: 5,
      service: 'survey-worker',
    });

    // If max retries reached (5 attempts per NFR-006), mark as failed
    if (job.attemptsMade + 1 >= queueConfig.surveyAttempts) {
      await prisma.surveyDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'failed',
          errorMessage,
          retryCount: job.attemptsMade + 1,
        },
      });

      logger.warn('Survey delivery permanently failed after max retries', {
        deliveryId,
        attempts: job.attemptsMade + 1,
        service: 'survey-worker',
      });
    }

    throw error; // Re-throw to trigger retry
  }
}

/**
 * Process reminder job
 *
 * Sends a reminder message on day 2 if the client hasn't responded yet.
 * Schedules manager notification for non-response after survey expires.
 *
 * @param job - BullMQ job with reminder data
 */
async function processReminder(job: Job<SurveyReminderJobData>): Promise<void> {
  const { surveyId, chatId, deliveryId } = job.data;

  logger.info('Processing survey reminder', {
    surveyId,
    chatId,
    deliveryId,
    jobId: job.id,
    service: 'survey-worker',
  });

  // Check if already responded
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery) {
    logger.warn('Delivery not found for reminder', {
      deliveryId,
      service: 'survey-worker',
    });
    return;
  }

  if (delivery.status === 'responded') {
    logger.info('Skipping reminder - already responded', {
      deliveryId,
      service: 'survey-worker',
    });
    return;
  }

  try {
    // Build inline keyboard with rating buttons
    const keyboard = createSurveyRatingKeyboard(surveyId, deliveryId);

    // Send reminder message
    await bot.telegram.sendMessage(chatId, SURVEY_REMINDER_TEXT, {
      parse_mode: 'Markdown',
      ...keyboard,
    });

    // Update delivery status to 'reminded'
    await updateDeliveryStatus(deliveryId, 'reminded');

    // Get manager IDs for potential non-response notification
    // First try chat-specific managers, then fall back to global
    let managerIds: string[] = delivery.chat.managerTelegramIds;

    if (managerIds.length === 0) {
      // Get global manager IDs from settings
      const globalSettings = await prisma.globalSettings.findUnique({
        where: { id: 'default' },
      });
      managerIds = globalSettings?.globalManagerIds ?? [];
    }

    // Schedule manager notification for non-response (after survey expiry)
    if (managerIds.length > 0) {
      await queueManagerNotification(
        { surveyId, chatId, deliveryId, managerIds },
        MANAGER_NOTIFY_DELAY_MS
      );
    }

    logger.info('Reminder sent successfully', {
      surveyId,
      chatId,
      deliveryId,
      service: 'survey-worker',
    });
  } catch (error) {
    logger.error('Reminder failed', {
      surveyId,
      chatId,
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
      service: 'survey-worker',
    });
    throw error; // Re-throw to trigger retry
  }
}

/**
 * Process manager notification job
 *
 * Notifies managers when a client hasn't responded to the survey
 * after the expiry period (7 days from initial delivery).
 *
 * @param job - BullMQ job with manager notification data
 */
async function processManagerNotification(job: Job<ManagerNotificationJobData>): Promise<void> {
  const { surveyId, chatId, deliveryId, managerIds } = job.data;

  logger.info('Processing manager notification', {
    surveyId,
    chatId,
    deliveryId,
    managerCount: managerIds.length,
    jobId: job.id,
    service: 'survey-worker',
  });

  // Check if already responded
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery) {
    logger.warn('Delivery not found for manager notification', {
      deliveryId,
      service: 'survey-worker',
    });
    return;
  }

  if (delivery.status === 'responded') {
    logger.info('Skipping manager notification - already responded', {
      deliveryId,
      service: 'survey-worker',
    });
    return;
  }

  const chatTitle = delivery.chat?.title ?? `Chat ${chatId}`;
  const quarter = delivery.survey?.quarter ?? 'Unknown';

  const notificationText =
    `*Клиент не ответил на опрос*\n\n` +
    `Чат: ${chatTitle}\n` +
    `Период: ${quarter}\n\n` +
    `Клиент не отреагировал на опрос удовлетворённости после напоминания.`;

  let successCount = 0;
  let failCount = 0;

  for (const managerId of managerIds) {
    try {
      await bot.telegram.sendMessage(managerId, notificationText, {
        parse_mode: 'Markdown',
      });
      successCount++;

      logger.debug('Manager notified', {
        managerId,
        deliveryId,
        service: 'survey-worker',
      });
    } catch (error) {
      failCount++;
      logger.error('Failed to notify manager', {
        managerId,
        deliveryId,
        error: error instanceof Error ? error.message : String(error),
        service: 'survey-worker',
      });
    }
  }

  // Mark delivery as expired
  await updateDeliveryStatus(deliveryId, 'expired');

  logger.info('Manager notification completed', {
    surveyId,
    chatId,
    deliveryId,
    successCount,
    failCount,
    service: 'survey-worker',
  });
}

// ============================================================================
// MAIN JOB PROCESSOR
// ============================================================================

/**
 * Main job processor that routes to specific handlers based on job name
 *
 * @param job - BullMQ job with survey data
 */
async function processJob(job: Job<SurveyJobData>): Promise<void> {
  switch (job.name) {
    case 'survey-delivery':
      await processSurveyDelivery(job as Job<SurveyDeliveryJobData>);
      break;
    case 'reminder':
      await processReminder(job as Job<SurveyReminderJobData>);
      break;
    case 'manager-notification':
      await processManagerNotification(job as Job<ManagerNotificationJobData>);
      break;
    default:
      logger.warn('Unknown survey job type', {
        jobName: job.name,
        jobId: job.id,
        service: 'survey-worker',
      });
  }
}

// ============================================================================
// WORKER INSTANCE
// ============================================================================

/**
 * Survey Worker Instance
 *
 * Processes jobs from the 'surveys' queue.
 * Handles survey-delivery, reminder, and manager-notification job types.
 *
 * Configuration:
 * - Concurrency: 5 (process up to 5 jobs concurrently)
 * - Rate limit: 30 jobs per second (Telegram API limit)
 */
export const surveyWorker = new Worker<SurveyJobData>(SURVEY_QUEUE_NAME, processJob, {
  connection: redis,
  concurrency: queueConfig.surveyConcurrency, // Process up to 5 jobs concurrently
  limiter: {
    max: queueConfig.surveyRateLimitMax, // Max 30 jobs
    duration: queueConfig.surveyRateLimitDuration, // Per second (Telegram rate limit ~30 msg/sec)
  },
});

// Register worker for graceful shutdown
registerWorker(surveyWorker);

// ============================================================================
// WORKER EVENT HANDLERS
// ============================================================================

surveyWorker.on('completed', (job) => {
  logger.debug('Survey worker completed job', {
    jobId: job.id,
    jobName: job.name,
    service: 'survey-worker',
  });
});

surveyWorker.on('failed', (job, error) => {
  logger.error('Survey worker job failed', {
    jobId: job?.id,
    jobName: job?.name,
    attemptsMade: job?.attemptsMade,
    error: error.message,
    service: 'survey-worker',
  });
});

surveyWorker.on('error', (error) => {
  logger.error('Survey worker error', {
    error: error.message,
    service: 'survey-worker',
  });
});

surveyWorker.on('stalled', (jobId) => {
  logger.warn('Survey worker job stalled', {
    jobId,
    service: 'survey-worker',
  });
});

export default surveyWorker;

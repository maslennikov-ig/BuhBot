/**
 * Alert Worker
 *
 * BullMQ worker that processes alert and escalation jobs.
 * Sends formatted messages to managers via Telegram.
 *
 * Job Types:
 * - send-alert: Initial breach/warning notification
 * - escalation: Escalation notification (higher urgency)
 *
 * Features:
 * - Fetches request and chat data for message formatting
 * - Builds inline keyboards for manager actions
 * - Updates alert delivery status
 * - Schedules next escalation if needed
 *
 * @module queues/alert.worker
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { bot } from '../bot/bot.js';
import { registerWorker } from './setup.js';
import type { AlertJobData, LowRatingAlertJobData } from './setup.js';
import { formatAlertMessage, type AlertMessageData } from '../services/alerts/format.service.js';
import { buildAlertKeyboard } from '../bot/keyboards/alert.keyboard.js';
import { updateDeliveryStatus } from '../services/alerts/alert.service.js';
import { scheduleNextEscalation } from '../services/alerts/escalation.service.js';
import { sendLowRatingAlert } from '../services/feedback/alert.service.js';
import logger from '../utils/logger.js';
import { queueConfig } from '../config/queue.config.js';

/**
 * Extended job data that may include formatted content
 */
interface ExtendedAlertJobData extends AlertJobData {
  formattedMessage?: string;
  chatId?: string;
  alertId?: string;
}

/**
 * Union type for all alert job types
 */
type AlertWorkerJobData = ExtendedAlertJobData | LowRatingAlertJobData;

/**
 * Process a low-rating alert job
 *
 * @param job - BullMQ job with low-rating alert data
 */
async function processLowRatingAlertJob(job: Job<LowRatingAlertJobData>): Promise<void> {
  const { feedbackId, chatId, rating, clientUsername, comment } = job.data;

  logger.info('Processing low-rating alert job', {
    jobId: job.id,
    feedbackId,
    chatId,
    rating,
    service: 'alert-worker',
  });

  try {
    await sendLowRatingAlert({
      feedbackId,
      chatId: BigInt(chatId),
      rating,
      clientUsername,
      comment,
    });

    logger.info('Low-rating alert job completed', {
      jobId: job.id,
      feedbackId,
      service: 'alert-worker',
    });
  } catch (error) {
    logger.error('Low-rating alert job failed', {
      jobId: job.id,
      feedbackId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: 'alert-worker',
    });
    throw error; // Re-throw to trigger retry
  }
}

/**
 * Process an SLA alert job
 *
 * @param job - BullMQ job with alert data
 */
async function processSlaAlertJob(job: Job<ExtendedAlertJobData>): Promise<void> {
  const { requestId, alertType, managerIds, escalationLevel } = job.data;

  logger.info('Processing SLA alert job', {
    jobId: job.id,
    jobName: job.name,
    requestId,
    alertType,
    escalationLevel,
    managerCount: managerIds.length,
    service: 'alert-worker',
  });

  try {
    // Get request with chat data for message formatting
    const request = await prisma.clientRequest.findUnique({
      where: { id: requestId },
      include: {
        chat: true,
        slaAlerts: {
          where: {
            escalationLevel,
            resolvedAction: null,
          },
          orderBy: { alertSentAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!request) {
      logger.error('Request not found for alert job', {
        requestId,
        jobId: job.id,
        service: 'alert-worker',
      });
      return;
    }

    // Check if request is already answered
    if (request.status === 'answered') {
      logger.info('Request already answered, skipping alert', {
        requestId,
        jobId: job.id,
        service: 'alert-worker',
      });
      return;
    }

    // Get or create alert ID
    const alertId = job.data.alertId ?? request.slaAlerts[0]?.id;
    const chatId = String(request.chatId);

    // Format message if not pre-formatted
    let formattedMessage = job.data.formattedMessage;

    if (!formattedMessage) {
      // Get global settings for message preview length
      const globalSettings = await prisma.globalSettings.findUnique({
        where: { id: 'default' },
      });

      const messagePreviewLength = globalSettings?.messagePreviewLength ?? 500;

      const messageData: AlertMessageData = {
        alertType,
        escalationLevel,
        clientUsername: request.clientUsername,
        messagePreview: request.messageText.slice(0, messagePreviewLength),
        // Use minutesElapsed from slaAlerts (already populated) instead of slaWorkingMinutes (NULL until timer stops)
        minutesElapsed: request.slaAlerts[0]?.minutesElapsed ?? 0,
        threshold: request.chat?.slaThresholdMinutes ?? 60,
        chatTitle: request.chat?.title ?? null,
        chatId,
        requestId,
      };

      formattedMessage = formatAlertMessage(messageData);
    }

    // Build keyboard (include invite link if available)
    const keyboard = alertId
      ? buildAlertKeyboard({
          alertId,
          chatId,
          requestId,
          inviteLink: request.chat?.inviteLink,
          chatType: request.chat?.chatType,
        })
      : undefined;

    // Send to each manager
    let successCount = 0;
    let failCount = 0;
    const deliveredMessageIds: bigint[] = [];

    for (const managerId of managerIds) {
      try {
        const message = await bot.telegram.sendMessage(
          managerId,
          formattedMessage,
          {
            parse_mode: 'HTML',
            ...(keyboard ?? {}),
          }
        );

        logger.debug('Alert sent to manager', {
          managerId,
          messageId: message.message_id,
          alertId,
          service: 'alert-worker',
        });

        successCount++;
        deliveredMessageIds.push(BigInt(message.message_id));
      } catch (error) {
        logger.error('Failed to send alert to manager', {
          managerId,
          alertId,
          error: error instanceof Error ? error.message : String(error),
          service: 'alert-worker',
        });
        failCount++;
      }
    }

    // Single atomic update at the end with final status
    if (alertId) {
      if (successCount > 0) {
        await updateDeliveryStatus(
          alertId,
          'delivered',
          deliveredMessageIds[0] // First message ID for reference
        );
      } else if (failCount === managerIds.length) {
        await updateDeliveryStatus(alertId, 'failed');
      }
    }

    // For escalation jobs, schedule next escalation if needed
    if (job.name === 'escalation' && alertId) {
      await scheduleNextEscalation(alertId, escalationLevel);
    }

    logger.info('Alert job completed', {
      jobId: job.id,
      requestId,
      alertType,
      escalationLevel,
      successCount,
      failCount,
      service: 'alert-worker',
    });
  } catch (error) {
    logger.error('Alert job processing failed', {
      jobId: job.id,
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: 'alert-worker',
    });
    throw error; // Re-throw to trigger retry
  }
}

/**
 * Route alert jobs to the appropriate handler based on job name
 *
 * @param job - BullMQ job with alert data
 */
async function processAlertJob(job: Job<AlertWorkerJobData>): Promise<void> {
  if (job.name === 'low-rating-alert') {
    return processLowRatingAlertJob(job as Job<LowRatingAlertJobData>);
  }

  // Default to SLA alert processing for send-alert and escalation jobs
  return processSlaAlertJob(job as Job<ExtendedAlertJobData>);
}

/**
 * Alert Worker Instance
 *
 * Processes jobs from the 'alerts' queue.
 * Handles 'send-alert', 'escalation', and 'low-rating-alert' job types.
 */
export const alertWorker = new Worker<AlertWorkerJobData>(
  'alerts',
  processAlertJob,
  {
    connection: redis,
    concurrency: queueConfig.alertConcurrency, // Process up to 3 alerts concurrently
    limiter: {
      max: queueConfig.alertRateLimitMax, // Max 30 jobs
      duration: queueConfig.alertRateLimitDuration, // Per second (Telegram rate limit ~30 msg/sec)
    },
  }
);

// Register worker for graceful shutdown
registerWorker(alertWorker);

// Worker event handlers
alertWorker.on('completed', (job) => {
  logger.debug('Alert worker completed job', {
    jobId: job.id,
    jobName: job.name,
    service: 'alert-worker',
  });
});

alertWorker.on('failed', (job, error) => {
  logger.error('Alert worker job failed', {
    jobId: job?.id,
    jobName: job?.name,
    attemptsMade: job?.attemptsMade,
    error: error.message,
    service: 'alert-worker',
  });
});

alertWorker.on('error', (error) => {
  logger.error('Alert worker error', {
    error: error.message,
    service: 'alert-worker',
  });
});

alertWorker.on('stalled', (jobId) => {
  logger.warn('Alert worker job stalled', {
    jobId,
    service: 'alert-worker',
  });
});

export default alertWorker;

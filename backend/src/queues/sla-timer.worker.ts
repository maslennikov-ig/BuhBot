/**
 * SLA Timer Worker
 *
 * BullMQ worker that processes SLA breach check jobs.
 * When a job fires (delayed by SLA threshold), it checks if the request
 * is still pending and creates an SLA alert if needed.
 *
 * Job Processing:
 * 1. Fetch the client request by ID
 * 2. Check if request is still pending (not answered)
 * 3. If pending: mark as breached, create SLA alert
 * 4. Schedule escalation if needed
 *
 * @module queues/sla-timer.worker
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import logger from '../utils/logger.js';
import { QUEUE_NAMES, registerWorker, queueAlert, type SlaTimerJobData } from './setup.js';
import { queueConfig } from '../config/queue.config.js';
import { bot } from '../bot/bot.js';
import { formatBreachChatNotification } from '../services/alerts/format.service.js';

/**
 * Process SLA breach check job
 *
 * Called when the SLA threshold timer fires.
 * Checks if the request is still pending and creates breach alert if so.
 *
 * @param job - BullMQ job with SLA timer data
 */
async function processSlaTimer(job: Job<SlaTimerJobData>): Promise<void> {
  const { requestId, chatId, threshold } = job.data;

  logger.info('Processing SLA timer job', {
    jobId: job.id,
    requestId,
    chatId,
    threshold,
    service: 'sla-timer-worker',
  });

  try {
    // 1. Fetch the client request
    const request = await prisma.clientRequest.findUnique({
      where: { id: requestId },
      include: {
        chat: true,
      },
    });

    if (!request) {
      logger.warn('Request not found for SLA check', {
        requestId,
        jobId: job.id,
        service: 'sla-timer-worker',
      });
      return;
    }

    // 2. Check if request is in a terminal state (gh-125)
    const TERMINAL_STATES = ['answered', 'closed'];
    if (TERMINAL_STATES.includes(request.status)) {
      logger.info('Request in terminal state, SLA check skipped', {
        requestId,
        jobId: job.id,
        status: request.status,
        service: 'sla-timer-worker',
      });
      return;
    }

    // 3. Mark request as breached and create alert atomically
    // Using Prisma transaction to ensure data consistency:
    // - If crash between steps, both operations roll back
    // - Either both succeed or both fail together
    const alert = await prisma.$transaction(async (tx) => {
      // Step 1: Update request status (using tx, not prisma)
      await tx.clientRequest.update({
        where: { id: requestId },
        data: {
          slaBreached: true,
          status: 'escalated',
        },
      });

      logger.warn('SLA breach detected', {
        requestId,
        chatId,
        threshold,
        service: 'sla-timer-worker',
      });

      // Step 2: Create SLA alert record (using tx, not prisma)
      const alert = await tx.slaAlert.create({
        data: {
          requestId,
          alertType: 'breach',
          minutesElapsed: threshold,
          deliveryStatus: 'pending',
          escalationLevel: 1,
        },
      });

      logger.info('SLA alert created', {
        alertId: alert.id,
        requestId,
        alertType: 'breach',
        service: 'sla-timer-worker',
      });

      return alert;
    });

    /**
     * @test-only
     * SECURITY WARNING: This sends SLA breach details into the CLIENT-FACING chat.
     * Disabled by default (notifyInChatOnBreach=false) to prevent leaking internal
     * operational alerts to clients. Only enable for test/demo chats, NEVER for production.
     * Production alerts go to managers via private messages (step 7 below).
     */
    // 5. Send breach notification to group chat (if enabled — TEST ONLY)
    if (request.chat?.notifyInChatOnBreach) {
      try {
        const chatNotificationMessage = formatBreachChatNotification({
          clientUsername: request.clientUsername,
          messagePreview: request.messageText,
          thresholdMinutes: threshold,
          minutesElapsed: threshold,
        });

        await bot.telegram.sendMessage(String(chatId), chatNotificationMessage, {
          parse_mode: 'HTML',
        });

        logger.info('Breach notification sent to group chat', {
          requestId,
          chatId,
          service: 'sla-timer-worker',
        });
      } catch (chatNotifyError) {
        // Don't fail the job if chat notification fails (bot might not have permissions)
        logger.warn('Failed to send breach notification to group chat', {
          requestId,
          chatId,
          error:
            chatNotifyError instanceof Error ? chatNotifyError.message : String(chatNotifyError),
          service: 'sla-timer-worker',
        });
      }
    }

    // 6. Get manager IDs for alert delivery
    // Precedence: managerTelegramIds > accountantTelegramIds > globalManagerIds
    const managerIds = request.chat?.managerTelegramIds ?? [];

    let alertManagerIds = managerIds;

    // If no chat-specific managers, check accountant Telegram IDs
    if (alertManagerIds.length === 0) {
      const accountantIds = request.chat?.accountantTelegramIds ?? [];
      if (accountantIds.length > 0) {
        alertManagerIds = accountantIds.map((id) => id.toString());
      }
    }

    // If still no managers, get global managers
    if (alertManagerIds.length === 0) {
      const globalSettings = await prisma.globalSettings.findUnique({
        where: { id: 'default' },
      });
      alertManagerIds = globalSettings?.globalManagerIds ?? [];
    }

    // 7. Queue alert for delivery
    if (alertManagerIds.length > 0) {
      await queueAlert({
        requestId,
        alertType: 'breach',
        managerIds: alertManagerIds,
        escalationLevel: 1,
      });

      logger.info('SLA breach alert queued', {
        requestId,
        alertId: alert.id,
        managerCount: alertManagerIds.length,
        service: 'sla-timer-worker',
      });
    } else {
      // CRITICAL: No managers to receive alert - this is a configuration error
      logger.error(
        'CRITICAL: No managers configured for SLA alerts - notification cannot be delivered',
        {
          requestId,
          chatId,
          alertId: alert.id,
          threshold,
          service: 'sla-timer-worker',
        }
      );

      // Mark alert as failed since no one can receive it
      await prisma.slaAlert.update({
        where: { id: alert.id },
        data: { deliveryStatus: 'failed' },
      });
    }
  } catch (error) {
    logger.error('Error processing SLA timer job', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId,
      jobId: job.id,
      service: 'sla-timer-worker',
    });
    throw error; // Rethrow to trigger retry
  }
}

/**
 * SLA Timer Worker instance
 *
 * Processes breach check jobs from the sla-timers queue.
 * Limited concurrency to prevent overwhelming the database.
 */
export const slaTimerWorker = new Worker<SlaTimerJobData>(QUEUE_NAMES.SLA_TIMERS, processSlaTimer, {
  connection: redis,
  concurrency: queueConfig.slaConcurrency,
  limiter: {
    max: queueConfig.slaRateLimitMax,
    duration: queueConfig.slaRateLimitDuration, // Max 10 jobs per second
  },
});

// Event handlers for monitoring
slaTimerWorker.on('completed', (job) => {
  logger.debug('SLA timer job completed', {
    jobId: job.id,
    requestId: job.data.requestId,
    service: 'sla-timer-worker',
  });
});

slaTimerWorker.on('failed', (job, error) => {
  logger.error('SLA timer job failed', {
    jobId: job?.id,
    requestId: job?.data.requestId,
    error: error.message,
    service: 'sla-timer-worker',
  });
});

slaTimerWorker.on('error', (error) => {
  logger.error('SLA timer worker error', {
    error: error.message,
    service: 'sla-timer-worker',
  });
});

// Register worker for graceful shutdown
registerWorker(slaTimerWorker);

logger.info('SLA timer worker initialized', {
  queue: QUEUE_NAMES.SLA_TIMERS,
  concurrency: queueConfig.slaConcurrency,
  service: 'sla-timer-worker',
});

export default slaTimerWorker;

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
import {
  QUEUE_NAMES,
  registerWorker,
  queueAlert,
  type SlaTimerJobData,
} from './setup.js';

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

    // 2. Check if request is still pending (not answered)
    if (request.status === 'answered') {
      logger.info('Request already answered, SLA check skipped', {
        requestId,
        jobId: job.id,
        status: request.status,
        service: 'sla-timer-worker',
      });
      return;
    }

    // 3. Mark request as breached
    await prisma.clientRequest.update({
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

    // 4. Create SLA alert record
    const alert = await prisma.slaAlert.create({
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

    // 5. Get manager IDs for alert delivery
    const managerIds = request.chat?.managerTelegramIds ?? [];

    // If no chat-specific managers, get global managers
    let alertManagerIds = managerIds;
    if (alertManagerIds.length === 0) {
      const globalSettings = await prisma.globalSettings.findUnique({
        where: { id: 'default' },
      });
      alertManagerIds = globalSettings?.globalManagerIds ?? [];
    }

    // 6. Queue alert for delivery
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
      logger.warn('No managers configured for SLA alerts', {
        requestId,
        chatId,
        service: 'sla-timer-worker',
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
export const slaTimerWorker = new Worker<SlaTimerJobData>(
  QUEUE_NAMES.SLA_TIMERS,
  processSlaTimer,
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
  }
);

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
  concurrency: 5,
  service: 'sla-timer-worker',
});

export default slaTimerWorker;

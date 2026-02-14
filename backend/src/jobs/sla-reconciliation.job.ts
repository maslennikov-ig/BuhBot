/**
 * SLA Reconciliation Job
 *
 * BullMQ repeatable job that recovers lost SLA timers every 5 minutes.
 * Calls recoverPendingSlaTimers() which finds pending requests without
 * active BullMQ jobs and reschedules them or marks as breached.
 *
 * This ensures SLA timers are not permanently lost after:
 * - Server restarts
 * - Redis failovers
 * - Worker crashes
 *
 * @module jobs/sla-reconciliation.job
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import logger from '../utils/logger.js';
import { recoverPendingSlaTimers, RecoveryResult } from '../services/sla/timer.service.js';
import {
  slaReconciliationQueue,
  QUEUE_NAMES,
  registerWorker,
  type SlaReconciliationJobData,
} from '../queues/setup.js';
import { queueConfig } from '../config/queue.config.js';

const SERVICE_NAME = 'sla-reconciliation-job';

/**
 * Process SLA reconciliation job
 */
async function processSlaReconciliation(
  job: Job<SlaReconciliationJobData>
): Promise<RecoveryResult> {
  const startTime = Date.now();

  logger.debug('Starting SLA reconciliation', {
    jobId: job.id,
    triggeredBy: job.data.triggeredBy,
    service: SERVICE_NAME,
  });

  const result = await recoverPendingSlaTimers();

  const durationMs = Date.now() - startTime;

  if (result.totalPending > 0) {
    logger.info('SLA reconciliation completed', {
      ...result,
      durationMs,
      jobId: job.id,
      service: SERVICE_NAME,
    });
  } else {
    logger.debug('SLA reconciliation completed (no pending timers)', {
      durationMs,
      jobId: job.id,
      service: SERVICE_NAME,
    });
  }

  return result;
}

/** Worker instance (created lazily) */
let reconciliationWorker: Worker<SlaReconciliationJobData, RecoveryResult> | null = null;

/**
 * Start the SLA reconciliation worker
 */
export function startSlaReconciliationWorker(): Worker<
  SlaReconciliationJobData,
  RecoveryResult
> {
  if (reconciliationWorker) {
    logger.warn('SLA reconciliation worker already running', { service: SERVICE_NAME });
    return reconciliationWorker;
  }

  reconciliationWorker = new Worker<SlaReconciliationJobData, RecoveryResult>(
    QUEUE_NAMES.SLA_RECONCILIATION,
    processSlaReconciliation,
    {
      connection: redis,
      concurrency: 1,
      limiter: {
        max: 1,
        duration: 60000, // Max 1 job per minute
      },
    }
  );

  reconciliationWorker.on('failed', (job, error) => {
    logger.error('SLA reconciliation job failed', {
      jobId: job?.id,
      error: error.message,
      stack: error.stack,
      service: SERVICE_NAME,
    });
  });

  reconciliationWorker.on('error', (error) => {
    logger.error('SLA reconciliation worker error', {
      error: error.message,
      stack: error.stack,
      service: SERVICE_NAME,
    });
  });

  registerWorker(reconciliationWorker);

  logger.info('SLA reconciliation worker started', {
    queue: QUEUE_NAMES.SLA_RECONCILIATION,
    service: SERVICE_NAME,
  });

  return reconciliationWorker;
}

/**
 * Schedule the periodic SLA reconciliation job
 *
 * Default: every 5 minutes (configurable via QUEUE_SLA_RECONCILIATION_SCHEDULE)
 */
export async function scheduleSlaReconciliationJob(): Promise<void> {
  const repeatPattern = queueConfig.slaReconciliationSchedule;

  try {
    // Remove existing repeatable job to avoid duplicates
    await slaReconciliationQueue.removeRepeatable('sla-reconciliation', {
      pattern: repeatPattern,
    });

    await slaReconciliationQueue.add(
      'sla-reconciliation',
      { triggeredBy: 'scheduler' },
      {
        repeat: {
          pattern: repeatPattern,
        },
        jobId: 'sla-reconciliation-periodic',
      }
    );

    logger.info('SLA reconciliation job scheduled', {
      pattern: repeatPattern,
      service: SERVICE_NAME,
    });
  } catch (error) {
    logger.error('Failed to schedule SLA reconciliation job', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: SERVICE_NAME,
    });
    throw error;
  }
}

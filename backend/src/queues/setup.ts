/**
 * BullMQ Queue Setup
 *
 * Initializes and configures BullMQ queues for SLA monitoring.
 * Provides centralized queue management with graceful shutdown support.
 *
 * Queues:
 * - sla-timers: Delayed jobs for SLA breach detection
 * - alerts: Alert and escalation message delivery
 * - data-retention: Daily cleanup of old data
 *
 * @module queues/setup
 */

import { Queue, QueueEvents, Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import logger from '../utils/logger.js';
import { redisQueueLength } from '../utils/metrics.js';

// ============================================================================
// JOB DATA TYPES
// ============================================================================

/**
 * SLA Timer job data
 * Used for scheduling breach detection checks
 */
export interface SlaTimerJobData {
  /** Unique identifier for the client request */
  requestId: string;
  /** Telegram chat ID where the request originated */
  chatId: string;
  /** SLA threshold in minutes */
  threshold: number;
}

/**
 * Alert job data
 * Used for sending alerts and escalations
 */
export interface AlertJobData {
  /** Unique identifier for the client request */
  requestId: string;
  /** Type of alert to send */
  alertType: 'warning' | 'breach';
  /** List of manager Telegram user IDs to notify */
  managerIds: string[];
  /** Current escalation level (0 = initial, increases with each escalation) */
  escalationLevel: number;
}

/**
 * Data retention job data
 * Used for scheduled cleanup of old data
 */
export interface DataRetentionJobData {
  /** How the job was triggered */
  triggeredBy: 'scheduler' | 'manual';
}

// ============================================================================
// QUEUE CONFIGURATION
// ============================================================================

/**
 * Default job options applied to all queues
 * - 3 retry attempts with exponential backoff
 * - Keeps last 100 completed jobs
 * - Keeps last 1000 failed jobs
 */
export const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: 100,
  removeOnFail: 1000,
};

/**
 * Queue names as constants for type safety
 */
export const QUEUE_NAMES = {
  SLA_TIMERS: 'sla-timers',
  ALERTS: 'alerts',
  DATA_RETENTION: 'data-retention',
  SURVEYS: 'surveys',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ============================================================================
// QUEUE INSTANCES
// ============================================================================

/**
 * SLA Timer Queue
 *
 * Handles delayed jobs for SLA breach detection.
 * Jobs are scheduled with a delay equal to the SLA threshold.
 * When the job executes, it checks if the request is still unresolved.
 *
 * @example
 * ```typescript
 * await slaTimerQueue.add(
 *   'check-breach',
 *   { requestId: 'req-123', chatId: 'chat-456', threshold: 60 },
 *   { delay: 60 * 60 * 1000, jobId: 'sla-req-123' }
 * );
 * ```
 */
export const slaTimerQueue = new Queue<SlaTimerJobData>(QUEUE_NAMES.SLA_TIMERS, {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    // SLA timer jobs should not retry - if missed, create a new one
    attempts: 1,
    removeOnComplete: 50,
  },
});

/**
 * Alert Queue
 *
 * Handles sending alerts to managers and escalation notifications.
 * Supports both immediate alerts and delayed escalation jobs.
 *
 * @example
 * ```typescript
 * await alertQueue.add('send-alert', {
 *   requestId: 'req-123',
 *   alertType: 'breach',
 *   managerIds: ['mgr-1', 'mgr-2'],
 *   escalationLevel: 0,
 * });
 * ```
 */
export const alertQueue = new Queue<AlertJobData>(QUEUE_NAMES.ALERTS, {
  connection: redis,
  defaultJobOptions,
});

/**
 * Data Retention Queue
 *
 * Handles scheduled cleanup of old data based on retention policy.
 * Typically runs once daily via cron job.
 *
 * @example
 * ```typescript
 * await dataRetentionQueue.add(
 *   'cleanup',
 *   { retentionYears: 5 },
 *   { repeat: { pattern: '0 3 * * *' } } // Run daily at 3 AM
 * );
 * ```
 */
export const dataRetentionQueue = new Queue<DataRetentionJobData>(
  QUEUE_NAMES.DATA_RETENTION,
  {
    connection: redis,
    defaultJobOptions: {
      ...defaultJobOptions,
      // Data retention jobs can take longer
      attempts: 2,
      backoff: {
        type: 'exponential' as const,
        delay: 5000,
      },
    },
  }
);

// ============================================================================
// QUEUE EVENTS
// ============================================================================

/**
 * Queue events for monitoring SLA timer jobs
 */
export const slaTimerEvents = new QueueEvents(QUEUE_NAMES.SLA_TIMERS, {
  connection: redis,
});

/**
 * Queue events for monitoring alert jobs
 */
export const alertEvents = new QueueEvents(QUEUE_NAMES.ALERTS, {
  connection: redis,
});

/**
 * Queue events for monitoring data retention jobs
 */
export const dataRetentionEvents = new QueueEvents(QUEUE_NAMES.DATA_RETENTION, {
  connection: redis,
});

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Setup event handlers for queue monitoring
 */
function setupEventHandlers(): void {
  // SLA Timer events
  slaTimerEvents.on('completed', ({ jobId }) => {
    logger.debug('SLA timer job completed', { jobId, queue: QUEUE_NAMES.SLA_TIMERS });
  });

  slaTimerEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error('SLA timer job failed', {
      jobId,
      queue: QUEUE_NAMES.SLA_TIMERS,
      reason: failedReason,
    });
  });

  slaTimerEvents.on('delayed', ({ jobId, delay }) => {
    logger.debug('SLA timer job delayed', {
      jobId,
      queue: QUEUE_NAMES.SLA_TIMERS,
      delay,
    });
  });

  // Alert events
  alertEvents.on('completed', ({ jobId }) => {
    logger.debug('Alert job completed', { jobId, queue: QUEUE_NAMES.ALERTS });
  });

  alertEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error('Alert job failed', {
      jobId,
      queue: QUEUE_NAMES.ALERTS,
      reason: failedReason,
    });
  });

  // Data retention events
  dataRetentionEvents.on('completed', ({ jobId }) => {
    logger.info('Data retention job completed', {
      jobId,
      queue: QUEUE_NAMES.DATA_RETENTION,
    });
  });

  dataRetentionEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error('Data retention job failed', {
      jobId,
      queue: QUEUE_NAMES.DATA_RETENTION,
      reason: failedReason,
    });
  });
}

// ============================================================================
// METRICS COLLECTION
// ============================================================================

/**
 * Update queue length metrics for Prometheus
 * Should be called periodically (e.g., every 30 seconds)
 */
export async function updateQueueMetrics(): Promise<void> {
  try {
    const [slaTimerCount, alertCount, dataRetentionCount] = await Promise.all([
      slaTimerQueue.getJobCounts('waiting', 'delayed', 'active'),
      alertQueue.getJobCounts('waiting', 'delayed', 'active'),
      dataRetentionQueue.getJobCounts('waiting', 'delayed', 'active'),
    ]);

    redisQueueLength.set(
      { queue_name: QUEUE_NAMES.SLA_TIMERS },
      (slaTimerCount['waiting'] ?? 0) +
        (slaTimerCount['delayed'] ?? 0) +
        (slaTimerCount['active'] ?? 0)
    );
    redisQueueLength.set(
      { queue_name: QUEUE_NAMES.ALERTS },
      (alertCount['waiting'] ?? 0) +
        (alertCount['delayed'] ?? 0) +
        (alertCount['active'] ?? 0)
    );
    redisQueueLength.set(
      { queue_name: QUEUE_NAMES.DATA_RETENTION },
      (dataRetentionCount['waiting'] ?? 0) +
        (dataRetentionCount['delayed'] ?? 0) +
        (dataRetentionCount['active'] ?? 0)
    );
  } catch (error) {
    logger.error('Failed to update queue metrics', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// SETUP AND SHUTDOWN
// ============================================================================

/** Track all registered workers for graceful shutdown */
const registeredWorkers: Worker[] = [];

/**
 * Register a worker for graceful shutdown
 * Workers registered here will be closed when closeQueues() is called
 *
 * @param worker - BullMQ Worker instance to register
 */
export function registerWorker(worker: Worker): void {
  registeredWorkers.push(worker);
  logger.debug('Worker registered for graceful shutdown', {
    workerName: worker.name,
    totalWorkers: registeredWorkers.length,
  });
}

/**
 * Initialize all queues and event handlers
 * Call this during application startup
 */
export async function setupQueues(): Promise<void> {
  logger.info('Setting up BullMQ queues...', {
    queues: Object.values(QUEUE_NAMES),
  });

  // Setup event handlers
  setupEventHandlers();

  // Verify queue connections by checking their status
  try {
    await Promise.all([
      slaTimerQueue.getJobCounts(),
      alertQueue.getJobCounts(),
      dataRetentionQueue.getJobCounts(),
    ]);

    logger.info('BullMQ queues initialized successfully', {
      queues: Object.values(QUEUE_NAMES),
    });
  } catch (error) {
    logger.error('Failed to initialize BullMQ queues', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Gracefully close all queues, workers, and event listeners
 * Call this during application shutdown
 *
 * @param timeout - Maximum time to wait for workers to finish (default: 10000ms)
 */
export async function closeQueues(timeout: number = 10000): Promise<void> {
  logger.info('Closing BullMQ queues and workers...', {
    workerCount: registeredWorkers.length,
    timeout,
  });

  try {
    // Close all registered workers first (allows them to finish current jobs)
    if (registeredWorkers.length > 0) {
      logger.info('Closing registered workers...');
      await Promise.race([
        Promise.all(registeredWorkers.map((worker) => worker.close())),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Worker close timeout')), timeout)
        ),
      ]);
      logger.info('All workers closed');
    }

    // Close queue event listeners
    await Promise.all([
      slaTimerEvents.close(),
      alertEvents.close(),
      dataRetentionEvents.close(),
    ]);
    logger.debug('Queue event listeners closed');

    // Close queues
    await Promise.all([
      slaTimerQueue.close(),
      alertQueue.close(),
      dataRetentionQueue.close(),
    ]);
    logger.info('All BullMQ queues closed');
  } catch (error) {
    logger.error('Error closing BullMQ queues', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't re-throw - we want shutdown to continue even if queue close fails
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Schedule an SLA breach check job
 *
 * @param requestId - Unique identifier for the client request
 * @param chatId - Telegram chat ID
 * @param thresholdMinutes - SLA threshold in minutes
 * @param delayMs - Delay in milliseconds (optional, calculated from threshold if not provided)
 * @returns The created job
 */
export async function scheduleSlaCheck(
  requestId: string,
  chatId: string,
  thresholdMinutes: number,
  delayMs?: number
) {
  const actualDelayMs = delayMs ?? thresholdMinutes * 60 * 1000;
  const jobId = `sla-${requestId}`;

  const job = await slaTimerQueue.add(
    'check-breach',
    {
      requestId,
      chatId,
      threshold: thresholdMinutes,
    },
    {
      delay: actualDelayMs,
      jobId, // Enables job removal by ID
    }
  );

  logger.info('SLA breach check scheduled', {
    requestId,
    chatId,
    thresholdMinutes,
    delayMs: actualDelayMs,
    jobId: job.id,
  });

  return job;
}

/**
 * Cancel a scheduled SLA breach check
 *
 * @param requestId - Unique identifier for the client request
 * @returns true if job was found and removed, false otherwise
 */
export async function cancelSlaCheck(requestId: string): Promise<boolean> {
  const jobId = `sla-${requestId}`;

  try {
    const job = await slaTimerQueue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info('SLA breach check cancelled', { requestId, jobId });
      return true;
    }
    logger.debug('SLA breach check job not found', { requestId, jobId });
    return false;
  } catch (error) {
    logger.error('Failed to cancel SLA breach check', {
      requestId,
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Queue an alert for immediate processing
 *
 * @param data - Alert job data
 * @returns The created job
 */
export async function queueAlert(data: AlertJobData) {
  const job = await alertQueue.add('send-alert', data);

  logger.info('Alert queued', {
    requestId: data.requestId,
    alertType: data.alertType,
    escalationLevel: data.escalationLevel,
    jobId: job.id,
  });

  return job;
}

/**
 * Schedule an escalation alert
 *
 * @param data - Alert job data
 * @param delayMinutes - Delay before sending escalation
 * @returns The created job
 */
export async function scheduleEscalation(data: AlertJobData, delayMinutes: number) {
  const delayMs = delayMinutes * 60 * 1000;
  const jobId = `escalation-${data.requestId}-${data.escalationLevel}`;

  const job = await alertQueue.add('escalation', data, {
    delay: delayMs,
    jobId,
  });

  logger.info('Escalation scheduled', {
    requestId: data.requestId,
    escalationLevel: data.escalationLevel,
    delayMinutes,
    jobId: job.id,
  });

  return job;
}

/**
 * Cancel a scheduled escalation
 *
 * @param requestId - Unique identifier for the client request
 * @param escalationLevel - Level of escalation to cancel
 * @returns true if job was found and removed, false otherwise
 */
export async function cancelEscalation(
  requestId: string,
  escalationLevel: number
): Promise<boolean> {
  const jobId = `escalation-${requestId}-${escalationLevel}`;

  try {
    const job = await alertQueue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info('Escalation cancelled', { requestId, escalationLevel, jobId });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Failed to cancel escalation', {
      requestId,
      escalationLevel,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Schedule the daily data retention cleanup job
 *
 * Runs daily at midnight UTC (3:00 AM Moscow time).
 * The job reads retention years from GlobalSettings.
 *
 * @returns The created job
 */
export async function scheduleDataRetention() {
  const repeatPattern = '0 0 * * *'; // Daily at midnight UTC (3 AM Moscow)

  // Remove any existing repeatable job first
  await dataRetentionQueue.removeRepeatable('cleanup', {
    pattern: repeatPattern,
  });

  const job = await dataRetentionQueue.add(
    'cleanup',
    { triggeredBy: 'scheduler' },
    {
      repeat: {
        pattern: repeatPattern,
      },
      jobId: 'data-retention-daily',
    }
  );

  logger.info('Data retention job scheduled', {
    schedule: '0 0 * * * (daily at 00:00 UTC / 03:00 Moscow)',
    jobId: job.id,
  });

  return job;
}

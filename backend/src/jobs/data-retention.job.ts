/**
 * Data Retention Job
 *
 * BullMQ job that deletes records older than the configured retention period.
 * Runs daily at 3:00 AM Moscow time (midnight UTC) via repeatable job.
 *
 * Data cleaned:
 * - client_requests: Main client request data
 * - sla_alerts: Associated SLA alerts (via cascade or explicit delete)
 * - feedback_responses: Client satisfaction ratings
 * - classification_cache: Expired AI classification cache entries
 *
 * Features:
 * - Reads retention years from GlobalSettings (defaults to 3)
 * - Deletes in batches of 1000 to avoid timeouts
 * - Comprehensive logging of deleted counts
 * - Graceful error handling (logs and continues)
 *
 * @module jobs/data-retention.job
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import logger from '../utils/logger.js';
import {
  dataRetentionQueue,
  QUEUE_NAMES,
  registerWorker,
  type DataRetentionJobData,
} from '../queues/setup.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Re-export DataRetentionJobData from setup.ts for convenience
export type { DataRetentionJobData } from '../queues/setup.js';

/**
 * Result of data retention cleanup
 */
export interface DataRetentionResult {
  /** Number of client requests deleted */
  deletedRequests: number;
  /** Number of SLA alerts deleted */
  deletedAlerts: number;
  /** Number of feedback responses deleted */
  deletedFeedback: number;
  /** Number of cache entries deleted */
  deletedCache: number;
  /** Duration of cleanup in milliseconds */
  durationMs: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Batch size for delete operations */
const BATCH_SIZE = 1000;

/** Default retention period in years if not configured */
const DEFAULT_RETENTION_YEARS = 3;

/** Service identifier for logging */
const SERVICE_NAME = 'data-retention-job';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get retention years from GlobalSettings
 *
 * @returns Number of years to retain data
 */
async function getRetentionYears(): Promise<number> {
  try {
    const settings = await prisma.globalSettings.findUnique({
      where: { id: 'default' },
      select: { dataRetentionYears: true },
    });

    return settings?.dataRetentionYears ?? DEFAULT_RETENTION_YEARS;
  } catch (error) {
    logger.warn('Failed to fetch GlobalSettings, using default retention', {
      error: error instanceof Error ? error.message : String(error),
      defaultYears: DEFAULT_RETENTION_YEARS,
      service: SERVICE_NAME,
    });
    return DEFAULT_RETENTION_YEARS;
  }
}

/**
 * Calculate the cutoff date for data deletion
 *
 * @param retentionYears - Number of years to retain data
 * @returns Date before which data should be deleted
 */
function calculateCutoffDate(retentionYears: number): Date {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - retentionYears);
  return cutoff;
}

/**
 * Delete client requests older than cutoff date in batches
 *
 * @param cutoffDate - Date before which to delete records
 * @returns Total number of deleted records
 */
async function deleteOldClientRequests(cutoffDate: Date): Promise<number> {
  let totalDeleted = 0;
  let batchDeleted: number;

  do {
    // Find IDs of records to delete (batch approach for large datasets)
    const recordsToDelete = await prisma.clientRequest.findMany({
      where: {
        receivedAt: { lt: cutoffDate },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (recordsToDelete.length === 0) {
      break;
    }

    const idsToDelete = recordsToDelete.map((r: { id: string }) => r.id);

    // Delete SLA alerts first (if not cascaded)
    await prisma.slaAlert.deleteMany({
      where: { requestId: { in: idsToDelete } },
    });

    // Delete feedback responses for these requests
    await prisma.feedbackResponse.deleteMany({
      where: { requestId: { in: idsToDelete } },
    });

    // Delete the client requests
    const result = await prisma.clientRequest.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    batchDeleted = result.count;
    totalDeleted += batchDeleted;

    logger.debug('Deleted batch of old client requests', {
      batchSize: batchDeleted,
      totalDeleted,
      service: SERVICE_NAME,
    });
  } while (batchDeleted === BATCH_SIZE);

  return totalDeleted;
}

/**
 * Delete orphaned SLA alerts older than cutoff date
 * (In case any alerts exist without associated requests)
 *
 * @param cutoffDate - Date before which to delete records
 * @returns Total number of deleted records
 */
async function deleteOldSlaAlerts(cutoffDate: Date): Promise<number> {
  let totalDeleted = 0;
  let batchDeleted: number;

  do {
    const result = await prisma.slaAlert.deleteMany({
      where: {
        alertSentAt: { lt: cutoffDate },
      },
      // Note: deleteMany doesn't support 'take', so we rely on the query being efficient
    });

    batchDeleted = result.count;
    totalDeleted += batchDeleted;

    // If we deleted less than a reasonable amount, we're done
    // (deleteMany processes all matching records at once)
    break;
  } while (batchDeleted > 0);

  return totalDeleted;
}

/**
 * Delete old feedback responses not linked to requests
 *
 * @param cutoffDate - Date before which to delete records
 * @returns Total number of deleted records
 */
async function deleteOldFeedbackResponses(cutoffDate: Date): Promise<number> {
  const result = await prisma.feedbackResponse.deleteMany({
    where: {
      submittedAt: { lt: cutoffDate },
    },
  });

  return result.count;
}

/**
 * Delete expired classification cache entries
 * Uses expiresAt field rather than retention cutoff
 *
 * @returns Total number of deleted records
 */
async function deleteExpiredCacheEntries(): Promise<number> {
  const now = new Date();

  const result = await prisma.classificationCache.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  return result.count;
}

// ============================================================================
// JOB PROCESSOR
// ============================================================================

/**
 * Process data retention cleanup job
 *
 * @param job - BullMQ job with data retention configuration
 * @returns Cleanup result with counts and duration
 */
async function processDataRetention(job: Job<DataRetentionJobData>): Promise<DataRetentionResult> {
  const startTime = Date.now();
  const { triggeredBy } = job.data;

  logger.info('Starting data retention cleanup', {
    jobId: job.id,
    triggeredBy,
    service: SERVICE_NAME,
  });

  // Initialize result
  const result: DataRetentionResult = {
    deletedRequests: 0,
    deletedAlerts: 0,
    deletedFeedback: 0,
    deletedCache: 0,
    durationMs: 0,
  };

  try {
    // Get retention configuration
    const retentionYears = await getRetentionYears();
    const cutoffDate = calculateCutoffDate(retentionYears);

    logger.info('Data retention configuration', {
      retentionYears,
      cutoffDate: cutoffDate.toISOString(),
      service: SERVICE_NAME,
    });

    // 1. Delete old client requests (and associated alerts/feedback via cascade)
    try {
      result.deletedRequests = await deleteOldClientRequests(cutoffDate);
      logger.info('Deleted old client requests', {
        count: result.deletedRequests,
        service: SERVICE_NAME,
      });
    } catch (error) {
      logger.error('Error deleting client requests', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        service: SERVICE_NAME,
      });
    }

    // 2. Delete orphaned SLA alerts (safety cleanup)
    try {
      result.deletedAlerts = await deleteOldSlaAlerts(cutoffDate);
      logger.info('Deleted orphaned SLA alerts', {
        count: result.deletedAlerts,
        service: SERVICE_NAME,
      });
    } catch (error) {
      logger.error('Error deleting SLA alerts', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        service: SERVICE_NAME,
      });
    }

    // 3. Delete old feedback responses (safety cleanup for unlinked records)
    try {
      result.deletedFeedback = await deleteOldFeedbackResponses(cutoffDate);
      logger.info('Deleted old feedback responses', {
        count: result.deletedFeedback,
        service: SERVICE_NAME,
      });
    } catch (error) {
      logger.error('Error deleting feedback responses', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        service: SERVICE_NAME,
      });
    }

    // 4. Delete expired classification cache entries
    try {
      result.deletedCache = await deleteExpiredCacheEntries();
      logger.info('Deleted expired cache entries', {
        count: result.deletedCache,
        service: SERVICE_NAME,
      });
    } catch (error) {
      logger.error('Error deleting cache entries', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        service: SERVICE_NAME,
      });
    }

    result.durationMs = Date.now() - startTime;

    logger.info('Data retention cleanup completed', {
      ...result,
      jobId: job.id,
      service: SERVICE_NAME,
    });

    return result;
  } catch (error) {
    result.durationMs = Date.now() - startTime;

    logger.error('Data retention cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      partialResult: result,
      jobId: job.id,
      service: SERVICE_NAME,
    });

    throw error;
  }
}

// ============================================================================
// WORKER AND QUEUE MANAGEMENT
// ============================================================================

/** Worker instance (created lazily) */
let dataRetentionWorker: Worker<DataRetentionJobData, DataRetentionResult> | null = null;

/**
 * Start the data retention worker
 *
 * Creates a BullMQ worker that processes data retention jobs.
 * Worker is registered for graceful shutdown.
 *
 * @returns The worker instance
 */
export function startDataRetentionWorker(): Worker<DataRetentionJobData, DataRetentionResult> {
  if (dataRetentionWorker) {
    logger.warn('Data retention worker already running', { service: SERVICE_NAME });
    return dataRetentionWorker;
  }

  dataRetentionWorker = new Worker<DataRetentionJobData, DataRetentionResult>(
    QUEUE_NAMES.DATA_RETENTION,
    processDataRetention,
    {
      connection: redis,
      concurrency: 1, // Only one retention job at a time
      limiter: {
        max: 1,
        duration: 60000, // Max 1 job per minute (safety)
      },
    }
  );

  // Event handlers
  dataRetentionWorker.on('completed', (job, result) => {
    logger.info('Data retention job completed', {
      jobId: job.id,
      deletedRequests: result.deletedRequests,
      deletedAlerts: result.deletedAlerts,
      deletedFeedback: result.deletedFeedback,
      deletedCache: result.deletedCache,
      durationMs: result.durationMs,
      service: SERVICE_NAME,
    });
  });

  dataRetentionWorker.on('failed', (job, error) => {
    logger.error('Data retention job failed', {
      jobId: job?.id,
      error: error.message,
      stack: error.stack,
      service: SERVICE_NAME,
    });
  });

  dataRetentionWorker.on('error', (error) => {
    logger.error('Data retention worker error', {
      error: error.message,
      stack: error.stack,
      service: SERVICE_NAME,
    });
  });

  // Register for graceful shutdown
  registerWorker(dataRetentionWorker);

  logger.info('Data retention worker started', {
    queue: QUEUE_NAMES.DATA_RETENTION,
    concurrency: 1,
    service: SERVICE_NAME,
  });

  return dataRetentionWorker;
}

/**
 * Schedule the daily data retention job
 *
 * Creates a repeatable job that runs daily at 3:00 AM Moscow time.
 * Moscow is UTC+3, so 3:00 AM Moscow = 00:00 UTC (midnight).
 *
 * Cron: `0 0 * * *` = every day at midnight UTC
 */
export async function scheduleDataRetentionJob(): Promise<void> {
  const repeatPattern = '0 0 * * *'; // Daily at midnight UTC (3 AM Moscow)

  try {
    // Remove any existing repeatable job to avoid duplicates
    await dataRetentionQueue.removeRepeatable('daily-cleanup', {
      pattern: repeatPattern,
    });

    // Schedule new repeatable job
    await dataRetentionQueue.add(
      'daily-cleanup',
      { triggeredBy: 'scheduler' },
      {
        repeat: {
          pattern: repeatPattern,
        },
        jobId: 'data-retention-daily',
      }
    );

    logger.info('Data retention job scheduled', {
      pattern: repeatPattern,
      description: 'Daily at 00:00 UTC (03:00 Moscow)',
      service: SERVICE_NAME,
    });
  } catch (error) {
    logger.error('Failed to schedule data retention job', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: SERVICE_NAME,
    });
    throw error;
  }
}

/**
 * Trigger a manual data retention cleanup
 *
 * Useful for testing or immediate cleanup needs.
 *
 * @returns The created job
 */
export async function triggerManualCleanup() {
  const job = await dataRetentionQueue.add(
    'manual-cleanup',
    { triggeredBy: 'manual' },
    {
      jobId: `data-retention-manual-${Date.now()}`,
    }
  );

  logger.info('Manual data retention cleanup triggered', {
    jobId: job.id,
    service: SERVICE_NAME,
  });

  return job;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export queue from setup for convenience
export { dataRetentionQueue } from '../queues/setup.js';

export default {
  startDataRetentionWorker,
  scheduleDataRetentionJob,
  triggerManualCleanup,
  dataRetentionQueue,
};

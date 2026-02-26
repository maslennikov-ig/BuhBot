/**
 * Missing Telegram IDs Job
 *
 * BullMQ job that periodically checks for chats with SLA enabled but no
 * notification recipients configured (neither manager nor accountant Telegram IDs).
 * When such chats are found without a global manager fallback, admin users
 * receive an in-app notification prompting them to configure recipients.
 *
 * Schedule: Weekdays at 09:00 UTC (12:00 Moscow, UTC+3).
 *
 * Logic:
 * 1. Find chats where slaEnabled=true, isMigrated=false, and both
 *    managerTelegramIds and accountantTelegramIds are empty arrays.
 * 2. If all chats are properly configured — do nothing.
 * 3. If global managers exist as fallback — log a warning but skip notifications
 *    (delivery is still possible via the fallback).
 * 4. Otherwise create one in-app notification per admin user summarising
 *    the affected chats and linking to /chats for remediation.
 *
 * @module jobs/missing-telegram-ids.job
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import logger from '../utils/logger.js';
import {
  missingTelegramIdsQueue,
  QUEUE_NAMES,
  registerWorker,
  type MissingTelegramIdsJobData,
} from '../queues/setup.js';
import { appNotificationService } from '../services/notification/app-notification.service.js';

// Re-export job data type for convenience
export type { MissingTelegramIdsJobData } from '../queues/setup.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Service identifier for logging */
const SERVICE_NAME = 'missing-telegram-ids-job';

/** Maximum number of chat titles to include inline in notification message */
const MAX_CHAT_TITLES_IN_MESSAGE = 5;

// ============================================================================
// RESULT TYPE
// ============================================================================

export interface MissingTelegramIdsResult {
  /** Number of SLA-enabled chats inspected */
  chatsChecked: number;
  /** Number of admin notifications sent */
  notificationsSent: number;
}

// ============================================================================
// JOB PROCESSOR
// ============================================================================

/**
 * Process a missing Telegram IDs check job.
 *
 * @param job - BullMQ job containing trigger metadata
 * @returns Result summary with counts
 */
async function processMissingTelegramIds(
  job: Job<MissingTelegramIdsJobData>
): Promise<MissingTelegramIdsResult> {
  const { triggeredBy } = job.data;

  logger.info('Processing missing Telegram IDs check', {
    jobId: job.id,
    triggeredBy,
    service: SERVICE_NAME,
  });

  // 1. Find chats with SLA enabled but no recipients configured
  const chatsWithoutRecipients = await prisma.chat.findMany({
    where: {
      slaEnabled: true,
      isMigrated: false,
      deletedAt: null, // Exclude soft-deleted chats (gh-209)
      managerTelegramIds: { isEmpty: true },
      accountantTelegramIds: { isEmpty: true },
    },
    select: { id: true, title: true },
  });

  if (chatsWithoutRecipients.length === 0) {
    logger.info('All SLA-enabled chats have recipients configured', {
      service: SERVICE_NAME,
    });
    return { chatsChecked: 0, notificationsSent: 0 };
  }

  // 2. Check if global managers exist as a fallback
  const globalSettings = await prisma.globalSettings.findUnique({
    where: { id: 'default' },
    select: { globalManagerIds: true },
  });
  const hasGlobalManagers = (globalSettings?.globalManagerIds ?? []).length > 0;

  if (hasGlobalManagers) {
    logger.info(
      'Chats missing local recipients but global managers configured — skipping notifications',
      {
        chatCount: chatsWithoutRecipients.length,
        service: SERVICE_NAME,
      }
    );
    return { chatsChecked: chatsWithoutRecipients.length, notificationsSent: 0 };
  }

  // 3. Find admin users to notify
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true },
  });

  if (admins.length === 0) {
    logger.warn('No admin users found for missing Telegram ID alerts', {
      chatCount: chatsWithoutRecipients.length,
      service: SERVICE_NAME,
    });
    return { chatsChecked: chatsWithoutRecipients.length, notificationsSent: 0 };
  }

  // 4. Build notification message with up to MAX_CHAT_TITLES_IN_MESSAGE titles
  const previewTitles = chatsWithoutRecipients
    .slice(0, MAX_CHAT_TITLES_IN_MESSAGE)
    .map((c) => c.title || `#${c.id.toString()}`)
    .join(', ');

  const remainderCount = chatsWithoutRecipients.length - MAX_CHAT_TITLES_IN_MESSAGE;
  const suffix = remainderCount > 0 ? ` и ещё ${remainderCount}` : '';

  const notificationMessage =
    `${chatsWithoutRecipients.length} чат(ов) с включённым SLA не имеют настроенных ` +
    `получателей: ${previewTitles}${suffix}. ` +
    `Настройте менеджеров или бухгалтеров.`;

  // 5. Create one in-app notification per admin
  const notifications = admins.map((admin) =>
    appNotificationService.create({
      userId: admin.id,
      title: 'Чаты без получателей SLA-уведомлений',
      message: notificationMessage,
      type: 'warning',
      link: '/chats',
    })
  );

  await Promise.all(notifications);

  logger.info('Missing Telegram ID notifications sent', {
    chatCount: chatsWithoutRecipients.length,
    adminCount: admins.length,
    service: SERVICE_NAME,
  });

  return {
    chatsChecked: chatsWithoutRecipients.length,
    notificationsSent: admins.length,
  };
}

// ============================================================================
// WORKER AND QUEUE MANAGEMENT
// ============================================================================

/** Worker instance (created lazily) */
let worker: Worker<MissingTelegramIdsJobData, MissingTelegramIdsResult> | null = null;

/**
 * Start the missing Telegram IDs worker.
 *
 * Creates a BullMQ worker that processes check jobs.
 * The worker is registered for graceful shutdown.
 *
 * @returns The worker instance
 */
export function startMissingTelegramIdsWorker(): Worker<
  MissingTelegramIdsJobData,
  MissingTelegramIdsResult
> {
  if (worker) {
    logger.warn('Missing Telegram IDs worker already running', { service: SERVICE_NAME });
    return worker;
  }

  worker = new Worker<MissingTelegramIdsJobData, MissingTelegramIdsResult>(
    QUEUE_NAMES.MISSING_TELEGRAM_IDS,
    processMissingTelegramIds,
    {
      connection: redis,
      concurrency: 1, // Only one check at a time
      limiter: {
        max: 1,
        duration: 60000, // Max 1 job per minute (safety)
      },
    }
  );

  worker.on('completed', (job, result) => {
    logger.info('Missing Telegram IDs job completed', {
      jobId: job.id,
      chatsChecked: result.chatsChecked,
      notificationsSent: result.notificationsSent,
      service: SERVICE_NAME,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Missing Telegram IDs job failed', {
      jobId: job?.id,
      error: error.message,
      stack: error.stack,
      service: SERVICE_NAME,
    });
  });

  worker.on('error', (error) => {
    logger.error('Missing Telegram IDs worker error', {
      error: error.message,
      stack: error.stack,
      service: SERVICE_NAME,
    });
  });

  // Register for graceful shutdown
  registerWorker(worker);

  logger.info('Missing Telegram IDs worker started', {
    queue: QUEUE_NAMES.MISSING_TELEGRAM_IDS,
    concurrency: 1,
    service: SERVICE_NAME,
  });

  return worker;
}

/**
 * Schedule the periodic missing Telegram IDs check.
 *
 * Runs on weekdays (Monday–Friday) at 09:00 UTC, which is 12:00 Moscow time (UTC+3).
 * Any previously scheduled repeatable job with the same pattern is removed first
 * to avoid duplicate scheduling across restarts.
 */
export async function scheduleMissingTelegramIdsJob(): Promise<void> {
  const repeatPattern = '0 9 * * 1-5'; // Weekdays at 09:00 UTC (12:00 Moscow)

  try {
    // Remove any existing repeatable job to avoid duplicates on restart
    await missingTelegramIdsQueue.removeRepeatable('check-missing-tg-ids', {
      pattern: repeatPattern,
    });

    await missingTelegramIdsQueue.add(
      'check-missing-tg-ids',
      { triggeredBy: 'scheduler' },
      {
        repeat: { pattern: repeatPattern },
        jobId: 'missing-telegram-ids-periodic',
      }
    );

    logger.info('Missing Telegram IDs check scheduled', {
      pattern: repeatPattern,
      description: 'Weekdays at 09:00 UTC (12:00 Moscow)',
      service: SERVICE_NAME,
    });
  } catch (error) {
    logger.error('Failed to schedule missing Telegram IDs check', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: SERVICE_NAME,
    });
    throw error;
  }
}

/**
 * Trigger a manual missing Telegram IDs check.
 *
 * Useful for testing or on-demand validation.
 *
 * @returns The created job
 */
export async function triggerManualMissingTelegramIdsCheck() {
  const job = await missingTelegramIdsQueue.add(
    'manual-check',
    { triggeredBy: 'manual' },
    {
      jobId: `missing-tg-ids-manual-${Date.now()}`,
    }
  );

  logger.info('Manual missing Telegram IDs check triggered', {
    jobId: job.id,
    service: SERVICE_NAME,
  });

  return job;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export queue from setup for convenience
export { missingTelegramIdsQueue } from '../queues/setup.js';

export default {
  startMissingTelegramIdsWorker,
  scheduleMissingTelegramIdsJob,
  triggerManualMissingTelegramIdsCheck,
  missingTelegramIdsQueue,
};

/**
 * SLA Timer Service
 *
 * Manages SLA timer lifecycle for client requests:
 * - Start timer when new REQUEST is classified
 * - Stop timer when accountant responds
 * - Pause/resume for working hours (future enhancement)
 * - Track elapsed working time
 *
 * Uses BullMQ for delayed job scheduling with working hours awareness.
 *
 * @module services/sla/timer.service
 */

import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import {
  scheduleSlaCheck,
  cancelSlaCheck,
  slaTimerQueue,
  queueAlert,
  scheduleSlaWarning,
  cancelSlaWarning,
} from '../../queues/setup.js';
import { getGlobalSettings } from '../../config/config.service.js';
import {
  calculateDelayUntilBreach,
  calculateWorkingMinutes,
  DEFAULT_WORKING_SCHEDULE,
  type WorkingSchedule,
} from './working-hours.service.js';

/**
 * SLA Status returned by getSlaStatus
 */
export interface SlaStatus {
  /** Request ID */
  requestId: string;
  /** Current SLA status */
  status:
    | 'pending'
    | 'in_progress'
    | 'waiting_client'
    | 'transferred'
    | 'answered'
    | 'escalated'
    | 'closed';
  /** Whether SLA has been breached */
  breached: boolean;
  /** Elapsed working minutes since request received */
  elapsedWorkingMinutes: number;
  /** Remaining minutes until breach (0 if breached) */
  remainingMinutes: number;
  /** SLA threshold in minutes */
  thresholdMinutes: number;
  /** When timer was started */
  timerStartedAt: Date | null;
}

/**
 * Get working schedule for a chat
 *
 * Fetches chat-specific schedule from database,
 * falling back to default Moscow timezone schedule.
 *
 * @param chatId - Telegram chat ID
 * @returns Working schedule configuration
 */
async function getScheduleForChat(chatId: string): Promise<WorkingSchedule> {
  try {
    // Check if chat exists and get 24/7 mode setting (exclude soft-deleted, gh-209)
    const chat = await prisma.chat.findFirst({
      where: { id: BigInt(chatId), deletedAt: null },
      select: {
        is24x7Mode: true,
      },
    });

    if (!chat) {
      return await getGlobalSchedule();
    }

    // If 24/7 mode is enabled, return schedule with is24x7 flag
    if (chat.is24x7Mode) {
      return {
        ...DEFAULT_WORKING_SCHEDULE,
        is24x7: true,
      };
    }

    // Fetch working schedules for this chat
    const workingSchedules = await prisma.workingSchedule.findMany({
      where: {
        chatId: BigInt(chatId),
        isActive: true,
      },
    });

    // If chat has custom schedules, use them
    if (workingSchedules.length > 0) {
      // Convert database schedules to WorkingSchedule format
      const workingDays = workingSchedules.map((s) => s.dayOfWeek);
      const firstSchedule = workingSchedules[0];

      // Use the timezone from the first schedule, or default
      const timezone = firstSchedule?.timezone ?? 'Europe/Moscow';

      // Format time from Date object (Prisma returns TIME as Date)
      const formatTime = (date: Date): string => {
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      };

      const startTime = firstSchedule ? formatTime(firstSchedule.startTime) : '09:00';
      const endTime = firstSchedule ? formatTime(firstSchedule.endTime) : '18:00';

      return {
        timezone,
        workingDays,
        startTime,
        endTime,
        holidays: [], // TODO: Load from ChatHoliday table
        is24x7: false,
      };
    }

    return await getGlobalSchedule();
  } catch (error) {
    logger.error('Error fetching schedule for chat, using default', {
      chatId,
      error: error instanceof Error ? error.message : String(error),
      service: 'sla-timer',
    });
    return await getGlobalSchedule();
  }
}

/**
 * Get schedule from GlobalSettings as fallback
 */
async function getGlobalSchedule(): Promise<WorkingSchedule> {
  try {
    const globalSettings = await prisma.globalSettings.findUnique({
      where: { id: 'default' },
      select: {
        defaultTimezone: true,
        defaultWorkingDays: true,
        defaultStartTime: true,
        defaultEndTime: true,
      },
    });

    if (!globalSettings) {
      return DEFAULT_WORKING_SCHEDULE;
    }

    // Detect 24/7 mode: 00:00-23:59 with all 7 days
    const is24x7 =
      globalSettings.defaultStartTime === '00:00' &&
      globalSettings.defaultEndTime === '23:59' &&
      globalSettings.defaultWorkingDays.length === 7;

    return {
      timezone: globalSettings.defaultTimezone ?? 'Europe/Moscow',
      workingDays: globalSettings.defaultWorkingDays ?? [1, 2, 3, 4, 5],
      startTime: globalSettings.defaultStartTime ?? '09:00',
      endTime: globalSettings.defaultEndTime ?? '18:00',
      holidays: [],
      is24x7,
    };
  } catch (error) {
    logger.error('Failed to fetch GlobalSettings schedule', {
      error: error instanceof Error ? error.message : String(error),
      service: 'sla-timer',
    });
    return DEFAULT_WORKING_SCHEDULE;
  }
}

/**
 * Start SLA timer for a client request
 *
 * Schedules a BullMQ delayed job that will fire when the SLA threshold
 * is exceeded (in working minutes). The delay is calculated considering
 * working hours and holidays.
 *
 * @param requestId - UUID of the ClientRequest
 * @param chatId - Telegram chat ID as string
 * @param thresholdMinutes - SLA threshold in working minutes
 *
 * @example
 * ```typescript
 * // Start 60-minute SLA timer
 * await startSlaTimer('uuid-123', '123456789', 60);
 * ```
 */
export async function startSlaTimer(
  requestId: string,
  chatId: string,
  thresholdMinutes: number
): Promise<void> {
  logger.info('Starting SLA timer', {
    requestId,
    chatId,
    thresholdMinutes,
    service: 'sla-timer',
  });

  try {
    // Get working schedule for this chat
    const schedule = await getScheduleForChat(chatId);

    // Get request to find receivedAt time
    const request = await prisma.clientRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      logger.error('Request not found when starting SLA timer', {
        requestId,
        service: 'sla-timer',
      });
      return;
    }

    // Calculate delay until breach in milliseconds
    const delayMs = calculateDelayUntilBreach(request.receivedAt, thresholdMinutes, schedule);

    // Update request with timer started timestamp
    await prisma.clientRequest.update({
      where: { id: requestId },
      data: {
        slaTimerStartedAt: new Date(),
        status: 'pending',
      },
    });

    // Schedule the breach check job
    await scheduleSlaCheck(requestId, chatId, thresholdMinutes, delayMs);

    // Schedule SLA warning if configured (Phase 3)
    const settings = await getGlobalSettings();
    const warningPercent = settings.slaWarningPercent;
    if (warningPercent > 0 && warningPercent < 100) {
      const warningThreshold = Math.floor((thresholdMinutes * warningPercent) / 100);
      const warningDelayMs = calculateDelayUntilBreach(
        request.receivedAt,
        warningThreshold,
        schedule
      );
      if (warningDelayMs > 0) {
        await scheduleSlaWarning(requestId, chatId, thresholdMinutes, warningDelayMs);
        logger.info('SLA warning scheduled', {
          requestId,
          chatId,
          warningPercent,
          warningThreshold,
          warningDelayMs,
          service: 'sla-timer',
        });
      }
    }

    logger.info('SLA timer started successfully', {
      requestId,
      chatId,
      thresholdMinutes,
      delayMs,
      scheduledBreachTime: new Date(Date.now() + delayMs).toISOString(),
      schedule: {
        timezone: schedule.timezone,
        is24x7: schedule.is24x7,
      },
      service: 'sla-timer',
    });
  } catch (error) {
    logger.error('Failed to start SLA timer', {
      requestId,
      chatId,
      thresholdMinutes,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: 'sla-timer',
    });
    throw error;
  }
}

/**
 * Response details when stopping SLA timer
 */
export interface StopTimerOptions {
  /** User ID of the responder (accountant) */
  respondedBy?: string | null;
  /** Telegram message ID of the response */
  responseMessageId?: number | bigint | null;
  /** Response timestamp (defaults to now) */
  responseAt?: Date;
}

/**
 * Result returned when stopping SLA timer
 */
export interface StopTimerResult {
  /** Whether SLA was breached before response */
  breached: boolean;
  /** Calculated working minutes between request and response */
  workingMinutes: number;
  /** SLA threshold in minutes */
  thresholdMinutes: number;
  /** Request status after stopping */
  status: string;
}

/**
 * Stop SLA timer for a client request
 *
 * Called when an accountant responds to the client.
 * Cancels the scheduled breach check job and updates the request
 * with resolution details including who responded and response message ID.
 *
 * @param requestId - UUID of the ClientRequest
 * @param options - Optional response details (responder, message ID)
 * @returns StopTimerResult with breach status and working minutes
 *
 * @example
 * ```typescript
 * // Stop timer when accountant responds
 * const result = await stopSlaTimer('uuid-123', {
 *   respondedBy: 'user-uuid-456',
 *   responseMessageId: 12345,
 * });
 * console.log('Breached:', result.breached, 'Minutes:', result.workingMinutes);
 * ```
 */
export async function stopSlaTimer(
  requestId: string,
  options: StopTimerOptions = {}
): Promise<StopTimerResult> {
  const responseAt = options.responseAt ?? new Date();

  logger.info('Stopping SLA timer', {
    requestId,
    respondedBy: options.respondedBy,
    responseMessageId: options.responseMessageId?.toString(),
    service: 'sla-timer',
  });

  try {
    // Cancel the scheduled breach check
    const cancelled = await cancelSlaCheck(requestId);

    if (cancelled) {
      logger.info('SLA breach check job cancelled', {
        requestId,
        service: 'sla-timer',
      });
    } else {
      logger.debug('No SLA breach check job found to cancel', {
        requestId,
        service: 'sla-timer',
      });
    }

    // Cancel SLA warning too
    await cancelSlaWarning(requestId);

    // Get request to calculate elapsed working time
    const request = await prisma.clientRequest.findUnique({
      where: { id: requestId },
      include: {
        chat: true,
      },
    });

    if (!request) {
      logger.warn('Request not found when stopping SLA timer', {
        requestId,
        service: 'sla-timer',
      });
      return {
        breached: false,
        workingMinutes: 0,
        thresholdMinutes: 60,
        status: 'not_found',
      };
    }

    // Calculate elapsed working time
    const schedule = await getScheduleForChat(String(request.chatId));
    const elapsedMinutes = calculateWorkingMinutes(request.receivedAt, responseAt, schedule);

    // Get SLA threshold
    const thresholdMinutes = request.chat?.slaThresholdMinutes ?? 60;

    // Determine if SLA was breached
    // Already breached flag takes precedence, otherwise check elapsed time
    const breached = request.slaBreached || elapsedMinutes >= thresholdMinutes;

    // Convert responseMessageId to bigint if provided
    const responseMessageIdBigInt =
      options.responseMessageId != null ? BigInt(options.responseMessageId) : null;

    // Update request with response details
    await prisma.clientRequest.update({
      where: { id: requestId },
      data: {
        status: 'answered',
        responseAt,
        respondedBy: options.respondedBy ?? null,
        responseMessageId: responseMessageIdBigInt,
        responseTimeMinutes: elapsedMinutes,
        slaWorkingMinutes: elapsedMinutes,
      },
    });

    logger.info('SLA timer stopped successfully', {
      requestId,
      elapsedMinutes,
      thresholdMinutes,
      breached,
      respondedBy: options.respondedBy,
      service: 'sla-timer',
    });

    return {
      breached,
      workingMinutes: elapsedMinutes,
      thresholdMinutes,
      status: 'answered',
    };
  } catch (error) {
    logger.error('Failed to stop SLA timer', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: 'sla-timer',
    });
    throw error;
  }
}

/**
 * Pause SLA timer for a client request
 *
 * Used when entering non-working hours. The timer resumes
 * when working hours begin again.
 *
 * @param requestId - UUID of the ClientRequest
 *
 * @note Future enhancement - not fully implemented yet
 */
export async function pauseSlaTimer(requestId: string): Promise<void> {
  logger.info('Pausing SLA timer', {
    requestId,
    service: 'sla-timer',
  });

  try {
    // Record when timer was paused
    await prisma.clientRequest.update({
      where: { id: requestId },
      data: {
        slaTimerPausedAt: new Date(),
      },
    });

    // Cancel the current scheduled job
    await cancelSlaCheck(requestId);

    logger.info('SLA timer paused', {
      requestId,
      service: 'sla-timer',
    });
  } catch (error) {
    logger.error('Failed to pause SLA timer', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      service: 'sla-timer',
    });
    throw error;
  }
}

/**
 * Resume SLA timer for a client request
 *
 * Called when working hours begin. Recalculates remaining time
 * and schedules a new breach check job.
 *
 * @param requestId - UUID of the ClientRequest
 *
 * @note Future enhancement - not fully implemented yet
 */
export async function resumeSlaTimer(requestId: string): Promise<void> {
  logger.info('Resuming SLA timer', {
    requestId,
    service: 'sla-timer',
  });

  try {
    const request = await prisma.clientRequest.findUnique({
      where: { id: requestId },
      include: {
        chat: true,
      },
    });

    if (!request || !request.chat) {
      logger.warn('Request or chat not found when resuming SLA timer', {
        requestId,
        service: 'sla-timer',
      });
      return;
    }

    // Clear pause timestamp
    await prisma.clientRequest.update({
      where: { id: requestId },
      data: {
        slaTimerPausedAt: null,
      },
    });

    // Recalculate and schedule new breach check
    const thresholdMinutes = request.chat.slaThresholdMinutes ?? 60;
    const schedule = await getScheduleForChat(String(request.chatId));

    const delayMs = calculateDelayUntilBreach(request.receivedAt, thresholdMinutes, schedule);

    await scheduleSlaCheck(requestId, String(request.chatId), thresholdMinutes, delayMs);

    logger.info('SLA timer resumed', {
      requestId,
      delayMs,
      service: 'sla-timer',
    });
  } catch (error) {
    logger.error('Failed to resume SLA timer', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      service: 'sla-timer',
    });
    throw error;
  }
}

/**
 * Get current SLA status for a request
 *
 * Returns comprehensive status including elapsed time,
 * remaining time, and breach status.
 *
 * @param requestId - UUID of the ClientRequest
 * @returns SLA status or null if request not found
 *
 * @example
 * ```typescript
 * const status = await getSlaStatus('uuid-123');
 * if (status && status.breached) {
 *   console.log('SLA breached!');
 * }
 * ```
 */
export async function getSlaStatus(requestId: string): Promise<SlaStatus | null> {
  try {
    const request = await prisma.clientRequest.findUnique({
      where: { id: requestId },
      include: {
        chat: true,
      },
    });

    if (!request || !request.chat) {
      return null;
    }

    const thresholdMinutes = request.chat.slaThresholdMinutes ?? 60;
    const schedule = await getScheduleForChat(String(request.chatId));

    // Calculate elapsed working time
    const elapsedMinutes = calculateWorkingMinutes(request.receivedAt, new Date(), schedule);

    const remainingMinutes = Math.max(0, thresholdMinutes - elapsedMinutes);
    const breached = elapsedMinutes >= thresholdMinutes || request.slaBreached;

    return {
      requestId,
      status: request.status,
      breached,
      elapsedWorkingMinutes: elapsedMinutes,
      remainingMinutes,
      thresholdMinutes,
      timerStartedAt: request.slaTimerStartedAt,
    };
  } catch (error) {
    logger.error('Failed to get SLA status', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      service: 'sla-timer',
    });
    return null;
  }
}

/**
 * Recovery result statistics
 */
export interface RecoveryResult {
  /** Total pending requests found */
  totalPending: number;
  /** Requests rescheduled (job was missing, breach not yet) */
  rescheduled: number;
  /** Requests marked as breached (job missing, breach time passed) */
  breached: number;
  /** Requests that already had active jobs */
  alreadyActive: number;
  /** Requests that failed to recover */
  failed: number;
}

/**
 * Recover pending SLA timers after server restart
 *
 * This function handles the critical edge case where BullMQ delayed jobs
 * are lost during container restarts. It:
 *
 * 1. Queries all ClientRequests with status='pending' and slaTimerStartedAt != null
 * 2. For each request, checks if the BullMQ job still exists
 * 3. If job is missing:
 *    - If breach time has passed: immediately mark as breached and queue alert
 *    - If breach time not yet passed: reschedule the job with remaining delay
 *
 * Should be called during application startup AFTER Redis connection is established.
 *
 * @returns Recovery statistics
 *
 * @example
 * ```typescript
 * // In index.ts startup sequence
 * const result = await recoverPendingSlaTimers();
 * logger.info('SLA timer recovery complete', result);
 * ```
 */
export async function recoverPendingSlaTimers(): Promise<RecoveryResult> {
  const result: RecoveryResult = {
    totalPending: 0,
    rescheduled: 0,
    breached: 0,
    alreadyActive: 0,
    failed: 0,
  };

  logger.info('Starting SLA timer recovery...', { service: 'sla-timer-recovery' });

  try {
    // Find all pending requests with SLA timer started
    // Note: Use { in: [...] } instead of direct equality for enum fields
    // due to Prisma 7.0 driver adapter behavior with PostgreSQL enums
    const pendingRequests = await prisma.clientRequest.findMany({
      where: {
        status: { in: ['pending'] },
        slaTimerStartedAt: { not: null },
      },
      include: {
        chat: true,
      },
    });

    result.totalPending = pendingRequests.length;

    if (pendingRequests.length === 0) {
      logger.info('No pending SLA timers to recover', { service: 'sla-timer-recovery' });
      return result;
    }

    logger.info(`Found ${pendingRequests.length} pending requests to check`, {
      service: 'sla-timer-recovery',
    });

    for (const request of pendingRequests) {
      const jobId = `sla-${request.id}`;

      try {
        // Check if job still exists in BullMQ
        const existingJob = await slaTimerQueue.getJob(jobId);

        if (existingJob) {
          // Job still exists, nothing to do
          result.alreadyActive++;
          logger.debug('SLA timer job still active', {
            requestId: request.id,
            jobId,
            service: 'sla-timer-recovery',
          });
          continue;
        }

        // Job is missing - need to recover
        const chatId = String(request.chatId);
        const thresholdMinutes = request.chat?.slaThresholdMinutes ?? 60;
        const schedule = await getScheduleForChat(chatId);

        // Calculate elapsed working time
        const elapsedMinutes = calculateWorkingMinutes(request.receivedAt, new Date(), schedule);

        if (elapsedMinutes >= thresholdMinutes) {
          // Breach time has already passed - mark as breached immediately
          logger.warn('SLA breach detected during recovery (job was lost)', {
            requestId: request.id,
            chatId,
            elapsedMinutes,
            thresholdMinutes,
            service: 'sla-timer-recovery',
          });

          // Update request as breached
          await prisma.clientRequest.update({
            where: { id: request.id },
            data: {
              slaBreached: true,
              status: 'escalated',
            },
          });

          // Queue breach alert
          // Get manager IDs from chat for escalation
          const managers = await getManagersForChat(chatId);

          let alertManagerIds = managers;
          if (alertManagerIds.length === 0) {
            const globalSettings = await prisma.globalSettings.findUnique({
              where: { id: 'default' },
            });
            alertManagerIds = globalSettings?.globalManagerIds ?? [];

            logger.warn('Using global managers for recovery breach alert', {
              requestId: request.id,
              chatId,
              managerCount: alertManagerIds.length,
              service: 'sla-timer-recovery',
            });
          }

          if (alertManagerIds.length > 0) {
            await queueAlert({
              requestId: request.id,
              alertType: 'breach',
              managerIds: alertManagerIds,
              escalationLevel: 1,
            });
          } else {
            logger.error('CRITICAL: No managers for recovery breach alert', {
              requestId: request.id,
              chatId,
            });
          }

          result.breached++;
        } else {
          // Breach time not yet passed - reschedule the job
          const delayMs = calculateDelayUntilBreach(request.receivedAt, thresholdMinutes, schedule);

          // Ensure delay is positive (at least 1 second)
          const actualDelayMs = Math.max(delayMs, 1000);

          await scheduleSlaCheck(request.id, chatId, thresholdMinutes, actualDelayMs);

          logger.info('SLA timer rescheduled after recovery', {
            requestId: request.id,
            chatId,
            elapsedMinutes,
            remainingMinutes: thresholdMinutes - elapsedMinutes,
            delayMs: actualDelayMs,
            service: 'sla-timer-recovery',
          });

          result.rescheduled++;
        }
      } catch (error) {
        logger.error('Failed to recover SLA timer for request', {
          requestId: request.id,
          error: error instanceof Error ? error.message : String(error),
          service: 'sla-timer-recovery',
        });
        result.failed++;
      }
    }

    logger.info('SLA timer recovery completed', {
      ...result,
      service: 'sla-timer-recovery',
    });

    return result;
  } catch (error) {
    logger.error('Failed to recover SLA timers', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: 'sla-timer-recovery',
    });
    throw error;
  }
}

/**
 * Get manager Telegram user IDs for alert escalation
 *
 * Uses the managerTelegramIds field from Chat which stores
 * Telegram IDs of managers to notify on SLA breach.
 *
 * @param chatId - Telegram chat ID
 * @returns Array of manager Telegram user IDs as strings
 */
async function getManagersForChat(chatId: string): Promise<string[]> {
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: BigInt(chatId), deletedAt: null },
      select: {
        managerTelegramIds: true,
      },
    });

    if (!chat?.managerTelegramIds || chat.managerTelegramIds.length === 0) {
      logger.debug('No managers configured for chat', {
        chatId,
        service: 'sla-timer-recovery',
      });
      return [];
    }

    return chat.managerTelegramIds;
  } catch (error) {
    logger.error('Failed to get managers for chat', {
      chatId,
      error: error instanceof Error ? error.message : String(error),
      service: 'sla-timer-recovery',
    });
    return [];
  }
}

export default {
  startSlaTimer,
  stopSlaTimer,
  pauseSlaTimer,
  resumeSlaTimer,
  getSlaStatus,
  recoverPendingSlaTimers,
};

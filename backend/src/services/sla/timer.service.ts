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
} from '../../queues/setup.js';
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
  status: 'pending' | 'in_progress' | 'answered' | 'escalated';
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
    const chat = await prisma.chat.findUnique({
      where: { id: BigInt(chatId) },
      include: {
        workingSchedules: {
          where: { isActive: true },
        },
      },
    });

    if (!chat) {
      return DEFAULT_WORKING_SCHEDULE;
    }

    // If 24/7 mode is enabled, return schedule with is24x7 flag
    if (chat.is24x7Mode) {
      return {
        ...DEFAULT_WORKING_SCHEDULE,
        is24x7: true,
      };
    }

    // If chat has custom schedules, use them
    if (chat.workingSchedules.length > 0) {
      // Convert database schedules to WorkingSchedule format
      const workingDays = chat.workingSchedules.map((s: { dayOfWeek: number }) => s.dayOfWeek);
      const firstSchedule = chat.workingSchedules[0];

      // Use the timezone from the first schedule, or default
      const timezone = firstSchedule?.timezone ?? 'Europe/Moscow';

      // Extract time from database Time field
      // Database stores as Date with 1970-01-01 + time
      const startTime = firstSchedule
        ? formatTime(firstSchedule.startTime)
        : '09:00';
      const endTime = firstSchedule
        ? formatTime(firstSchedule.endTime)
        : '18:00';

      return {
        timezone,
        workingDays,
        startTime,
        endTime,
        holidays: [], // TODO: Load from ChatHoliday table
        is24x7: false,
      };
    }

    return DEFAULT_WORKING_SCHEDULE;
  } catch (error) {
    logger.error('Error fetching schedule for chat, using default', {
      chatId,
      error: error instanceof Error ? error.message : String(error),
      service: 'sla-timer',
    });
    return DEFAULT_WORKING_SCHEDULE;
  }
}

/**
 * Format a Date object to HH:mm string
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
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
    const delayMs = calculateDelayUntilBreach(
      request.receivedAt,
      thresholdMinutes,
      schedule
    );

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
    const elapsedMinutes = calculateWorkingMinutes(
      request.receivedAt,
      responseAt,
      schedule
    );

    // Get SLA threshold
    const thresholdMinutes = request.chat?.slaThresholdMinutes ?? 60;

    // Determine if SLA was breached
    // Already breached flag takes precedence, otherwise check elapsed time
    const breached = request.slaBreached || elapsedMinutes >= thresholdMinutes;

    // Convert responseMessageId to bigint if provided
    const responseMessageIdBigInt = options.responseMessageId != null
      ? BigInt(options.responseMessageId)
      : null;

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

    const delayMs = calculateDelayUntilBreach(
      request.receivedAt,
      thresholdMinutes,
      schedule
    );

    await scheduleSlaCheck(
      requestId,
      String(request.chatId),
      thresholdMinutes,
      delayMs
    );

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
    const elapsedMinutes = calculateWorkingMinutes(
      request.receivedAt,
      new Date(),
      schedule
    );

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

export default {
  startSlaTimer,
  stopSlaTimer,
  pauseSlaTimer,
  resumeSlaTimer,
  getSlaStatus,
};

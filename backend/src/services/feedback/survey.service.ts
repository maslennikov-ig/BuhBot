/**
 * Survey Service
 *
 * Manages survey campaigns including creation, delivery, and lifecycle.
 * Handles quarterly client feedback collection with delivery tracking.
 *
 * Campaign Lifecycle:
 * - scheduled: Created and waiting for scheduled time
 * - sending: Actively delivering to clients
 * - active: All deliveries complete, accepting responses
 * - closed: Manually closed by manager
 * - expired: Past expiration date
 *
 * @module services/feedback/survey
 */

import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import type { SurveyStatus, DeliveryStatus } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input for creating a new survey campaign
 */
export interface CreateSurveyInput {
  /** Quarter identifier in format "YYYY-QN" (e.g., "2025-Q1") */
  quarter: string;
  /** When to start sending surveys */
  scheduledAt: Date;
  /** Days until survey expires (default: 7) */
  validityDays?: number;
}

/**
 * Survey with calculated statistics
 */
export interface SurveyWithStats {
  id: string;
  quarter: string;
  status: SurveyStatus;
  scheduledAt: Date;
  sentAt: Date | null;
  expiresAt: Date;
  closedAt: Date | null;
  totalClients: number;
  deliveredCount: number;
  responseCount: number;
  responseRate: number;
  averageRating: number | null;
}

/**
 * Active client for survey delivery
 */
export interface ActiveClient {
  chatId: bigint;
  title: string | null;
}

// ============================================================================
// SURVEY CAMPAIGN FUNCTIONS
// ============================================================================

/**
 * Create a new survey campaign
 *
 * Creates a survey in 'scheduled' status with calculated expiration date.
 * Validates that no active survey exists for the same quarter.
 *
 * @param input - Survey creation parameters
 * @returns Created survey with stats
 * @throws Error if survey already exists for the quarter
 *
 * @example
 * ```typescript
 * const survey = await createSurvey({
 *   quarter: '2025-Q1',
 *   scheduledAt: new Date('2025-04-01'),
 *   validityDays: 7,
 * });
 * ```
 */
export async function createSurvey(input: CreateSurveyInput): Promise<SurveyWithStats> {
  const validityDays = input.validityDays ?? 7;
  const expiresAt = new Date(input.scheduledAt);
  expiresAt.setDate(expiresAt.getDate() + validityDays);

  // Check for existing survey in same quarter
  const existing = await prisma.feedbackSurvey.findFirst({
    where: {
      quarter: input.quarter,
      status: { in: ['scheduled', 'sending', 'active'] },
    },
  });

  if (existing) {
    throw new Error(`Survey already exists for quarter ${input.quarter}`);
  }

  const survey = await prisma.feedbackSurvey.create({
    data: {
      quarter: input.quarter,
      scheduledAt: input.scheduledAt,
      expiresAt,
      status: 'scheduled',
    },
  });

  logger.info('Survey created', {
    surveyId: survey.id,
    quarter: survey.quarter,
    scheduledAt: survey.scheduledAt,
    expiresAt: survey.expiresAt,
    service: 'survey-service',
  });

  return {
    ...survey,
    responseRate: 0,
  };
}

/**
 * Get active clients for survey delivery
 *
 * Active clients are those who sent at least one message in the current quarter.
 * Uses ClientRequest.receivedAt to determine activity.
 *
 * @param quarter - Quarter identifier in format "YYYY-QN"
 * @returns Array of active client chats
 *
 * @example
 * ```typescript
 * const clients = await getActiveClients('2025-Q1');
 * console.log(`Found ${clients.length} active clients`);
 * ```
 */
export async function getActiveClients(quarter: string): Promise<ActiveClient[]> {
  // Parse quarter to get date range (format: "YYYY-QN")
  const parts = quarter.split('-Q');
  const yearStr = parts[0];
  const quarterStr = parts[1];

  if (!yearStr || !quarterStr) {
    throw new Error(`Invalid quarter format: ${quarter}. Expected format: YYYY-QN`);
  }

  const year = parseInt(yearStr, 10);
  const quarterNum = parseInt(quarterStr, 10);
  const startMonth = (quarterNum - 1) * 3;
  const quarterStart = new Date(year, startMonth, 1);
  const quarterEnd = new Date(year, startMonth + 3, 0, 23, 59, 59);

  // Find chats with messages in the quarter
  const activeChats = await prisma.chat.findMany({
    where: {
      clientRequests: {
        some: {
          receivedAt: {
            gte: quarterStart,
            lte: quarterEnd,
          },
        },
      },
    },
    select: {
      id: true,
      title: true,
    },
  });

  logger.info('Active clients fetched', {
    quarter,
    count: activeChats.length,
    dateRange: { from: quarterStart, to: quarterEnd },
    service: 'survey-service',
  });

  return activeChats.map((c) => ({ chatId: c.id, title: c.title }));
}

/**
 * Start survey delivery (change status to sending)
 *
 * Transitions survey from 'scheduled' to 'sending' status.
 * Creates delivery records for all active clients.
 *
 * @param surveyId - Survey UUID
 * @throws Error if survey not found or not in scheduled status
 *
 * @example
 * ```typescript
 * await startSurveyDelivery('survey-uuid');
 * // Survey is now in 'sending' status with pending deliveries
 * ```
 */
export async function startSurveyDelivery(surveyId: string): Promise<void> {
  const survey = await prisma.feedbackSurvey.findUnique({
    where: { id: surveyId },
  });

  if (!survey) {
    throw new Error(`Survey ${surveyId} not found`);
  }

  if (survey.status !== 'scheduled') {
    throw new Error(`Survey ${surveyId} is not in scheduled status`);
  }

  // Get active clients
  const clients = await getActiveClients(survey.quarter);

  // Create delivery records in transaction
  await prisma.$transaction([
    prisma.surveyDelivery.createMany({
      data: clients.map((c) => ({
        surveyId,
        chatId: c.chatId,
        status: 'pending' as const,
      })),
    }),
    prisma.feedbackSurvey.update({
      where: { id: surveyId },
      data: {
        status: 'sending',
        sentAt: new Date(),
        totalClients: clients.length,
      },
    }),
  ]);

  logger.info('Survey delivery started', {
    surveyId,
    clientCount: clients.length,
    service: 'survey-service',
  });
}

/**
 * Mark survey as active (all deliveries processed)
 *
 * Transitions survey from 'sending' to 'active' status.
 * Called when all pending deliveries have been processed.
 *
 * @param surveyId - Survey UUID
 *
 * @example
 * ```typescript
 * await markSurveyActive('survey-uuid');
 * ```
 */
export async function markSurveyActive(surveyId: string): Promise<void> {
  await prisma.feedbackSurvey.update({
    where: { id: surveyId },
    data: { status: 'active' },
  });

  logger.info('Survey marked as active', {
    surveyId,
    service: 'survey-service',
  });
}

/**
 * Close a survey manually
 *
 * Transitions survey to 'closed' status with closing user info.
 * Prevents further responses from being accepted.
 *
 * @param surveyId - Survey UUID
 * @param closedBy - User UUID who closed the survey
 *
 * @example
 * ```typescript
 * await closeSurvey('survey-uuid', 'manager-uuid');
 * ```
 */
export async function closeSurvey(surveyId: string, closedBy: string): Promise<void> {
  await prisma.feedbackSurvey.update({
    where: { id: surveyId },
    data: {
      status: 'closed',
      closedAt: new Date(),
      closedBy,
    },
  });

  logger.info('Survey closed', {
    surveyId,
    closedBy,
    service: 'survey-service',
  });
}

// ============================================================================
// DELIVERY FUNCTIONS
// ============================================================================

/**
 * Update delivery status
 *
 * Updates the status of a survey delivery and sets appropriate timestamps.
 * Also increments survey delivered count when status is 'delivered'.
 *
 * @param deliveryId - Delivery UUID
 * @param status - New delivery status
 * @param messageId - Optional Telegram message ID (for delivered status)
 *
 * @example
 * ```typescript
 * await updateDeliveryStatus('delivery-uuid', 'delivered', BigInt(12345));
 * await updateDeliveryStatus('delivery-uuid', 'reminded');
 * ```
 */
export async function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus,
  messageId?: bigint | null
): Promise<void> {
  const updateData: Record<string, unknown> = { status };

  if (status === 'delivered') {
    updateData['deliveredAt'] = new Date();
    if (messageId) {
      updateData['messageId'] = messageId;
    }
  } else if (status === 'reminded') {
    updateData['reminderSentAt'] = new Date();
  } else if (status === 'expired') {
    updateData['managerNotifiedAt'] = new Date();
  }

  await prisma.surveyDelivery.update({
    where: { id: deliveryId },
    data: updateData,
  });

  // Update survey delivered count if needed
  if (status === 'delivered') {
    const delivery = await prisma.surveyDelivery.findUnique({
      where: { id: deliveryId },
      select: { surveyId: true },
    });

    if (delivery) {
      await prisma.feedbackSurvey.update({
        where: { id: delivery.surveyId },
        data: {
          deliveredCount: { increment: 1 },
        },
      });
    }
  }

  logger.debug('Delivery status updated', {
    deliveryId,
    status,
    messageId: messageId?.toString(),
    service: 'survey-service',
  });
}

/**
 * Record a survey response
 *
 * Creates a feedback response for a delivery and updates statistics.
 * Validates that the delivery exists and survey is accepting responses.
 *
 * @param deliveryId - Delivery UUID
 * @param rating - Rating value (1-5)
 * @param clientUsername - Optional client username
 * @returns Created feedback response ID
 * @throws Error if delivery not found, already responded, or survey closed
 *
 * @example
 * ```typescript
 * const feedbackId = await recordResponse('delivery-uuid', 5, 'john_doe');
 * ```
 */
export async function recordResponse(
  deliveryId: string,
  rating: number,
  clientUsername?: string | null
): Promise<string> {
  const delivery = await prisma.surveyDelivery.findUnique({
    where: { id: deliveryId },
    include: { survey: true },
  });

  if (!delivery) {
    throw new Error(`Delivery ${deliveryId} not found`);
  }

  if (delivery.status === 'responded') {
    throw new Error('Already responded to this survey');
  }

  if (delivery.survey.status !== 'active' && delivery.survey.status !== 'sending') {
    throw new Error('Survey is no longer accepting responses');
  }

  // Create feedback response and update delivery in transaction
  const result = await prisma.$transaction(async (tx) => {
    const feedback = await tx.feedbackResponse.create({
      data: {
        chatId: delivery.chatId,
        rating,
        surveyId: delivery.surveyId,
        deliveryId: delivery.id,
        clientUsername: clientUsername ?? null,
      },
    });

    await tx.surveyDelivery.update({
      where: { id: deliveryId },
      data: { status: 'responded' },
    });

    // Update survey response count
    await tx.feedbackSurvey.update({
      where: { id: delivery.surveyId },
      data: {
        responseCount: { increment: 1 },
      },
    });

    // Recalculate average rating
    const avgResult = await tx.feedbackResponse.aggregate({
      where: { surveyId: delivery.surveyId },
      _avg: { rating: true },
    });

    await tx.feedbackSurvey.update({
      where: { id: delivery.surveyId },
      data: { averageRating: avgResult._avg.rating },
    });

    return feedback.id;
  });

  logger.info('Survey response recorded', {
    deliveryId,
    surveyId: delivery.surveyId,
    rating,
    feedbackId: result,
    service: 'survey-service',
  });

  return result;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get survey by ID with calculated stats
 *
 * @param surveyId - Survey UUID
 * @returns Survey with calculated response rate, or null if not found
 *
 * @example
 * ```typescript
 * const survey = await getSurveyById('survey-uuid');
 * if (survey) {
 *   console.log(`Response rate: ${survey.responseRate}%`);
 * }
 * ```
 */
export async function getSurveyById(surveyId: string): Promise<SurveyWithStats | null> {
  const survey = await prisma.feedbackSurvey.findUnique({
    where: { id: surveyId },
  });

  if (!survey) return null;

  const responseRate =
    survey.deliveredCount > 0
      ? Math.round((survey.responseCount / survey.deliveredCount) * 100 * 10) / 10
      : 0;

  return {
    ...survey,
    responseRate,
  };
}

/**
 * Get delivery by ID with relations
 *
 * @param deliveryId - Delivery UUID
 * @returns Delivery with survey and chat, or null if not found
 *
 * @example
 * ```typescript
 * const delivery = await getDeliveryById('delivery-uuid');
 * if (delivery) {
 *   console.log(`Chat: ${delivery.chat.title}`);
 * }
 * ```
 */
export async function getDeliveryById(deliveryId: string) {
  return prisma.surveyDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      survey: true,
      chat: true,
    },
  });
}

/**
 * Get pending deliveries for a survey
 *
 * Returns deliveries in 'pending' status that need to be sent.
 * Used by the delivery worker to process batches.
 *
 * @param surveyId - Survey UUID
 * @param limit - Maximum number of deliveries to return (default: 100)
 * @returns Array of pending deliveries with chat info
 *
 * @example
 * ```typescript
 * const pending = await getPendingDeliveries('survey-uuid', 50);
 * for (const delivery of pending) {
 *   await sendSurveyMessage(delivery.chat.id);
 * }
 * ```
 */
export async function getPendingDeliveries(surveyId: string, limit: number = 100) {
  return prisma.surveyDelivery.findMany({
    where: {
      surveyId,
      status: 'pending',
    },
    include: {
      chat: true,
    },
    take: limit,
  });
}

/**
 * Get deliveries needing reminder
 *
 * Returns deliveries that were delivered but not responded to,
 * and have passed the reminder threshold.
 *
 * @param surveyId - Survey UUID
 * @param reminderDay - Days after delivery to send reminder
 * @returns Array of deliveries needing reminder
 *
 * @example
 * ```typescript
 * const needReminder = await getDeliveriesNeedingReminder('survey-uuid', 3);
 * for (const delivery of needReminder) {
 *   await sendReminderMessage(delivery.chat.id);
 * }
 * ```
 */
export async function getDeliveriesNeedingReminder(surveyId: string, reminderDay: number) {
  const reminderThreshold = new Date();
  reminderThreshold.setDate(reminderThreshold.getDate() - reminderDay);

  return prisma.surveyDelivery.findMany({
    where: {
      surveyId,
      status: 'delivered',
      deliveredAt: { lte: reminderThreshold },
      reminderSentAt: null,
    },
    include: { chat: true },
  });
}

/**
 * Get all surveys with optional status filter
 *
 * @param status - Optional status filter
 * @returns Array of surveys with stats
 *
 * @example
 * ```typescript
 * const activeSurveys = await getSurveys('active');
 * const allSurveys = await getSurveys();
 * ```
 */
export async function getSurveys(status?: SurveyStatus): Promise<SurveyWithStats[]> {
  const surveys = await prisma.feedbackSurvey.findMany({
    ...(status && { where: { status } }),
    orderBy: { scheduledAt: 'desc' },
  });

  return surveys.map((survey) => ({
    ...survey,
    responseRate:
      survey.deliveredCount > 0
        ? Math.round((survey.responseCount / survey.deliveredCount) * 100 * 10) / 10
        : 0,
  }));
}

/**
 * Check and expire overdue surveys
 *
 * Finds surveys past their expiration date and updates their status.
 * Called by a scheduled job to maintain survey lifecycle.
 *
 * @returns Number of surveys expired
 *
 * @example
 * ```typescript
 * const expiredCount = await expireOverdueSurveys();
 * console.log(`Expired ${expiredCount} surveys`);
 * ```
 */
export async function expireOverdueSurveys(): Promise<number> {
  const now = new Date();

  const result = await prisma.feedbackSurvey.updateMany({
    where: {
      status: { in: ['sending', 'active'] },
      expiresAt: { lt: now },
    },
    data: {
      status: 'expired',
    },
  });

  if (result.count > 0) {
    logger.info('Surveys expired', {
      count: result.count,
      service: 'survey-service',
    });
  }

  return result.count;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  createSurvey,
  getActiveClients,
  startSurveyDelivery,
  markSurveyActive,
  closeSurvey,
  updateDeliveryStatus,
  recordResponse,
  getSurveyById,
  getDeliveryById,
  getPendingDeliveries,
  getDeliveriesNeedingReminder,
  getSurveys,
  expireOverdueSurveys,
};

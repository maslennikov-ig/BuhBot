/**
 * Client Request Management Service
 *
 * Provides CRUD operations and query methods for ClientRequest entities.
 * Used for managing SLA-tracked client messages in BuhBot.
 *
 * Features:
 * - Get requests by ID or chat
 * - Update request status
 * - Mark requests as answered
 * - Query active/pending requests
 *
 * @module services/sla/request.service
 */

import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

// Re-export Prisma types for consumers
export type ClientRequest = Awaited<ReturnType<typeof prisma.clientRequest.findUnique>>;
type RequestStatus = 'pending' | 'in_progress' | 'answered' | 'escalated';

/**
 * Data required to mark a request as responded
 */
export interface ResponseData {
  /** User ID of the responder (accountant) */
  respondedBy: string | null;
  /** Telegram message ID of the response */
  responseMessageId: bigint | null;
  /** Response timestamp (defaults to now) */
  responseAt?: Date;
  /** Calculated working minutes for response time */
  responseTimeMinutes?: number;
}

/**
 * Get a client request by its UUID
 *
 * @param requestId - UUID of the ClientRequest
 * @returns ClientRequest with chat included, or null if not found
 *
 * @example
 * ```typescript
 * const request = await getRequestById('uuid-123');
 * if (request) {
 *   console.log('Chat ID:', request.chatId);
 * }
 * ```
 */
export async function getRequestById(
  requestId: string
): Promise<ClientRequest | null> {
  try {
    return await prisma.clientRequest.findUnique({
      where: { id: requestId },
      include: {
        chat: true,
      },
    });
  } catch (error) {
    logger.error('Failed to get request by ID', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      service: 'request-service',
    });
    return null;
  }
}

/**
 * Update the status of a client request
 *
 * @param requestId - UUID of the ClientRequest
 * @param status - New status to set
 * @returns Updated ClientRequest or null on failure
 *
 * @example
 * ```typescript
 * const updated = await updateRequestStatus('uuid-123', 'in_progress');
 * ```
 */
export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus
): Promise<ClientRequest | null> {
  try {
    const updated = await prisma.clientRequest.update({
      where: { id: requestId },
      data: { status },
    });

    logger.info('Request status updated', {
      requestId,
      status,
      service: 'request-service',
    });

    return updated;
  } catch (error) {
    logger.error('Failed to update request status', {
      requestId,
      status,
      error: error instanceof Error ? error.message : String(error),
      service: 'request-service',
    });
    return null;
  }
}

/**
 * Mark a request as answered by an accountant
 *
 * Updates:
 * - status to 'answered'
 * - responseAt timestamp
 * - respondedBy user ID
 * - responseMessageId (Telegram message ID)
 * - responseTimeMinutes (working minutes calculation)
 * - slaWorkingMinutes (same as responseTimeMinutes)
 *
 * @param requestId - UUID of the ClientRequest
 * @param data - Response data including responder info
 * @returns Updated ClientRequest or null on failure
 *
 * @example
 * ```typescript
 * const updated = await markRequestAsAnswered('uuid-123', {
 *   respondedBy: 'user-uuid-456',
 *   responseMessageId: BigInt(12345),
 *   responseTimeMinutes: 45,
 * });
 * ```
 */
export async function markRequestAsAnswered(
  requestId: string,
  data: ResponseData
): Promise<ClientRequest | null> {
  try {
    const responseAt = data.responseAt ?? new Date();

    const updated = await prisma.clientRequest.update({
      where: { id: requestId },
      data: {
        status: 'answered',
        responseAt,
        respondedBy: data.respondedBy,
        responseMessageId: data.responseMessageId,
        responseTimeMinutes: data.responseTimeMinutes ?? null,
        slaWorkingMinutes: data.responseTimeMinutes ?? null,
      },
    });

    logger.info('Request marked as answered', {
      requestId,
      respondedBy: data.respondedBy,
      responseTimeMinutes: data.responseTimeMinutes,
      service: 'request-service',
    });

    return updated;
  } catch (error) {
    logger.error('Failed to mark request as answered', {
      requestId,
      data: {
        respondedBy: data.respondedBy,
        responseMessageId: data.responseMessageId?.toString(),
      },
      error: error instanceof Error ? error.message : String(error),
      service: 'request-service',
    });
    return null;
  }
}

/**
 * Get all active (not yet answered) requests
 *
 * Active requests have status: 'pending', 'in_progress', or 'escalated'
 *
 * @param chatId - Optional chat ID to filter by
 * @returns Array of active ClientRequests ordered by receivedAt (oldest first)
 *
 * @example
 * ```typescript
 * // Get all active requests
 * const allActive = await getActiveRequests();
 *
 * // Get active requests for specific chat
 * const chatActive = await getActiveRequests('123456789');
 * ```
 */
export async function getActiveRequests(
  chatId?: string
): Promise<ClientRequest[]> {
  try {
    const where: Record<string, unknown> = {
      status: { in: ['pending', 'in_progress', 'escalated'] },
    };

    if (chatId) {
      where['chatId'] = BigInt(chatId);
    }

    return await prisma.clientRequest.findMany({
      where,
      orderBy: { receivedAt: 'asc' },
      include: {
        chat: true,
      },
    });
  } catch (error) {
    logger.error('Failed to get active requests', {
      chatId,
      error: error instanceof Error ? error.message : String(error),
      service: 'request-service',
    });
    return [];
  }
}

/**
 * Get pending requests for a specific chat
 *
 * Returns requests with status 'pending' or 'escalated' for the given chat.
 * These are requests that are waiting for an accountant response.
 *
 * @param chatId - Telegram chat ID as string
 * @returns Array of pending ClientRequests ordered by receivedAt (oldest first)
 *
 * @example
 * ```typescript
 * const pending = await getPendingRequestsForChat('123456789');
 * if (pending.length > 0) {
 *   console.log('Oldest pending request:', pending[0].id);
 * }
 * ```
 */
export async function getPendingRequestsForChat(
  chatId: string
): Promise<ClientRequest[]> {
  try {
    return await prisma.clientRequest.findMany({
      where: {
        chatId: BigInt(chatId),
        status: { in: ['pending', 'in_progress', 'escalated'] },
      },
      orderBy: { receivedAt: 'asc' },
    });
  } catch (error) {
    logger.error('Failed to get pending requests for chat', {
      chatId,
      error: error instanceof Error ? error.message : String(error),
      service: 'request-service',
    });
    return [];
  }
}

/**
 * Get request by chat ID and message ID
 *
 * Finds a request using the Telegram chat ID and message ID.
 * Used for matching responses to original requests.
 *
 * @param chatId - Telegram chat ID
 * @param messageId - Telegram message ID
 * @returns ClientRequest or null if not found
 *
 * @example
 * ```typescript
 * const request = await getRequestByMessage(123456789n, 42n);
 * if (request && request.status !== 'answered') {
 *   // This request needs a response
 * }
 * ```
 */
export async function getRequestByMessage(
  chatId: bigint,
  messageId: bigint
): Promise<ClientRequest | null> {
  try {
    return await prisma.clientRequest.findFirst({
      where: {
        chatId,
        messageId,
      },
      include: {
        chat: true,
      },
    });
  } catch (error) {
    logger.error('Failed to get request by message', {
      chatId: chatId.toString(),
      messageId: messageId.toString(),
      error: error instanceof Error ? error.message : String(error),
      service: 'request-service',
    });
    return null;
  }
}

/**
 * Find the oldest pending request in a chat
 *
 * Returns the oldest request that hasn't been answered yet.
 * Used for FIFO-style response matching when no explicit reply.
 *
 * @param chatId - Telegram chat ID as string
 * @returns Oldest pending ClientRequest or null if none found
 *
 * @example
 * ```typescript
 * const oldest = await findOldestPendingRequest('123456789');
 * if (oldest) {
 *   await markRequestAsAnswered(oldest.id, { respondedBy: 'user-id' });
 * }
 * ```
 */
export async function findOldestPendingRequest(
  chatId: string
): Promise<ClientRequest | null> {
  try {
    return await prisma.clientRequest.findFirst({
      where: {
        chatId: BigInt(chatId),
        status: { in: ['pending', 'in_progress', 'escalated'] },
      },
      orderBy: { receivedAt: 'asc' },
      include: {
        chat: true,
      },
    });
  } catch (error) {
    logger.error('Failed to find oldest pending request', {
      chatId,
      error: error instanceof Error ? error.message : String(error),
      service: 'request-service',
    });
    return null;
  }
}

export default {
  getRequestById,
  updateRequestStatus,
  markRequestAsAnswered,
  getActiveRequests,
  getPendingRequestsForChat,
  getRequestByMessage,
  findOldestPendingRequest,
};

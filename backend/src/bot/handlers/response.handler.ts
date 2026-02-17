/**
 * Response Handler for Accountant Replies
 *
 * Detects when an accountant responds to a client message and stops the SLA timer.
 *
 * Detection Logic:
 * 1. Check if message is from an accountant (by Telegram username or user mapping)
 * 2. Check if message is a reply to a tracked client request
 * 3. If direct reply: stop SLA timer for that specific request
 * 4. If not a reply: stop the latest pending request in the chat (LIFO)
 *
 * Edge Cases Handled:
 * - Response outside working hours (still recorded, working minutes calculated)
 * - Multiple pending requests (LIFO resolution - most recent first)
 * - Reply to non-tracked message (no action)
 * - Non-accountant messages (ignored)
 *
 * @module bot/handlers/response.handler
 */

import type { RequestStatus } from '@prisma/client';
import { message } from 'telegraf/filters';
import { bot, BotContext } from '../bot.js';
import { prisma } from '../../lib/prisma.js';
import { stopSlaTimer } from '../../services/sla/timer.service.js';
import {
  getRequestByMessage,
  findLatestPendingRequest,
  type ClientRequest,
} from '../../services/sla/request.service.js';
import logger from '../../utils/logger.js';

/**
 * Check if a user is the assigned accountant for a chat
 *
 * Matches by:
 * 0. Telegram ID in chat.accountantTelegramIds array (secure, immutable)
 * 1. Telegram ID matches assignedAccountant.telegramId from User table
 * 2. Telegram username in chat.accountantUsernames array (fallback)
 * 3. Telegram username matches assignedAccountant.telegramUsername (fallback)
 *
 * @param chatId - Telegram chat ID
 * @param username - Telegram username of the sender (without @)
 * @param telegramUserId - Telegram user ID of the sender
 * @returns True if user is an accountant for this chat
 */
export async function isAccountantForChat(
  chatId: bigint,
  username: string | undefined,
  telegramUserId: number
): Promise<{ isAccountant: boolean; accountantId: string | null }> {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        assignedAccountant: true,
      },
    });

    if (!chat) {
      logger.debug('Chat not found in database', {
        chatId: chatId.toString(),
        service: 'response-handler',
      });
      return { isAccountant: false, accountantId: null };
    }

    // Log chat configuration for debugging
    logger.debug('Chat configuration for accountant check', {
      chatId: chatId.toString(),
      accountantUsernames: chat.accountantUsernames,
      assignedAccountantId: chat.assignedAccountantId,
      assignedAccountantTelegramUsername: chat.assignedAccountant?.telegramUsername,
      assignedAccountantTelegramId: chat.assignedAccountant?.telegramId?.toString(),
      senderUsername: username,
      senderTelegramId: telegramUserId,
      service: 'response-handler',
    });

    // === SECURE CHECKS (Telegram ID-based, immutable) ===

    // Check 0: Telegram ID in accountantTelegramIds array (gh-68, secure multi-accountant)
    if (telegramUserId && chat.accountantTelegramIds && chat.accountantTelegramIds.length > 0) {
      const senderTgId = BigInt(telegramUserId);
      const isInIdsList = chat.accountantTelegramIds.some((id) => id === senderTgId);

      logger.debug('Checking accountantTelegramIds array match', {
        chatId: chatId.toString(),
        senderTelegramId: senderTgId.toString(),
        accountantTelegramIdsCount: chat.accountantTelegramIds.length,
        isInIdsList,
        service: 'response-handler',
      });

      if (isInIdsList) {
        logger.info('Accountant matched by accountantTelegramIds array (Check 0)', {
          chatId: chatId.toString(),
          telegramUserId,
          matchedCheck: 'accountantTelegramIds_array',
          service: 'response-handler',
        });
        return {
          isAccountant: true,
          accountantId: chat.assignedAccountantId,
        };
      }
    }

    // Check 1: Telegram ID matches assignedAccountant.telegramId from User table
    if (telegramUserId && chat.assignedAccountant?.telegramId) {
      const senderTgId = BigInt(telegramUserId);
      const accountantTgId = chat.assignedAccountant.telegramId;

      logger.debug('Checking assignedAccountant.telegramId match', {
        chatId: chatId.toString(),
        senderTelegramId: senderTgId.toString(),
        accountantTelegramId: accountantTgId.toString(),
        matches: senderTgId === accountantTgId,
        service: 'response-handler',
      });

      if (senderTgId === accountantTgId) {
        logger.info('Accountant matched by assignedAccountant.telegramId (Check 1)', {
          chatId: chatId.toString(),
          telegramUserId,
          matchedCheck: 'assignedAccountant_telegramId',
          service: 'response-handler',
        });
        return {
          isAccountant: true,
          accountantId: chat.assignedAccountantId,
        };
      }
    }

    // === FALLBACK CHECKS (username-based, less secure) ===

    // Check 2: Username in accountantUsernames array (fallback for unconfigured IDs)
    if (username && chat.accountantUsernames && chat.accountantUsernames.length > 0) {
      const normalizedSenderUsername = username.replace(/^@/, '').toLowerCase();

      const isInAccountantsList = chat.accountantUsernames.some(
        (acc) => acc.replace(/^@/, '').toLowerCase() === normalizedSenderUsername
      );

      logger.debug('Checking accountantUsernames array match (fallback)', {
        chatId: chatId.toString(),
        accountantUsernames: chat.accountantUsernames,
        normalizedSenderUsername,
        isInAccountantsList,
        service: 'response-handler',
      });

      if (isInAccountantsList) {
        logger.info('Accountant matched by accountantUsernames array (Check 2, fallback)', {
          chatId: chatId.toString(),
          username,
          matchedCheck: 'accountantUsernames_array',
          service: 'response-handler',
        });
        return {
          isAccountant: true,
          accountantId: chat.assignedAccountantId,
        };
      }
    }

    // Check 3: Username matches assignedAccountant.telegramUsername from User table (fallback)
    if (username && chat.assignedAccountant?.telegramUsername) {
      const normalizedAccountantUsername = chat.assignedAccountant.telegramUsername
        .replace(/^@/, '')
        .toLowerCase();
      const normalizedSenderUsername = username.replace(/^@/, '').toLowerCase();

      logger.debug('Checking assignedAccountant.telegramUsername match (Check 3, fallback)', {
        chatId: chatId.toString(),
        normalizedAccountantUsername,
        normalizedSenderUsername,
        matches: normalizedAccountantUsername === normalizedSenderUsername,
        service: 'response-handler',
      });

      if (normalizedAccountantUsername === normalizedSenderUsername) {
        logger.info(
          'Accountant matched by assignedAccountant.telegramUsername (Check 3, fallback)',
          {
            chatId: chatId.toString(),
            username,
            matchedCheck: 'assignedAccountant_telegramUsername',
            service: 'response-handler',
          }
        );
        return {
          isAccountant: true,
          accountantId: chat.assignedAccountantId,
        };
      }
    }

    logger.debug('No accountant match found', {
      chatId: chatId.toString(),
      username,
      telegramUserId,
      service: 'response-handler',
    });
    return { isAccountant: false, accountantId: null };
  } catch (error) {
    logger.error('Error checking if user is accountant', {
      chatId: chatId.toString(),
      username,
      telegramUserId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: 'response-handler',
    });
    return { isAccountant: false, accountantId: null };
  }
}

/**
 * Register the response handler for accountant replies
 *
 * Listens for text messages in groups and supergroups.
 * Detects accountant responses and stops SLA timers.
 *
 * Handler priority note:
 * This handler should be registered AFTER the message handler
 * so that new client messages are processed first.
 *
 * @example
 * ```typescript
 * import { registerResponseHandler } from './handlers/response.handler.js';
 *
 * // Register handler before launching bot
 * registerResponseHandler();
 * bot.launch();
 * ```
 */
export function registerResponseHandler(): void {
  // Use message('text') filter for text messages only
  bot.on(message('text'), async (ctx: BotContext) => {
    // Type guard for text messages
    if (!ctx.message || !('text' in ctx.message)) {
      return;
    }

    // Only process messages from groups and supergroups
    if (!ctx.chat || !['group', 'supergroup'].includes(ctx.chat.type)) {
      return;
    }

    const chatId = ctx.chat.id;
    const messageId = ctx.message.message_id;
    const messageText = ctx.message.text;
    const username = ctx.from?.username;
    const telegramUserId = ctx.from?.id;
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;

    // Log all incoming messages for debugging (truncate long messages)
    logger.debug('Processing message in response handler', {
      chatId,
      messageId,
      username,
      telegramUserId,
      firstName,
      lastName,
      textPreview: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
      textLength: messageText.length,
      service: 'response-handler',
    });

    if (!telegramUserId) {
      logger.warn('Message without telegramUserId, skipping', {
        chatId,
        messageId,
        service: 'response-handler',
      });
      return;
    }

    try {
      // 1. Check if this is an accountant's message
      const { isAccountant, accountantId } = await isAccountantForChat(
        BigInt(chatId),
        username,
        telegramUserId
      );

      logger.debug('Accountant check result', {
        chatId,
        messageId,
        isAccountant,
        accountantId,
        checkedUsername: username,
        checkedTelegramUserId: telegramUserId,
        service: 'response-handler',
      });

      if (!isAccountant) {
        // Not an accountant, skip response processing
        // (Message handler will process client messages)
        logger.debug('Not an accountant message, skipping response processing', {
          chatId,
          messageId,
          username,
          telegramUserId,
          service: 'response-handler',
        });
        return;
      }

      logger.info('Accountant message detected', {
        chatId,
        messageId,
        username,
        telegramUserId,
        accountantId,
        textPreview: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
        service: 'response-handler',
      });

      // 2. Check if this is a reply to a specific message
      const replyToMessage = ctx.message.reply_to_message;
      let requestToResolve: ClientRequest | null = null;

      if (replyToMessage) {
        // Try to find the request being replied to
        requestToResolve = await getRequestByMessage(
          BigInt(chatId),
          BigInt(replyToMessage.message_id)
        );

        if (requestToResolve) {
          // Check if the request is still pending
          if (requestToResolve.status === 'answered') {
            logger.debug('Replied to already answered request, ignoring', {
              chatId,
              requestId: requestToResolve.id,
              service: 'response-handler',
            });
            return;
          }

          logger.info('Found request from reply', {
            chatId,
            requestId: requestToResolve.id,
            replyToMessageId: replyToMessage.message_id,
            service: 'response-handler',
          });
        }
      }

      // 3. If no reply or reply not to a tracked message, find latest pending request (LIFO)
      if (!requestToResolve) {
        requestToResolve = await findLatestPendingRequest(String(chatId));

        if (!requestToResolve) {
          logger.debug('No pending requests in chat to resolve', {
            chatId,
            service: 'response-handler',
          });
          return;
        }

        logger.info('Resolving latest pending request (LIFO)', {
          chatId,
          requestId: requestToResolve.id,
          service: 'response-handler',
        });
      }

      // 4. Update the existing ChatMessage with resolvedRequestId
      // (Message was already logged by message handler with correct isAccountant=true)
      try {
        await prisma.chatMessage.updateMany({
          where: {
            chatId: BigInt(chatId),
            messageId: BigInt(messageId),
          },
          data: {
            resolvedRequestId: requestToResolve.id,
          },
        });

        logger.info('ChatMessage updated with resolvedRequestId', {
          chatId,
          messageId,
          requestId: requestToResolve.id,
          service: 'response-handler',
        });
      } catch (updateError) {
        logger.warn('Failed to update ChatMessage with resolvedRequestId', {
          chatId,
          messageId,
          error: updateError instanceof Error ? updateError.message : String(updateError),
          service: 'response-handler',
        });
      }

      // 5. Atomically claim the request to prevent race condition (gh-116)
      // Only proceed if the request is still in a non-terminal state
      const CLAIMABLE_STATES: RequestStatus[] = [
        'pending',
        'in_progress',
        'waiting_client',
        'transferred',
        'escalated',
      ];
      const claimed = await prisma.clientRequest.updateMany({
        where: {
          id: requestToResolve.id,
          status: { in: CLAIMABLE_STATES },
        },
        data: { status: 'answered' },
      });

      if (claimed.count === 0) {
        logger.info('Request already resolved by another response, skipping', {
          chatId,
          requestId: requestToResolve.id,
          service: 'response-handler',
        });
        return;
      }

      // 6. Stop the SLA timer (request is now claimed)
      const result = await stopSlaTimer(requestToResolve.id, {
        respondedBy: accountantId,
        responseMessageId: messageId,
      });

      logger.info('SLA timer stopped by accountant response', {
        chatId,
        requestId: requestToResolve.id,
        accountantUsername: username,
        accountantId,
        responseMessageId: messageId,
        workingMinutes: result.workingMinutes,
        breached: result.breached,
        service: 'response-handler',
      });
    } catch (error) {
      logger.error('Error in response handler', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        chatId,
        messageId,
        service: 'response-handler',
      });
    }
  });

  logger.info('Response handler registered', { service: 'response-handler' });
}

export default registerResponseHandler;

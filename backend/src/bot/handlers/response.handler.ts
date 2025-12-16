/**
 * Response Handler for Accountant Replies
 *
 * Detects when an accountant responds to a client message and stops the SLA timer.
 *
 * Detection Logic:
 * 1. Check if message is from an accountant (by Telegram username or user mapping)
 * 2. Check if message is a reply to a tracked client request
 * 3. If direct reply: stop SLA timer for that specific request
 * 4. If not a reply: stop the oldest pending request in the chat (FIFO)
 *
 * Edge Cases Handled:
 * - Response outside working hours (still recorded, working minutes calculated)
 * - Multiple pending requests (FIFO resolution)
 * - Reply to non-tracked message (no action)
 * - Non-accountant messages (ignored)
 *
 * @module bot/handlers/response.handler
 */

import { message } from 'telegraf/filters';
import { bot, BotContext } from '../bot.js';
import { prisma } from '../../lib/prisma.js';
import { stopSlaTimer } from '../../services/sla/timer.service.js';
import {
  getRequestByMessage,
  findOldestPendingRequest,
  type ClientRequest,
} from '../../services/sla/request.service.js';
import logger from '../../utils/logger.js';

/**
 * Check if a user is the assigned accountant for a chat
 *
 * Matches by:
 * 1. Telegram username matches chat.accountantUsername
 * 2. User is mapped to chat.assignedAccountantId via User table
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
      return { isAccountant: false, accountantId: null };
    }

    // Check 1: Username matches accountantUsername field
    if (username && chat.accountantUsername) {
      // Normalize usernames (remove @ if present)
      const normalizedChatUsername = chat.accountantUsername.replace(/^@/, '').toLowerCase();
      const normalizedSenderUsername = username.replace(/^@/, '').toLowerCase();

      if (normalizedChatUsername === normalizedSenderUsername) {
        return {
          isAccountant: true,
          accountantId: chat.assignedAccountantId,
        };
      }
    }

    // Check 2: User has assignedAccountant relationship
    // This requires a mapping between Telegram ID and User table
    // For now, we only support username-based matching
    // TODO: Implement Telegram ID to User mapping when user registration is added

    return { isAccountant: false, accountantId: null };
  } catch (error) {
    logger.error('Error checking if user is accountant', {
      chatId: chatId.toString(),
      username,
      telegramUserId,
      error: error instanceof Error ? error.message : String(error),
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
    const username = ctx.from?.username;
    const telegramUserId = ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    try {
      // 1. Check if this is an accountant's message
      const { isAccountant, accountantId } = await isAccountantForChat(
        BigInt(chatId),
        username,
        telegramUserId
      );

      if (!isAccountant) {
        // Not an accountant, skip response processing
        // (Message handler will process client messages)
        return;
      }

      logger.debug('Accountant message detected', {
        chatId,
        messageId,
        username,
        accountantId,
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

      // 3. If no reply or reply not to a tracked message, find oldest pending request
      if (!requestToResolve) {
        requestToResolve = await findOldestPendingRequest(String(chatId));

        if (!requestToResolve) {
          logger.debug('No pending requests in chat to resolve', {
            chatId,
            service: 'response-handler',
          });
          return;
        }

        logger.info('Resolving oldest pending request (FIFO)', {
          chatId,
          requestId: requestToResolve.id,
          service: 'response-handler',
        });
      }

      // 4. Stop the SLA timer
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

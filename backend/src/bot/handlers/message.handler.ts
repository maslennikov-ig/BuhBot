/**
 * Message Handler for SLA Monitoring
 *
 * Processes incoming text messages from Telegram groups:
 * 1. Filters for group/supergroup messages only
 * 2. Checks if SLA monitoring is enabled for the chat
 * 3. Classifies messages using AI/keyword classifier
 * 4. Creates ClientRequest records for REQUEST messages
 * 5. Starts SLA timer for tracking response time
 *
 * Non-REQUEST classifications (SPAM, GRATITUDE, CLARIFICATION) are logged
 * but do not trigger SLA tracking.
 *
 * @module bot/handlers/message.handler
 */

import { message } from 'telegraf/filters';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { bot, BotContext } from '../bot.js';
import { prisma } from '../../lib/prisma.js';
import { classifyMessage } from '../../services/classifier/index.js';
import { startSlaTimer } from '../../services/sla/timer.service.js';
import { isAccountantForChat } from './response.handler.js';
import logger from '../../utils/logger.js';

/**
 * Zod schema for validating incoming Telegram message data
 * Prevents XSS and validates field lengths before database insertion
 */
const TelegramMessageSchema = z.object({
  text: z.string().min(1).max(10000),
  username: z.string().max(255).optional().nullable(),
  firstName: z.string().max(255).optional().nullable(),
  lastName: z.string().max(255).optional().nullable(),
});

/**
 * Register the message handler for SLA monitoring
 *
 * Listens for text messages in groups and supergroups only.
 * Private messages are ignored for SLA tracking.
 *
 * @example
 * ```typescript
 * import { registerMessageHandler } from './handlers/message.handler.js';
 *
 * // Register handler before launching bot
 * registerMessageHandler();
 * bot.launch();
 * ```
 */
export function registerMessageHandler(): void {
  // Use message('text') filter for text messages only
  // Note: next() is called to allow response.handler to also process messages
  bot.on(message('text'), async (ctx: BotContext, next: () => Promise<void>) => {
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
    const text = ctx.message.text;
    const username = ctx.from?.username;

    logger.debug('Processing incoming message', {
      chatId,
      messageId,
      textLength: text.length,
      username,
      chatType: ctx.chat.type,
      service: 'message-handler',
    });

    try {
      // 1. Get chat configuration from database
      const chat = await prisma.chat.findUnique({
        where: { id: BigInt(chatId) },
      });

      // Skip if chat not registered or monitoring disabled
      if (!chat) {
        logger.debug('Chat not registered, skipping SLA monitoring', {
          chatId,
          service: 'message-handler',
        });
        return;
      }

      if (!chat.slaEnabled || !chat.monitoringEnabled) {
        logger.debug('SLA or monitoring disabled for chat', {
          chatId,
          slaEnabled: chat.slaEnabled,
          monitoringEnabled: chat.monitoringEnabled,
          service: 'message-handler',
        });
        return;
      }

      // 2. Check if sender is accountant FIRST (before logging)
      const { isAccountant, accountantId } = await isAccountantForChat(
        BigInt(chatId),
        username,
        ctx.from?.id ?? 0
      );

      // 3. Validate input data before database insertion
      const validationResult = TelegramMessageSchema.safeParse({
        text,
        username: ctx.from?.username ?? null,
        firstName: ctx.from?.first_name ?? null,
        lastName: ctx.from?.last_name ?? null,
      });

      if (!validationResult.success) {
        logger.warn('Invalid message data, skipping', {
          chatId,
          messageId,
          errors: validationResult.error.flatten(),
          service: 'message-handler',
        });
        return;
      }

      // 4. Log ALL messages to ChatMessage table with CORRECT isAccountant flag
      try {
        await prisma.chatMessage.upsert({
          where: {
            unique_chat_message: {
              chatId: BigInt(chatId),
              messageId: BigInt(messageId),
            },
          },
          create: {
            chatId: BigInt(chatId),
            messageId: BigInt(messageId),
            telegramUserId: BigInt(ctx.from?.id ?? 0),
            username: ctx.from?.username ?? null,
            firstName: ctx.from?.first_name ?? null,
            lastName: ctx.from?.last_name ?? null,
            messageText: text,
            isAccountant: isAccountant, // Correct flag from accountant check
            replyToMessageId: ctx.message.reply_to_message?.message_id
              ? BigInt(ctx.message.reply_to_message.message_id)
              : null,
          },
          update: {
            isAccountant: isAccountant, // Update if message is being re-processed
          },
        });

        logger.debug('Message logged to ChatMessage', {
          chatId,
          messageId,
          isAccountant,
          service: 'message-handler',
        });
      } catch (logError) {
        if (logError instanceof Prisma.PrismaClientKnownRequestError) {
          logger.error('Database error logging message', {
            chatId,
            messageId,
            code: logError.code,
            error: logError.message,
            service: 'message-handler',
          });
        } else {
          logger.warn('Failed to log message to ChatMessage', {
            chatId,
            messageId,
            error: logError instanceof Error ? logError.message : String(logError),
            service: 'message-handler',
          });
        }
      }

      // 5. If accountant, pass to response handler (don't process as client message)
      if (isAccountant) {
        logger.debug('Accountant message detected, skipping classification', {
          chatId,
          messageId,
          username,
          accountantId,
          service: 'message-handler',
        });
        // Pass to response handler to stop SLA timer
        return next();
      }

      // 6. Classify message using AI/keyword classifier
      const classification = await classifyMessage(prisma, text);

      logger.info('Message classified', {
        chatId,
        messageId,
        classification: classification.classification,
        confidence: classification.confidence,
        model: classification.model,
        service: 'message-handler',
      });

      // 7. Only create ClientRequest for REQUEST and CLARIFICATION
      if (!['REQUEST', 'CLARIFICATION'].includes(classification.classification)) {
        logger.debug('Non-actionable message, not creating ClientRequest', {
          chatId,
          messageId,
          classification: classification.classification,
          service: 'message-handler',
        });
        return;
      }

      // 8. Create ClientRequest record (only for REQUEST/CLARIFICATION)
      const request = await prisma.clientRequest.create({
        data: {
          chatId: BigInt(chatId),
          messageId: BigInt(messageId),
          messageText: text,
          clientUsername: username ?? null,
          classification: classification.classification,
          classificationScore: classification.confidence,
          classificationModel: classification.model,
          // Set status based on classification
          // REQUEST: pending (needs response)
          // CLARIFICATION: answered (no SLA tracking for follow-ups)
          status: classification.classification === 'REQUEST' ? 'pending' : 'answered',
          receivedAt: new Date(ctx.message.date * 1000),
        },
      });

      logger.info('ClientRequest created', {
        requestId: request.id,
        chatId,
        messageId,
        classification: classification.classification,
        service: 'message-handler',
      });

      // 9. Start SLA timer for REQUEST messages only
      if (classification.classification === 'REQUEST') {
        const thresholdMinutes = chat.slaThresholdMinutes ?? 60;

        await startSlaTimer(request.id, String(chatId), thresholdMinutes);

        logger.info('SLA timer started for request', {
          requestId: request.id,
          chatId,
          thresholdMinutes,
          service: 'message-handler',
        });
      } else {
        logger.debug('Non-REQUEST message, SLA timer not started', {
          requestId: request.id,
          chatId,
          classification: classification.classification,
          service: 'message-handler',
        });
      }
    } catch (error) {
      logger.error('Error processing message', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        chatId,
        messageId,
        service: 'message-handler',
      });
    }

    // Always pass to next handler (response handler)
    await next();
  });

  logger.info('Message handler registered', { service: 'message-handler' });
}

export default registerMessageHandler;

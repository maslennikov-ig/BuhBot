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
import { bot, BotContext } from '../bot.js';
import { prisma } from '../../lib/prisma.js';
import { classifyMessage } from '../../services/classifier/index.js';
import { startSlaTimer } from '../../services/sla/timer.service.js';
import logger from '../../utils/logger.js';

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

      // 2. Classify message using AI/keyword classifier
      const classification = await classifyMessage(prisma, text);

      logger.info('Message classified', {
        chatId,
        messageId,
        classification: classification.classification,
        confidence: classification.confidence,
        model: classification.model,
        service: 'message-handler',
      });

      // 3. Create ClientRequest record
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
          // Others: answered (no response needed)
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

      // 4. Start SLA timer for REQUEST messages only
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
  });

  logger.info('Message handler registered', { service: 'message-handler' });
}

export default registerMessageHandler;

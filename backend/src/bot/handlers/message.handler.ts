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

import { createHash, randomUUID } from 'node:crypto';
import { message } from 'telegraf/filters';
import { Prisma } from '@prisma/client';
import { bot, BotContext } from '../bot.js';
import { TelegramMessageSchema } from '../utils/telegram-schemas.js';
import { prisma } from '../../lib/prisma.js';
import { classifyMessage } from '../../services/classifier/index.js';
import { startSlaTimer } from '../../services/sla/timer.service.js';
import { isAccountantForChat } from './response.handler.js';
import logger from '../../utils/logger.js';
import { getTracer } from '../../lib/tracing.js';

/** Time window for deduplication: 5 minutes (gh-66) */
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Create a SHA-256 hash of normalized message text for deduplication.
 * Normalization: lowercase, trim, collapse whitespace.
 */
function hashMessageContent(text: string): string {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
  return createHash('sha256').update(normalized).digest('hex');
}

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
      // 1. Get chat configuration from database (auto-register if missing)
      let chat = await prisma.chat.findUnique({
        where: { id: BigInt(chatId) },
      });

      // Auto-register chat if not found (gh-55: ensures chats appear in admin panel)
      if (!chat) {
        const chatType = ctx.chat.type as 'group' | 'supergroup';
        const title = 'title' in ctx.chat ? (ctx.chat.title as string) : null;

        logger.info('Auto-registering unregistered chat', {
          chatId,
          title,
          chatType,
          service: 'message-handler',
        });

        chat = await prisma.chat.upsert({
          where: { id: BigInt(chatId) },
          create: {
            id: BigInt(chatId),
            chatType,
            title,
            slaEnabled: false, // Disabled by default; admin enables manually
            monitoringEnabled: true,
          },
          update: {
            title, // Update title if race condition
            deletedAt: null, // Clear soft-delete if re-registered (gh-209)
          },
        });
      }

      // 2. Check if sender is accountant FIRST (before logging)
      let isAccountant = false;
      let accountantId: string | null = null;
      try {
        const result = await isAccountantForChat(BigInt(chatId), username, ctx.from?.id ?? 0);
        isAccountant = result.isAccountant;
        accountantId = result.accountantId;
      } catch (accountantError) {
        logger.warn('[TRANSIENT_ERROR] isAccountantForChat failed, defaulting to false', {
          chatId,
          messageId,
          username,
          error:
            accountantError instanceof Error ? accountantError.message : String(accountantError),
          service: 'message-handler',
        });
      }

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

      // 4. Log ALL messages to ChatMessage table regardless of monitoringEnabled (gh-185)
      // Append-only: insert with skipDuplicates (ON CONFLICT DO NOTHING)
      try {
        await prisma.chatMessage.createMany({
          data: [
            {
              chatId: BigInt(chatId),
              messageId: BigInt(messageId),
              telegramUserId: BigInt(ctx.from?.id ?? 0),
              username: ctx.from?.username ?? null,
              firstName: ctx.from?.first_name ?? null,
              lastName: ctx.from?.last_name ?? null,
              messageText: text,
              isAccountant: isAccountant,
              replyToMessageId: ctx.message.reply_to_message?.message_id
                ? BigInt(ctx.message.reply_to_message.message_id)
                : null,
              telegramDate: new Date(ctx.message.date * 1000),
              editVersion: 0,
              messageType: 'text',
            },
          ],
          skipDuplicates: true,
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

      // 5. Skip SLA processing for soft-deleted chats (gh-209)
      // Messages are still logged above for data integrity
      if (chat.deletedAt) {
        logger.debug('Chat is soft-deleted, message logged but skipping SLA', {
          chatId,
          service: 'message-handler',
        });
        return next();
      }

      // 6. Check monitoringEnabled AFTER logging — messages are always persisted,
      // but SLA classification only runs when monitoring is active (gh-185)
      if (!chat.monitoringEnabled) {
        logger.debug('Monitoring disabled for chat, message logged but skipping SLA', {
          chatId,
          service: 'message-handler',
        });
        return next();
      }

      // 7. Skip SLA classification for FAQ-handled messages (gh-185)
      if (ctx.state.faqHandled) {
        logger.debug('FAQ-handled message, skipping SLA classification', {
          chatId,
          messageId,
          service: 'message-handler',
        });
        return next();
      }

      // 8. Check if SLA is enabled AFTER logging message (messages are always logged)
      if (!chat.slaEnabled) {
        logger.debug('SLA disabled for chat, message logged but skipping classification', {
          chatId,
          messageId,
          slaEnabled: chat.slaEnabled,
          service: 'message-handler',
        });
        return;
      }

      // 9. If accountant, pass to response handler (don't process as client message)
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

      // 10. Classify message using AI/keyword classifier
      const tracer = getTracer('message-handler');
      const classifySpan = tracer.startSpan('classify_message', {
        attributes: { 'chat.id': chatId, 'message.id': messageId },
      });
      let classification;
      try {
        classification = await classifyMessage(prisma, text);
        classifySpan.setAttribute('classification.result', classification.classification);
        classifySpan.setAttribute('classification.confidence', classification.confidence);
        classifySpan.setAttribute('classification.model', classification.model);
      } finally {
        classifySpan.end(); // Always end span, even on error (gh-168)
      }

      logger.info('Message classified', {
        chatId,
        messageId,
        classification: classification.classification,
        confidence: classification.confidence,
        model: classification.model,
        service: 'message-handler',
      });

      // 11. Only create ClientRequest for REQUEST and CLARIFICATION
      if (!['REQUEST', 'CLARIFICATION'].includes(classification.classification)) {
        logger.debug('Non-actionable message, not creating ClientRequest', {
          chatId,
          messageId,
          classification: classification.classification,
          service: 'message-handler',
        });
        return;
      }

      // 12. Deduplication check (gh-66)
      const contentHash = hashMessageContent(text);
      const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);

      const existingRequest = await prisma.clientRequest.findFirst({
        where: {
          chatId: BigInt(chatId),
          contentHash,
          receivedAt: { gte: dedupCutoff },
          status: { in: ['pending', 'in_progress', 'answered'] },
        },
        select: { id: true },
        orderBy: { receivedAt: 'desc' },
      });

      if (existingRequest) {
        logger.info('Duplicate request detected, skipping', {
          chatId,
          messageId,
          existingRequestId: existingRequest.id,
          contentHash: contentHash.substring(0, 12),
          service: 'message-handler',
        });
        return;
      }

      // 13. Thread detection via reply_to_message (gh-75)
      let threadId: string | null = null;
      let parentMessageId: bigint | null = null;
      const replyToMessage = ctx.message.reply_to_message;

      if (replyToMessage) {
        parentMessageId = BigInt(replyToMessage.message_id);

        // Find parent request by message ID in same chat
        const parentRequest = await prisma.clientRequest.findFirst({
          where: {
            chatId: BigInt(chatId),
            messageId: parentMessageId,
          },
          select: { threadId: true, id: true },
        });

        if (parentRequest) {
          if (parentRequest.threadId) {
            // Join existing thread
            threadId = parentRequest.threadId;
          } else {
            // Start new thread from parent atomically (gh-115)
            // Use updateMany with threadId IS NULL condition to prevent race
            threadId = randomUUID();
            const updated = await prisma.clientRequest.updateMany({
              where: { id: parentRequest.id, threadId: null },
              data: { threadId },
            });

            // If another concurrent request already set threadId, use theirs
            if (updated.count === 0) {
              const refreshed = await prisma.clientRequest.findUnique({
                where: { id: parentRequest.id },
                select: { threadId: true },
              });

              if (!refreshed) {
                // Parent deleted between checks — start standalone thread (CR finding #7)
                logger.warn('Parent request deleted during thread creation', {
                  parentRequestId: parentRequest.id,
                  service: 'message-handler',
                });
                threadId = randomUUID();
              } else {
                threadId = refreshed.threadId ?? randomUUID();
              }
            }
          }
        }
      }

      // If not part of any thread, create a standalone thread
      if (!threadId) {
        threadId = randomUUID();
      }

      // 14. Create ClientRequest record (only for REQUEST/CLARIFICATION)
      const request = await prisma.clientRequest.create({
        data: {
          chatId: BigInt(chatId),
          messageId: BigInt(messageId),
          messageText: text,
          clientUsername: username ?? null,
          classification: classification.classification,
          classificationScore: classification.confidence,
          classificationModel: classification.model,
          contentHash,
          threadId,
          parentMessageId,
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

      // 15. Start SLA timer for REQUEST messages only
      if (classification.classification === 'REQUEST') {
        const thresholdMinutes = chat.slaThresholdMinutes ?? 60;

        const slaSpan = tracer.startSpan('start_sla_timer', {
          attributes: {
            'request.id': request.id,
            'chat.id': chatId,
            'sla.threshold_minutes': thresholdMinutes,
          },
        });
        try {
          await startSlaTimer(request.id, String(chatId), thresholdMinutes);
        } finally {
          slaSpan.end(); // Always end span (gh-168)
        }

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

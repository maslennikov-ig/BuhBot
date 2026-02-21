/**
 * FAQ Handler for Auto-Responses
 *
 * Intercepts incoming text messages and checks for FAQ matches.
 * If a match is found, automatically replies with the FAQ answer
 * and returns early (stops message propagation).
 *
 * Registration Order:
 * This handler MUST be registered BEFORE message.handler to intercept
 * messages before SLA tracking begins. If FAQ matches, the message
 * is considered "handled" and won't trigger SLA timers.
 *
 * Flow:
 * 1. Listen for text messages in groups/supergroups
 * 2. Call findMatchingFAQ(message.text)
 * 3. If match found:
 *    - Reply with answer
 *    - Increment usage count
 *    - Set faqHandled flag and call next() for ChatMessage logging
 * 4. If no match, call next() to pass to other handlers
 *
 * @module bot/handlers/faq
 */

import { message } from 'telegraf/filters';
import { bot, BotContext } from '../bot.js';
import { findMatchingFAQ, incrementUsageCount } from '../../services/faq/matcher.service.js';
import logger from '../../utils/logger.js';

/**
 * Register the FAQ auto-response handler
 *
 * IMPORTANT: Must be registered BEFORE message.handler to intercept
 * messages before SLA tracking.
 *
 * @example
 * ```typescript
 * import { registerFaqHandler } from './handlers/faq.handler.js';
 * import { registerMessageHandler } from './handlers/message.handler.js';
 *
 * // Register FAQ handler FIRST
 * registerFaqHandler();
 *
 * // Then register message handler
 * registerMessageHandler();
 * ```
 */
export function registerFaqHandler(): void {
  bot.on(message('text'), async (ctx: BotContext, next) => {
    // Type guard for text messages
    if (!ctx.message || !('text' in ctx.message)) {
      return next();
    }

    // Only process messages from groups and supergroups
    if (!ctx.chat || !['group', 'supergroup'].includes(ctx.chat.type)) {
      return next();
    }

    const chatId = ctx.chat.id;
    const messageId = ctx.message.message_id;
    const text = ctx.message.text;
    const username = ctx.from?.username;

    logger.debug('FAQ handler processing message', {
      chatId,
      messageId,
      textLength: text.length,
      service: 'faq-handler',
    });

    try {
      // Check for FAQ match
      const match = await findMatchingFAQ(text);

      if (!match) {
        // No match - pass to next handler (message.handler)
        logger.debug('No FAQ match, passing to next handler', {
          chatId,
          messageId,
          service: 'faq-handler',
        });
        return next();
      }

      // Match found - send auto-response
      logger.info('FAQ match found, sending auto-response', {
        chatId,
        messageId,
        faqId: match.faqId,
        score: match.score,
        username,
        service: 'faq-handler',
      });

      // Reply to the message with FAQ answer
      await ctx.reply(match.answer, {
        reply_parameters: {
          message_id: messageId,
        },
      });

      // Increment usage count for analytics
      await incrementUsageCount(match.faqId);

      logger.info('FAQ auto-response sent successfully', {
        chatId,
        messageId,
        faqId: match.faqId,
        service: 'faq-handler',
      });

      // Pass to message handler for ChatMessage logging, but flag as FAQ-handled
      // to skip SLA classification (gh-185)
      ctx.state.faqHandled = true;
      return next();
    } catch (error) {
      logger.error('Error in FAQ handler', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        chatId,
        messageId,
        service: 'faq-handler',
      });

      // On error, still pass to next handler to ensure SLA tracking continues
      return next();
    }
  });

  logger.info('FAQ handler registered', { service: 'faq-handler' });
}

export default registerFaqHandler;

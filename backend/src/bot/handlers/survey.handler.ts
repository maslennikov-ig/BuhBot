/**
 * Survey Callback Handler
 *
 * Handles Telegram callback queries from survey rating buttons.
 * Pattern: survey:rating:{deliveryId}:{rating}
 *
 * Features:
 * - Handles 1-5 star rating submissions
 * - Records ratings via survey service
 * - Shows thank you message and prompts for optional comment
 * - Handles already responded and expired survey cases
 * - Comment collection via text message after rating
 *
 * @module bot/handlers/survey
 */

import { bot } from '../bot.js';
import logger from '../../utils/logger.js';
import {
  THANK_YOU_MESSAGE,
  ALREADY_RESPONDED_MESSAGE,
  SURVEY_EXPIRED_MESSAGE,
} from '../keyboards/survey.keyboard.js';
import { recordResponse, getDeliveryById } from '../../services/feedback/survey.service.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Awaiting comment data structure
 */
interface AwaitingCommentData {
  /** Feedback response ID */
  feedbackId: string;
  /** Chat ID where the rating was submitted */
  chatId: string;
}

/**
 * Track chats awaiting comment (after rating)
 * Key: chatId, Value: { feedbackId, chatId }
 * Comments are collected for 10 minutes after rating submission
 */
const awaitingComment = new Map<string, AwaitingCommentData>();

/**
 * Register survey callback handlers
 *
 * Must be called during bot initialization to enable
 * survey rating button handling and comment collection.
 *
 * Handlers:
 * 1. survey:rating:{deliveryId}:{rating} - Records rating (1-5)
 * 2. Text messages after rating - Collects optional comments
 *
 * @example
 * ```typescript
 * import { registerSurveyHandler } from './handlers/survey.handler.js';
 *
 * // During bot initialization
 * registerSurveyHandler();
 * ```
 */
export function registerSurveyHandler(): void {
  logger.info('Registering survey callback handlers', { service: 'survey-handler' });

  // Handle rating button callbacks
  // Pattern: survey:rating:{deliveryId}:{rating}
  bot.action(/^survey:rating:([^:]+):(\d)$/, async (ctx) => {
    // Extract deliveryId and rating from regex match
    const deliveryId = ctx.match[1];
    const ratingStr = ctx.match[2];

    if (!deliveryId || !ratingStr) {
      await ctx.answerCbQuery('Invalid callback');
      return;
    }

    const rating = parseInt(ratingStr, 10);
    if (rating < 1 || rating > 5) {
      logger.warn('Invalid survey rating value', {
        rating,
        service: 'survey-handler',
      });
      await ctx.answerCbQuery('Invalid rating');
      return;
    }
    const chatId = ctx.chat?.id?.toString();
    const username = ctx.from?.username;

    logger.info('Survey rating received', {
      deliveryId,
      rating,
      chatId,
      username,
      service: 'survey-handler',
    });

    try {
      // Check delivery status
      const delivery = await getDeliveryById(deliveryId);

      if (!delivery) {
        await ctx.answerCbQuery('Survey not found');
        await ctx.editMessageText(SURVEY_EXPIRED_MESSAGE, { parse_mode: 'Markdown' });
        return;
      }

      if (delivery.status === 'responded') {
        await ctx.answerCbQuery('Already responded');
        await ctx.editMessageText(ALREADY_RESPONDED_MESSAGE, { parse_mode: 'Markdown' });
        return;
      }

      if (delivery.survey.status !== 'active' && delivery.survey.status !== 'sending') {
        await ctx.answerCbQuery('Survey closed');
        await ctx.editMessageText(SURVEY_EXPIRED_MESSAGE, { parse_mode: 'Markdown' });
        return;
      }

      // Record the response
      const feedbackId = await recordResponse(deliveryId, rating, username);

      // Show confirmation with rating
      const stars = '\u2B50'.repeat(rating);
      const confirmText = `${stars}\n\n${THANK_YOU_MESSAGE}`;

      await ctx.answerCbQuery(`Thank you! You rated ${rating} stars`);
      await ctx.editMessageText(confirmText, { parse_mode: 'Markdown' });

      // Track that we're awaiting a comment
      if (chatId) {
        awaitingComment.set(chatId, { feedbackId, chatId });

        // Clear after 10 minutes
        setTimeout(() => {
          awaitingComment.delete(chatId);
        }, 10 * 60 * 1000);
      }

      logger.info('Survey rating recorded', {
        deliveryId,
        rating,
        feedbackId,
        chatId,
        service: 'survey-handler',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process survey rating', {
        deliveryId,
        rating,
        error: errorMessage,
        service: 'survey-handler',
      });

      if (errorMessage.includes('Already responded')) {
        await ctx.answerCbQuery('Already responded');
        await ctx.editMessageText(ALREADY_RESPONDED_MESSAGE, { parse_mode: 'Markdown' });
      } else if (errorMessage.includes('no longer accepting')) {
        await ctx.answerCbQuery('Survey closed');
        await ctx.editMessageText(SURVEY_EXPIRED_MESSAGE, { parse_mode: 'Markdown' });
      } else {
        await ctx.answerCbQuery('Error processing rating');
      }
    }
  });

  // Handle comment messages (after rating)
  bot.on('message', async (ctx, next) => {
    const chatId = ctx.chat?.id?.toString();
    if (!chatId) {
      return next();
    }

    const awaitingData = awaitingComment.get(chatId);
    if (!awaitingData) {
      return next();
    }

    // Check if it's a text message
    if (!ctx.message || !('text' in ctx.message)) {
      return next();
    }

    const comment = ctx.message.text;

    // Don't process commands as comments
    if (comment.startsWith('/')) {
      return next();
    }

    try {
      // Add comment to feedback
      await prisma.feedbackResponse.update({
        where: { id: awaitingData.feedbackId },
        data: { comment },
      });

      awaitingComment.delete(chatId);

      await ctx.reply('\u2705 Спасибо за ваш комментарий! Мы обязательно его учтём.');

      logger.info('Survey comment added', {
        feedbackId: awaitingData.feedbackId,
        chatId,
        commentLength: comment.length,
        service: 'survey-handler',
      });
    } catch (error) {
      logger.error('Failed to add survey comment', {
        feedbackId: awaitingData.feedbackId,
        error: error instanceof Error ? error.message : String(error),
        service: 'survey-handler',
      });
      awaitingComment.delete(chatId);
    }
  });

  logger.info('Survey callback handlers registered', { service: 'survey-handler' });
}

/**
 * Check if a chat is awaiting a comment
 *
 * @param chatId - Telegram chat ID as string
 * @returns true if the chat is awaiting a comment
 *
 * @example
 * ```typescript
 * if (isAwaitingComment('123456789')) {
 *   // Handle comment flow
 * }
 * ```
 */
export function isAwaitingComment(chatId: string): boolean {
  return awaitingComment.has(chatId);
}

/**
 * Get awaiting comment data for a chat
 *
 * @param chatId - Telegram chat ID as string
 * @returns Awaiting comment data or undefined if not awaiting
 *
 * @example
 * ```typescript
 * const data = getAwaitingCommentData('123456789');
 * if (data) {
 *   console.log(`Awaiting comment for feedback ${data.feedbackId}`);
 * }
 * ```
 */
export function getAwaitingCommentData(chatId: string): AwaitingCommentData | undefined {
  return awaitingComment.get(chatId);
}

export default registerSurveyHandler;

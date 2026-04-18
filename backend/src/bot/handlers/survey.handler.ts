/**
 * Survey Callback Handler (gh-294 multi-user)
 *
 * Handles Telegram callback queries from survey rating buttons.
 *
 * Callback patterns:
 *   1. survey:rating:{deliveryId}:{rating}  — submit/update a user's vote
 *   2. survey:remove:{deliveryId}           — remove the user's active vote
 *
 * Multi-user semantics (gh-294):
 * - Each Telegram user in a chat votes independently.
 * - Votes can be changed or removed while the survey is active.
 * - The survey closes ONLY on timeout (bullmq worker) or manual close by a
 *   manager. There is NO first-vote / threshold closure.
 * - Vote storage/audit lives in `vote.service.ts`; this handler is a thin
 *   transport adapter that talks to Telegram.
 * - Comment collection is per-user: the awaitingComment map is keyed by
 *   `${chatId}:${telegramUserId}` so two users in the same chat can
 *   independently leave comments without stepping on each other.
 *
 * @module bot/handlers/survey
 */

import { bot } from '../bot.js';
import logger from '../../utils/logger.js';
import {
  THANK_YOU_MESSAGE,
  SURVEY_EXPIRED_MESSAGE,
  buildPerUserSurveyKeyboard,
} from '../keyboards/survey.keyboard.js';
import { getDeliveryById } from '../../services/feedback/survey.service.js';
import {
  submitVote,
  removeVote,
  SurveyClosedError,
  DeliveryNotFoundError,
} from '../../services/feedback/vote.service.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Awaiting comment data structure
 */
interface AwaitingCommentData {
  /** SurveyVote ID (gh-294: replaces legacy feedbackId). */
  voteId: string;
  /** Telegram chat ID (stringified) — useful for logging/eviction. */
  chatId: string;
  /** Telegram user ID (stringified) — comments are per-user. */
  telegramUserId: string;
}

/**
 * Track users awaiting a comment (after rating).
 *
 * Key: `${chatId}:${telegramUserId}` (gh-294 composite)
 * Value: { voteId, chatId, telegramUserId }
 *
 * Comments are collected for 10 minutes after rating submission.
 */
const awaitingComment = new Map<string, AwaitingCommentData>();
const MAX_AWAITING_COMMENTS = 1000; // Prevent unbounded memory growth (gh-151)

/**
 * Build the composite key used by the awaitingComment map.
 *
 * Exposed as a named export so tests and any future external callers compose
 * the key the same way (instead of hand-rolling the format, which would drift
 * silently).
 */
export function buildAwaitingCommentKey(
  chatId: string | number | bigint,
  telegramUserId: string | number | bigint
): string {
  return `${chatId.toString()}:${telegramUserId.toString()}`;
}

/**
 * Register survey callback handlers
 *
 * Must be called during bot initialization to enable
 * survey rating button handling and comment collection.
 *
 * Handlers:
 *   1. survey:rating:{deliveryId}:{rating}  — submit/update vote
 *   2. survey:remove:{deliveryId}           — remove vote
 *   3. Text messages after rating           — collect per-user comments
 */
export function registerSurveyHandler(): void {
  logger.info('Registering survey callback handlers', { service: 'survey-handler' });

  // --------------------------------------------------------------------------
  // 1. Rating action: survey:rating:{deliveryId}:{rating}
  // --------------------------------------------------------------------------
  bot.action(/^survey:rating:([^:]+):(\d)$/, async (ctx) => {
    const deliveryId = ctx.match[1];
    const ratingStr = ctx.match[2];

    if (!deliveryId || !ratingStr) {
      await ctx.answerCbQuery('Invalid callback');
      return;
    }

    const rating = parseInt(ratingStr, 10);
    if (rating < 1 || rating > 5) {
      logger.warn('Invalid survey rating value', { rating, service: 'survey-handler' });
      await ctx.answerCbQuery('Invalid rating');
      return;
    }

    const chatId = ctx.chat?.id?.toString();
    const telegramUserIdNum = ctx.from?.id;
    const username = ctx.from?.username;

    if (!telegramUserIdNum) {
      await ctx.answerCbQuery('Missing user context');
      return;
    }
    const telegramUserId = BigInt(telegramUserIdNum);

    logger.info('Survey rating received', {
      deliveryId,
      rating,
      chatId,
      telegramUserId: telegramUserId.toString(),
      username,
      service: 'survey-handler',
    });

    try {
      // Authorization: verify callback comes from the same chat as delivery (gh-98).
      // We still fetch the delivery to enforce this invariant; vote.service does
      // its own validation but we want to short-circuit unauthorized callbacks.
      const delivery = await getDeliveryById(deliveryId);
      if (!delivery) {
        await ctx.answerCbQuery('Survey not found');
        await ctx.editMessageText(SURVEY_EXPIRED_MESSAGE, { parse_mode: 'Markdown' });
        return;
      }

      const callbackChatId = ctx.chat?.id;
      if (!callbackChatId || BigInt(callbackChatId) !== delivery.chatId) {
        logger.warn('Survey response from unauthorized chat', {
          deliveryId,
          expectedChatId: delivery.chatId.toString(),
          actualChatId: callbackChatId?.toString(),
          userId: telegramUserId.toString(),
          service: 'survey-handler',
        });
        await ctx.answerCbQuery('Unauthorized');
        return;
      }

      // Submit via vote.service.ts — atomic upsert + history append.
      // Comment is collected separately via the text-message listener below;
      // we intentionally omit the `comment` key so the service preserves any
      // previously-saved comment on a vote update.
      const vote = await submitVote({
        deliveryId,
        telegramUserId,
        rating,
        username: username ?? null,
      });

      // gh-291: toast-only, no stars in chat-visible text.
      await ctx.answerCbQuery(`Thank you! You rated ${rating} stars`);

      // Update the keyboard to reflect the user's new active rating. The edit
      // is per-message (all chat members see the same markup), but the toast
      // + the per-user callback routing on the backend ensure correct state.
      try {
        await ctx.editMessageReplyMarkup(
          buildPerUserSurveyKeyboard({ deliveryId, currentActiveRating: rating }).reply_markup
        );
      } catch (editErr) {
        // Telegram rejects edits if the markup is identical; ignore that class.
        const msg = editErr instanceof Error ? editErr.message : String(editErr);
        if (!msg.includes('message is not modified')) {
          logger.warn('Failed to edit survey keyboard', {
            deliveryId,
            error: msg,
            service: 'survey-handler',
          });
        }
      }

      // On the first vote by this user, also edit the message text once to
      // show the thank-you prompt. Subsequent edits (vote changes) reuse the
      // same text, so we rely on "message is not modified" suppression.
      try {
        await ctx.editMessageText(THANK_YOU_MESSAGE, { parse_mode: 'Markdown' });
      } catch (editErr) {
        const msg = editErr instanceof Error ? editErr.message : String(editErr);
        if (!msg.includes('message is not modified')) {
          logger.debug('editMessageText skipped', {
            deliveryId,
            error: msg,
            service: 'survey-handler',
          });
        }
      }

      // Track per-user awaiting-comment state.
      if (chatId) {
        const key = buildAwaitingCommentKey(chatId, telegramUserId);
        if (awaitingComment.size >= MAX_AWAITING_COMMENTS) {
          // Evict oldest entry (FIFO since Map preserves insertion order).
          const oldestKey = awaitingComment.keys().next().value;
          if (oldestKey) awaitingComment.delete(oldestKey);
        }
        awaitingComment.set(key, {
          voteId: vote.id,
          chatId,
          telegramUserId: telegramUserId.toString(),
        });

        setTimeout(
          () => {
            awaitingComment.delete(key);
          },
          10 * 60 * 1000
        );
      }

      logger.info('Survey rating recorded', {
        deliveryId,
        rating,
        voteId: vote.id,
        chatId,
        telegramUserId: telegramUserId.toString(),
        service: 'survey-handler',
      });
    } catch (error) {
      if (error instanceof SurveyClosedError) {
        await ctx.answerCbQuery('Survey closed');
        await ctx.editMessageText(SURVEY_EXPIRED_MESSAGE, { parse_mode: 'Markdown' });
        return;
      }
      if (error instanceof DeliveryNotFoundError) {
        await ctx.answerCbQuery('Survey not found');
        await ctx.editMessageText(SURVEY_EXPIRED_MESSAGE, { parse_mode: 'Markdown' });
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process survey rating', {
        deliveryId,
        rating,
        error: errorMessage,
        service: 'survey-handler',
      });
      await ctx.answerCbQuery('Error processing rating');
    }
  });

  // --------------------------------------------------------------------------
  // 2. Remove action: survey:remove:{deliveryId}
  // --------------------------------------------------------------------------
  bot.action(/^survey:remove:([^:]+)$/, async (ctx) => {
    const deliveryId = ctx.match[1];
    if (!deliveryId) {
      await ctx.answerCbQuery('Invalid callback');
      return;
    }

    const telegramUserIdNum = ctx.from?.id;
    if (!telegramUserIdNum) {
      await ctx.answerCbQuery('Missing user context');
      return;
    }
    const telegramUserId = BigInt(telegramUserIdNum);
    const username = ctx.from?.username;
    const chatId = ctx.chat?.id?.toString();

    try {
      // Authorization check (same as rating action).
      const delivery = await getDeliveryById(deliveryId);
      if (!delivery) {
        await ctx.answerCbQuery('Survey not found');
        return;
      }
      const callbackChatId = ctx.chat?.id;
      if (!callbackChatId || BigInt(callbackChatId) !== delivery.chatId) {
        await ctx.answerCbQuery('Unauthorized');
        return;
      }

      await removeVote({ deliveryId, telegramUserId, username: username ?? null });

      await ctx.answerCbQuery('Оценка отозвана');

      // Rebuild keyboard without the active checkmark.
      try {
        await ctx.editMessageReplyMarkup(
          buildPerUserSurveyKeyboard({ deliveryId, currentActiveRating: null }).reply_markup
        );
      } catch (editErr) {
        const msg = editErr instanceof Error ? editErr.message : String(editErr);
        if (!msg.includes('message is not modified')) {
          logger.warn('Failed to edit survey keyboard on remove', {
            deliveryId,
            error: msg,
            service: 'survey-handler',
          });
        }
      }

      // Clear any pending awaitingComment entry for this user.
      if (chatId) {
        const key = buildAwaitingCommentKey(chatId, telegramUserId);
        awaitingComment.delete(key);
      }

      logger.info('Survey vote removed', {
        deliveryId,
        telegramUserId: telegramUserId.toString(),
        chatId,
        service: 'survey-handler',
      });
    } catch (error) {
      if (error instanceof SurveyClosedError || error instanceof DeliveryNotFoundError) {
        await ctx.answerCbQuery('Survey closed');
        return;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process survey remove', {
        deliveryId,
        error: errorMessage,
        service: 'survey-handler',
      });
      await ctx.answerCbQuery('Error removing vote');
    }
  });

  // --------------------------------------------------------------------------
  // 3. Comment messages (after rating) — per-user keyed
  // --------------------------------------------------------------------------
  bot.on('message', async (ctx, next) => {
    const chatId = ctx.chat?.id?.toString();
    const telegramUserIdNum = ctx.from?.id;
    if (!chatId || !telegramUserIdNum) {
      return next();
    }

    const key = buildAwaitingCommentKey(chatId, telegramUserIdNum);
    const awaitingData = awaitingComment.get(key);
    if (!awaitingData) {
      return next();
    }

    // Text-only messages.
    if (!ctx.message || !('text' in ctx.message)) {
      return next();
    }
    const comment = ctx.message.text;

    // Commands are never comments.
    if (comment.startsWith('/')) {
      return next();
    }

    try {
      // Update the SurveyVote.comment directly. Writing to the legacy
      // FeedbackResponse table is intentionally skipped in the new flow
      // (the legacy table remains for back-compat but is no longer a
      // write target — see vote.service.ts module docstring).
      await prisma.surveyVote.update({
        where: { id: awaitingData.voteId },
        data: { comment },
      });

      awaitingComment.delete(key);

      await ctx.reply('\u2705 Спасибо за ваш комментарий! Мы обязательно его учтём.');

      logger.info('Survey comment added', {
        voteId: awaitingData.voteId,
        chatId,
        telegramUserId: awaitingData.telegramUserId,
        commentLength: comment.length,
        service: 'survey-handler',
      });
    } catch (error) {
      logger.error('Failed to add survey comment', {
        voteId: awaitingData.voteId,
        error: error instanceof Error ? error.message : String(error),
        service: 'survey-handler',
      });
      awaitingComment.delete(key);
    }
  });

  logger.info('Survey callback handlers registered', { service: 'survey-handler' });
}

/**
 * Check if a (chat, user) pair is awaiting a comment.
 *
 * Backwards-compat: the legacy single-argument form (chatId only) is still
 * accepted and checks whether ANY user in that chat is awaiting. New callers
 * should pass both arguments for precise matching.
 */
export function isAwaitingComment(
  chatId: string,
  telegramUserId?: string | number | bigint
): boolean {
  if (telegramUserId === undefined) {
    const prefix = `${chatId}:`;
    for (const k of awaitingComment.keys()) {
      if (k.startsWith(prefix)) return true;
    }
    return false;
  }
  return awaitingComment.has(buildAwaitingCommentKey(chatId, telegramUserId));
}

/**
 * Get awaiting comment data for a (chat, user) pair.
 *
 * Backwards-compat: the legacy single-argument form returns the first entry
 * for the chat, if any. Prefer passing the telegramUserId.
 */
export function getAwaitingCommentData(
  chatId: string,
  telegramUserId?: string | number | bigint
): AwaitingCommentData | undefined {
  if (telegramUserId === undefined) {
    const prefix = `${chatId}:`;
    for (const [k, v] of awaitingComment.entries()) {
      if (k.startsWith(prefix)) return v;
    }
    return undefined;
  }
  return awaitingComment.get(buildAwaitingCommentKey(chatId, telegramUserId));
}

export default registerSurveyHandler;

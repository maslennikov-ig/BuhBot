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
import { SURVEY_EXPIRED_MESSAGE, COMMENT_RECEIVED_MESSAGE } from '../keyboards/survey.keyboard.js';
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
 * Timer handles for the 10-minute awaitingComment TTL, keyed the same way as
 * `awaitingComment`. gh-294 code-review (2026-04-19): without this map each
 * re-vote scheduled a fresh timer while the previous one stayed armed, so
 * the first timer would fire and delete the entry even after the user voted
 * again. We now cancel the pending timer on every re-vote and on remove.
 */
const commentTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleCommentExpiry(key: string): void {
  const existing = commentTimers.get(key);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(
    () => {
      awaitingComment.delete(key);
      commentTimers.delete(key);
    },
    10 * 60 * 1000
  );
  commentTimers.set(key, timer);
}

function cancelCommentExpiry(key: string): void {
  const existing = commentTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    commentTimers.delete(key);
  }
}

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

      // gh-294 regression fix (2026-04-19): neither the keyboard nor the
      // message text is edited after a vote. A Telegram message has ONE
      // shared keyboard/text across all chat members; previous edits here
      // overwrote the 5-star keyboard with User 1's per-user state, making
      // the survey appear closed for other voters. Per-user feedback is
      // now delivered strictly via `answerCbQuery` (a toast visible only
      // to the acting user). See gh-294 comment 2026-04-18.
      //
      // Review fix (2026-04-19): only promise the comment-collection
      // follow-up when `chatId` is truthy — otherwise the awaitingComment
      // entry is never created and the user follows useless instructions.
      const commentHint = chatId ? ' Отправьте сообщение в чат, чтобы оставить комментарий.' : '';
      await ctx.answerCbQuery(
        `\u2705 Ваша оценка принята: ${rating} \u2B50. Можете изменить её или отозвать.${commentHint}`,
        { show_alert: false }
      );

      // Track per-user awaiting-comment state.
      if (chatId) {
        const key = buildAwaitingCommentKey(chatId, telegramUserId);
        if (awaitingComment.size >= MAX_AWAITING_COMMENTS) {
          // Evict oldest entry (FIFO since Map preserves insertion order).
          const oldestKey = awaitingComment.keys().next().value;
          if (oldestKey) {
            awaitingComment.delete(oldestKey);
            cancelCommentExpiry(oldestKey);
          }
        }
        awaitingComment.set(key, {
          voteId: vote.id,
          chatId,
          telegramUserId: telegramUserId.toString(),
        });
        scheduleCommentExpiry(key);
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

      const removed = await removeVote({
        deliveryId,
        telegramUserId,
        username: username ?? null,
      });

      // gh-294 regression fix (2026-04-19): no keyboard edit. The 5-star +
      // "Отозвать оценку" keyboard is static so every chat member keeps a
      // working survey UI. `removeVote` returns `null` when the user had no
      // prior active vote — distinguish the two cases in the toast so the
      // user gets precise feedback.
      await ctx.answerCbQuery(
        removed
          ? '\u2705 Ваша оценка отозвана. Можно проголосовать снова.'
          : '\u2139\uFE0F У вас пока нет оценки для отзыва в этом опросе.',
        { show_alert: false }
      );

      // Clear any pending awaitingComment entry for this user.
      // Review fix (2026-04-19): also cancel the pending TTL timer so it
      // doesn't fire later and double-delete a freshly re-voted entry.
      if (chatId) {
        const key = buildAwaitingCommentKey(chatId, telegramUserId);
        awaitingComment.delete(key);
        cancelCommentExpiry(key);
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
      cancelCommentExpiry(key);

      await ctx.reply(COMMENT_RECEIVED_MESSAGE);

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
      cancelCommentExpiry(key);
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

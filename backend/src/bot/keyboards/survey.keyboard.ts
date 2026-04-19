/**
 * Survey Keyboard Builder
 *
 * Creates inline keyboards for survey rating collection.
 * Uses callback_data pattern: survey:rating:{deliveryId}:{rating}
 *
 * Available Actions:
 * - Rate 1-5 stars: Callback to submit rating
 *
 * Callback Data Format:
 * - survey:rating:{deliveryId}:{rating}
 *
 * @module bot/keyboards/survey
 */

import { Markup } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/types';

/**
 * Star emoji for rating display
 */
const STAR = '\u2B50'; // Star emoji

/**
 * Creates an inline keyboard with 5 star rating buttons + "Отозвать оценку"
 * button, shared across every chat member (gh-294 regression fix).
 *
 * A Telegram message has ONE inline keyboard shared by all viewers. Editing
 * the keyboard after a vote would overwrite it for everyone and prevent
 * other chat members from voting. This keyboard therefore stays STATIC
 * for the lifetime of the survey — per-user state (which rating the
 * current user chose) is surfaced only via `answerCbQuery` toasts.
 *
 * Clicking "Отозвать оценку" without a prior vote is a safe no-op —
 * `removeVote` returns null and the handler shows a friendly toast.
 *
 * @param surveyId - The survey campaign ID (not used in callback, for future use)
 * @param deliveryId - The delivery record ID
 * @returns Inline keyboard markup with rating + withdraw buttons
 */
export function createSurveyRatingKeyboard(
  _surveyId: string,
  deliveryId: string
): Markup.Markup<InlineKeyboardMarkup> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`1 ${STAR}`, `survey:rating:${deliveryId}:1`),
      Markup.button.callback(`2 ${STAR}`, `survey:rating:${deliveryId}:2`),
      Markup.button.callback(`3 ${STAR}`, `survey:rating:${deliveryId}:3`),
      Markup.button.callback(`4 ${STAR}`, `survey:rating:${deliveryId}:4`),
      Markup.button.callback(`5 ${STAR}`, `survey:rating:${deliveryId}:5`),
    ],
    [Markup.button.callback('\u274C Отозвать оценку', `survey:remove:${deliveryId}`)],
  ]);
}

/**
 * Checkmark for indicating the current user's active rating.
 * Rendered next to the numeric rating on the row the user chose.
 */
const CHECK = '\u2705'; // ✅

/**
 * @deprecated Do not use. Kept only so legacy callers / old tests compile.
 *
 * The original gh-294 implementation edited the message keyboard after each
 * vote to show a per-user checkmark. That broke multi-user voting because
 * Telegram shares ONE keyboard per message across all chat members — editing
 * it overwrote the 5-star keyboard for everyone, leaving other users unable
 * to vote. See gh-294 (regression comment 2026-04-18) and
 * {@link createSurveyRatingKeyboard}, which is the static replacement that
 * includes the "Отозвать оценку" button unconditionally.
 *
 * Always renders the 5-star row. When `currentActiveRating` is non-null we
 * also render the "Отозвать оценку" row, matching the shape the new static
 * keyboard emits so any stray call still produces a working markup.
 */
export function buildPerUserSurveyKeyboard(input: {
  deliveryId: string;
  currentActiveRating: number | null;
}): Markup.Markup<InlineKeyboardMarkup> {
  const { deliveryId, currentActiveRating } = input;
  const buttonLabel = (rating: number): string => {
    return rating === currentActiveRating ? `${rating} ${STAR} ${CHECK}` : `${rating} ${STAR}`;
  };

  const rows: ReturnType<typeof Markup.button.callback>[][] = [
    [
      Markup.button.callback(buttonLabel(1), `survey:rating:${deliveryId}:1`),
      Markup.button.callback(buttonLabel(2), `survey:rating:${deliveryId}:2`),
      Markup.button.callback(buttonLabel(3), `survey:rating:${deliveryId}:3`),
      Markup.button.callback(buttonLabel(4), `survey:rating:${deliveryId}:4`),
      Markup.button.callback(buttonLabel(5), `survey:rating:${deliveryId}:5`),
    ],
  ];

  if (currentActiveRating !== null) {
    rows.push([Markup.button.callback('\u274C Отозвать оценку', `survey:remove:${deliveryId}`)]);
  }

  return Markup.inlineKeyboard(rows);
}

/**
 * Default survey message text in Russian
 */
export const SURVEY_MESSAGE_TEXT = `\uD83D\uDCCA *Опрос удовлетворённости*

Уважаемый клиент!

Пожалуйста, оцените качество нашей работы за последний квартал по шкале от 1 до 5, где:

1 \u2B50 — Очень плохо
2 \u2B50 — Плохо
3 \u2B50 — Удовлетворительно
4 \u2B50 — Хорошо
5 \u2B50 — Отлично

Ваше мнение важно для нас!`;

/**
 * Reminder message text in Russian
 */
export const SURVEY_REMINDER_TEXT = `\uD83D\uDCCA *Напоминание об опросе*

Уважаемый клиент!

Мы заметили, что вы ещё не оценили качество нашей работы. Пожалуйста, уделите несколько секунд, чтобы оставить вашу оценку.

Спасибо!`;

/**
 * @deprecated gh-294 (2026-04-19): no live caller after the regression fix.
 * The chat-visible message text must not be edited after a vote so other
 * chat members can keep voting on the same keyboard. Per-user confirmation
 * now lives in the `answerCbQuery` toast in `survey.handler.ts`. Kept
 * exported for back-compat only; remove in a follow-up cleanup PR.
 */
export const THANK_YOU_MESSAGE = `\u2705 *Спасибо за вашу оценку!*

Если хотите, вы можете оставить комментарий к вашей оценке — просто напишите его в ответ на это сообщение.`;

/**
 * Comment received confirmation
 */
export const COMMENT_RECEIVED_MESSAGE = `\u2705 Спасибо за ваш комментарий! Мы обязательно его учтём.`;

/**
 * Survey expired message
 */
export const SURVEY_EXPIRED_MESSAGE = `\u23F0 К сожалению, время для ответа на этот опрос истекло.`;

/**
 * @deprecated gh-294 (2026-04-19): multi-user voting removed the single-vote
 * "already responded" gate. No caller remains; kept exported for back-compat
 * and removed in a follow-up cleanup PR.
 */
export const ALREADY_RESPONDED_MESSAGE = `\u2139\uFE0F Вы уже ответили на этот опрос. Спасибо!`;

/**
 * Parsed survey callback data
 */
export interface SurveyCallbackData {
  /** The delivery record ID */
  deliveryId: string;
  /** Rating value (1-5) */
  rating: number;
}

/**
 * Parse callback data from rating button
 *
 * @param callbackData - The callback_data from button press
 * @returns Parsed data or null if invalid format
 *
 * @example
 * ```typescript
 * const data = parseSurveyCallback('survey:rating:delivery-123:5');
 * // Returns: { deliveryId: 'delivery-123', rating: 5 }
 *
 * const invalid = parseSurveyCallback('other:data');
 * // Returns: null
 * ```
 */
export function parseSurveyCallback(callbackData: string): SurveyCallbackData | null {
  const match = callbackData.match(/^survey:rating:([^:]+):(\d)$/);
  if (!match || !match[1] || !match[2]) {
    return null;
  }

  const rating = parseInt(match[2], 10);
  if (rating < 1 || rating > 5) {
    return null;
  }

  return {
    deliveryId: match[1],
    rating,
  };
}

export default {
  createSurveyRatingKeyboard,
  buildPerUserSurveyKeyboard,
  parseSurveyCallback,
  SURVEY_MESSAGE_TEXT,
  SURVEY_REMINDER_TEXT,
  THANK_YOU_MESSAGE,
  COMMENT_RECEIVED_MESSAGE,
  SURVEY_EXPIRED_MESSAGE,
  ALREADY_RESPONDED_MESSAGE,
};

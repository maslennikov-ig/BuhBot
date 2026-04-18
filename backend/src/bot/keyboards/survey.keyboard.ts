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
 * Creates an inline keyboard with 5 star rating buttons
 *
 * @param surveyId - The survey campaign ID (not used in callback, for future use)
 * @param deliveryId - The delivery record ID
 * @returns Inline keyboard markup with rating buttons
 *
 * @example
 * ```typescript
 * const keyboard = createSurveyRatingKeyboard('survey-123', 'delivery-456');
 * await ctx.reply('Оцените качество обслуживания:', keyboard);
 * ```
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
  ]);
}

/**
 * Checkmark for indicating the current user's active rating.
 * Rendered next to the numeric rating on the row the user chose.
 */
const CHECK = '\u2705'; // ✅

/**
 * Per-user keyboard for multi-user voting (gh-294).
 *
 * The keyboard is regenerated on every callback so it reflects the current
 * voter's active rating (not the first voter's). The checkmark only appears
 * on the rating the specific user chose — other users who press the button
 * will still see the un-checked version because the keyboard is produced
 * client-side per callback, not persisted on the message.
 *
 * When `currentActiveRating` is non-null, an additional "Отозвать оценку"
 * button is rendered on a second row. Pressing it triggers the
 * `survey:remove:{deliveryId}` callback handled in survey.handler.ts.
 *
 * NOTE: editMessageReplyMarkup on a multi-member chat only changes what the
 * bot stores for that message. The UX is imperfect (all members see the same
 * keyboard at any given time), but the callback handler computes the
 * per-user state correctly on the server. This keyboard exists mainly to
 * give the acting user fast visual feedback on the toast + edited markup.
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
 * Thank you message after rating submission
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
 * Already responded message
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

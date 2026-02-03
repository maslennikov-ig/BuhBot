/**
 * Alert Inline Keyboard Builder
 *
 * Creates inline keyboards for SLA alert messages.
 * Buttons allow managers to take actions directly from Telegram.
 *
 * Available Actions:
 * - Open chat: URL button to jump to the chat
 * - Notify accountant: Callback to send reminder
 * - Mark resolved: Callback to resolve the alert
 *
 * Callback Data Format:
 * - notify_{alertId}
 * - resolve_{alertId}
 *
 * @module bot/keyboards/alert.keyboard
 */

import { Markup } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/types';

/**
 * Data required to build an alert keyboard
 */
export interface AlertKeyboardData {
  /** UUID of the SlaAlert */
  alertId: string;
  /** Telegram chat ID as string */
  chatId: string;
  /** UUID of the ClientRequest */
  requestId: string;
  /** Telegram invite link (optional - from exportChatInviteLink API) */
  inviteLink?: string | null;
  /** Chat type (optional - for fallback logic) */
  chatType?: string;
}

/**
 * Options for customizing the keyboard
 */
export interface AlertKeyboardOptions {
  /** Show "Open chat" button (default: true) */
  showChatLink?: boolean;
  /** Show "Notify accountant" button (default: true) */
  showNotifyButton?: boolean;
  /** Show "Mark resolved" button (default: true) */
  showResolveButton?: boolean;
}

/**
 * Convert Telegram chat ID to t.me link format
 *
 * Supergroup chat IDs start with -100, which needs to be removed
 * for the t.me/c/ link format.
 *
 * @param chatId - Telegram chat ID as string
 * @returns Chat ID formatted for t.me link
 */
function formatChatIdForLink(chatId: string): string {
  // Remove -100 prefix for supergroups
  if (chatId.startsWith('-100')) {
    return chatId.slice(4);
  }
  // Remove - prefix for regular groups
  if (chatId.startsWith('-')) {
    return chatId.slice(1);
  }
  return chatId;
}

/**
 * Build inline keyboard for SLA alert messages
 *
 * Creates a keyboard with action buttons for managers:
 * 1. "Open chat" - URL button to navigate to the chat
 * 2. "Notify accountant" - Callback to send reminder
 * 3. "Mark resolved" - Callback to resolve the alert
 *
 * Chat Link Priority:
 * 1. inviteLink (from exportChatInviteLink API) - works for all chat types
 * 2. t.me/c/{chatId} - only for supergroups (chatType='supergroup')
 * 3. Hide button - for regular groups without invite link
 *
 * @param data - Alert keyboard data
 * @param options - Optional customization options
 * @returns Telegraf Markup with inline keyboard
 *
 * @example
 * ```typescript
 * const keyboard = buildAlertKeyboard({
 *   alertId: 'uuid-alert-123',
 *   chatId: '-100123456789',
 *   requestId: 'uuid-request-456',
 *   inviteLink: 'https://t.me/+ABC123xyz',
 *   chatType: 'supergroup',
 * });
 *
 * await bot.telegram.sendMessage(
 *   managerId,
 *   alertMessage,
 *   {
 *     parse_mode: 'HTML',
 *     ...keyboard,
 *   }
 * );
 * ```
 */
export function buildAlertKeyboard(
  data: AlertKeyboardData,
  options: AlertKeyboardOptions = {}
): Markup.Markup<InlineKeyboardMarkup> {
  const { showChatLink = true, showNotifyButton = true, showResolveButton = true } = options;

  const { alertId, chatId, inviteLink, chatType } = data;

  // Build rows of buttons
  type ButtonRow = ReturnType<typeof Markup.button.callback | typeof Markup.button.url>[];
  const rows: ButtonRow[] = [];

  // Row 1: Chat link (with priority logic)
  if (showChatLink) {
    let chatUrl: string | null = null;

    if (inviteLink) {
      // Priority 1: Use invite link if available (works for all chat types)
      chatUrl = inviteLink;
    } else if (chatType === 'supergroup') {
      // Priority 2: Use t.me/c/ link only for supergroups
      const formattedChatId = formatChatIdForLink(chatId);
      chatUrl = `https://t.me/c/${formattedChatId}`;
    }
    // Priority 3: For regular groups without invite link, chatUrl stays null (button hidden)

    if (chatUrl) {
      rows.push([
        Markup.button.url(
          '\uD83D\uDCAC Открыть чат', // Speech balloon
          chatUrl
        ),
      ]);
    }
  }

  // Row 2: Action buttons
  const actionRow: ButtonRow = [];

  if (showNotifyButton) {
    actionRow.push(
      Markup.button.callback(
        '\uD83D\uDD14 Уведомить бухгалтера', // Bell
        `notify_${alertId}`
      )
    );
  }

  if (showResolveButton) {
    actionRow.push(
      Markup.button.callback(
        '\u2705 Отметить решённым', // White heavy check mark
        `resolve_${alertId}`
      )
    );
  }

  if (actionRow.length > 0) {
    rows.push(actionRow);
  }

  return Markup.inlineKeyboard(rows);
}

/**
 * Build minimal keyboard for resolved alerts
 *
 * Shows only the chat link button after an alert is resolved.
 *
 * @param chatId - Telegram chat ID as string
 * @param inviteLink - Optional invite link (preferred over t.me/c/)
 * @param chatType - Optional chat type (for fallback logic)
 * @returns Telegraf Markup with inline keyboard
 */
export function buildResolvedKeyboard(
  chatId: string,
  inviteLink?: string | null,
  chatType?: string
): Markup.Markup<InlineKeyboardMarkup> {
  let chatUrl: string | null = null;

  if (inviteLink) {
    chatUrl = inviteLink;
  } else if (chatType === 'supergroup') {
    const formattedChatId = formatChatIdForLink(chatId);
    chatUrl = `https://t.me/c/${formattedChatId}`;
  }

  if (chatUrl) {
    return Markup.inlineKeyboard([[Markup.button.url('\uD83D\uDCAC Открыть чат', chatUrl)]]);
  }

  // No link available - return empty keyboard
  return Markup.inlineKeyboard([]);
}

/**
 * Build keyboard for accountant notification
 *
 * Shows a link to the chat where client is waiting.
 *
 * @param chatId - Telegram chat ID as string
 * @param inviteLink - Optional invite link (preferred over t.me/c/)
 * @param chatType - Optional chat type (for fallback logic)
 * @returns Telegraf Markup with inline keyboard
 */
export function buildAccountantNotificationKeyboard(
  chatId: string,
  inviteLink?: string | null,
  chatType?: string
): Markup.Markup<InlineKeyboardMarkup> {
  let chatUrl: string | null = null;

  if (inviteLink) {
    chatUrl = inviteLink;
  } else if (chatType === 'supergroup') {
    const formattedChatId = formatChatIdForLink(chatId);
    chatUrl = `https://t.me/c/${formattedChatId}`;
  }

  if (chatUrl) {
    return Markup.inlineKeyboard([
      [Markup.button.url('\uD83D\uDCAC Открыть чат и ответить', chatUrl)],
    ]);
  }

  // No link available - return empty keyboard
  return Markup.inlineKeyboard([]);
}

/**
 * Data required to build a low-rating alert keyboard
 */
export interface LowRatingAlertKeyboardData {
  /** UUID of the FeedbackResponse */
  feedbackId: string;
  /** Telegram chat ID as string */
  chatId: string;
  /** Telegram invite link (optional) */
  inviteLink?: string | null;
  /** Chat type (optional - for fallback logic) */
  chatType?: string;
}

/**
 * Build inline keyboard for low-rating alert messages
 *
 * Creates a keyboard with action buttons for managers:
 * 1. "Open chat" - URL button to navigate to the chat
 * 2. "View feedback" - Callback to view feedback details
 *
 * @param data - Low-rating alert keyboard data
 * @returns Telegraf Markup with inline keyboard
 *
 * @example
 * ```typescript
 * const keyboard = buildLowRatingAlertKeyboard({
 *   feedbackId: 'uuid-feedback-123',
 *   chatId: '-100123456789',
 *   inviteLink: 'https://t.me/+ABC123xyz',
 *   chatType: 'supergroup',
 * });
 *
 * await bot.telegram.sendMessage(
 *   managerId,
 *   alertMessage,
 *   {
 *     parse_mode: 'HTML',
 *     ...keyboard,
 *   }
 * );
 * ```
 */
export function buildLowRatingAlertKeyboard(
  data: LowRatingAlertKeyboardData
): Markup.Markup<InlineKeyboardMarkup> {
  const { feedbackId, chatId, inviteLink, chatType } = data;

  let chatUrl: string | null = null;

  if (inviteLink) {
    chatUrl = inviteLink;
  } else if (chatType === 'supergroup') {
    const formattedChatId = formatChatIdForLink(chatId);
    chatUrl = `https://t.me/c/${formattedChatId}`;
  }

  const rows: Array<
    Array<ReturnType<typeof Markup.button.callback> | ReturnType<typeof Markup.button.url>>
  > = [];

  // Row 1: Open chat (only if URL available)
  if (chatUrl) {
    rows.push([
      Markup.button.url(
        '\uD83D\uDCAC Открыть чат', // Speech balloon
        chatUrl
      ),
    ]);
  }

  // Row 2: View feedback details
  rows.push([
    Markup.button.callback(
      '\uD83D\uDC41 Посмотреть отзыв', // Eye
      `view_feedback_${feedbackId}`
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

export default {
  buildAlertKeyboard,
  buildResolvedKeyboard,
  buildAccountantNotificationKeyboard,
  buildLowRatingAlertKeyboard,
};

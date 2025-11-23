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
  const {
    showChatLink = true,
    showNotifyButton = true,
    showResolveButton = true,
  } = options;

  const { alertId, chatId } = data;
  const formattedChatId = formatChatIdForLink(chatId);

  // Build rows of buttons
  type ButtonRow = ReturnType<typeof Markup.button.callback | typeof Markup.button.url>[];
  const rows: ButtonRow[] = [];

  // Row 1: Chat link
  if (showChatLink) {
    rows.push([
      Markup.button.url(
        '\uD83D\uDCAC Открыть чат', // Speech balloon
        `https://t.me/c/${formattedChatId}`
      ),
    ]);
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
 * @returns Telegraf Markup with inline keyboard
 */
export function buildResolvedKeyboard(
  chatId: string
): Markup.Markup<InlineKeyboardMarkup> {
  const formattedChatId = formatChatIdForLink(chatId);

  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        '\uD83D\uDCAC Открыть чат',
        `https://t.me/c/${formattedChatId}`
      ),
    ],
  ]);
}

/**
 * Build keyboard for accountant notification
 *
 * Shows a link to the chat where client is waiting.
 *
 * @param chatId - Telegram chat ID as string
 * @returns Telegraf Markup with inline keyboard
 */
export function buildAccountantNotificationKeyboard(
  chatId: string
): Markup.Markup<InlineKeyboardMarkup> {
  const formattedChatId = formatChatIdForLink(chatId);

  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        '\uD83D\uDCAC Открыть чат и ответить',
        `https://t.me/c/${formattedChatId}`
      ),
    ],
  ]);
}

export default {
  buildAlertKeyboard,
  buildResolvedKeyboard,
  buildAccountantNotificationKeyboard,
};

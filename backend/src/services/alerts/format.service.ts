/**
 * Alert Format Service
 *
 * Formats SLA alert messages for Telegram delivery.
 * Uses HTML parse mode for rich formatting.
 *
 * Message Structure:
 * - Alert type emoji and header
 * - Escalation level
 * - Client info (username)
 * - Message preview (truncated)
 * - Time elapsed vs threshold
 * - Chat info
 * - Call to action
 *
 * @module services/alerts/format.service
 */

/**
 * Data required to format an alert message
 */
export interface AlertMessageData {
  /** Type of alert: warning or breach */
  alertType: 'warning' | 'breach';
  /** Current escalation level (1-5) */
  escalationLevel: number;
  /** Client's Telegram username (may be null) */
  clientUsername: string | null;
  /** Preview of the client's message (will be truncated) */
  messagePreview: string;
  /** Minutes elapsed since request received */
  minutesElapsed: number;
  /** SLA threshold in minutes */
  threshold: number;
  /** Chat title (may be null for private chats) */
  chatTitle: string | null;
  /** Telegram chat ID as string */
  chatId: string;
  /** Request UUID */
  requestId: string;
}

/**
 * Escape HTML special characters for Telegram HTML mode
 *
 * Telegram's HTML parser requires escaping of <, >, &, and "
 *
 * @param text - Text to escape
 * @returns HTML-safe text
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Truncate text to specified length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 200)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Get alert emoji based on type
 *
 * @param alertType - Type of alert
 * @returns Emoji string
 */
function getAlertEmoji(alertType: 'warning' | 'breach'): string {
  return alertType === 'warning' ? '\u26A0\uFE0F' : '\uD83D\uDEA8'; // Warning sign or Police car light
}

/**
 * Get alert header text based on type
 *
 * @param alertType - Type of alert
 * @returns Header text in Russian
 */
function getAlertHeader(alertType: 'warning' | 'breach'): string {
  return alertType === 'warning' ? 'ПРЕДУПРЕЖДЕНИЕ SLA' : 'НАРУШЕНИЕ SLA';
}

/**
 * Format escalation level text
 *
 * @param level - Escalation level (1-5)
 * @returns Formatted escalation text
 */
function formatEscalationLevel(level: number): string {
  if (level <= 1) {
    return ''; // No escalation indicator for initial alert
  }
  return ` (УРОВЕНЬ ${level})`;
}

/**
 * Format client info line
 *
 * @param username - Client's Telegram username
 * @returns Formatted client line
 */
function formatClientInfo(username: string | null): string {
  if (username) {
    return `\uD83D\uDC64 Клиент: @${escapeHtml(username)}`; // Bust in silhouette
  }
  return '\uD83D\uDC64 Клиент: (неизвестен)';
}

/**
 * Format time info with comparison to threshold
 *
 * @param minutesElapsed - Minutes elapsed
 * @param threshold - SLA threshold in minutes
 * @returns Formatted time lines
 */
function formatTimeInfo(minutesElapsed: number, threshold: number): string {
  const lines = [
    `\u23F1 Время ожидания: ${minutesElapsed} мин`, // Stopwatch
    `\uD83D\uDCCA Порог SLA: ${threshold} мин`, // Bar chart
  ];
  return lines.join('\n');
}

/**
 * Format chat info line
 *
 * @param chatTitle - Chat title
 * @returns Formatted chat line
 */
function formatChatInfo(chatTitle: string | null): string {
  const title = chatTitle ? escapeHtml(chatTitle) : '(личный чат)';
  return `\uD83D\uDCAC Чат: ${title}`; // Speech balloon
}

/**
 * Format alert message for Telegram
 *
 * Creates a formatted HTML message with all alert details.
 * Use with { parse_mode: 'HTML' } when sending via Telegram.
 *
 * @param data - Alert message data
 * @returns Formatted HTML string
 *
 * @example
 * ```typescript
 * const message = formatAlertMessage({
 *   alertType: 'breach',
 *   escalationLevel: 2,
 *   clientUsername: 'client_user',
 *   messagePreview: 'Где мой счёт за прошлый месяц?',
 *   minutesElapsed: 65,
 *   threshold: 60,
 *   chatTitle: 'Бухгалтерия Компании',
 *   chatId: '-100123456789',
 *   requestId: 'uuid-123',
 * });
 *
 * await bot.telegram.sendMessage(managerId, message, { parse_mode: 'HTML' });
 * ```
 *
 * Output:
 * ```
 * POLICE_CAR_LIGHT НАРУШЕНИЕ SLA (УРОВЕНЬ 2)
 *
 * BUST_IN_SILHOUETTE Клиент: @client_user
 * MEMO Сообщение: Где мой счёт за прошлый месяц...
 * STOPWATCH Время ожидания: 65 мин
 * BAR_CHART Порог SLA: 60 мин
 * SPEECH_BALLOON Чат: Бухгалтерия Компании
 *
 * Действия требуются!
 * ```
 */
export function formatAlertMessage(data: AlertMessageData): string {
  const {
    alertType,
    escalationLevel,
    clientUsername,
    messagePreview,
    minutesElapsed,
    threshold,
    chatTitle,
  } = data;

  const emoji = getAlertEmoji(alertType);
  const header = getAlertHeader(alertType);
  const escalation = formatEscalationLevel(escalationLevel);
  const truncatedPreview = truncateText(messagePreview, 200);

  const lines = [
    `${emoji} <b>${header}${escalation}</b>`,
    '',
    formatClientInfo(clientUsername),
    `\uD83D\uDCDD Сообщение: ${escapeHtml(truncatedPreview)}`, // Memo
    formatTimeInfo(minutesElapsed, threshold),
    formatChatInfo(chatTitle),
    '',
    '<b>Действия требуются!</b>',
  ];

  return lines.join('\n');
}

/**
 * Format a short notification message
 *
 * Used for callback query answers and brief notifications.
 *
 * @param alertType - Type of alert
 * @param chatTitle - Chat title
 * @returns Short notification text
 */
export function formatShortNotification(
  alertType: 'warning' | 'breach',
  chatTitle: string | null
): string {
  const emoji = getAlertEmoji(alertType);
  const header = alertType === 'warning' ? 'Предупреждение' : 'Нарушение';
  const chat = chatTitle ? escapeHtml(chatTitle) : 'чат';

  return `${emoji} ${header} SLA: ${chat}`;
}

/**
 * Format accountant notification message
 *
 * Sent when manager clicks "Notify accountant" button.
 *
 * @param chatTitle - Chat title
 * @param minutesElapsed - Minutes elapsed
 * @param messagePreview - Preview of client message
 * @returns Formatted notification text
 */
export function formatAccountantNotification(
  chatTitle: string | null,
  minutesElapsed: number,
  messagePreview: string
): string {
  const title = chatTitle ? escapeHtml(chatTitle) : 'клиент';
  const preview = truncateText(messagePreview, 100);

  const lines = [
    `\uD83D\uDD14 <b>Требуется ваш ответ!</b>`, // Bell
    '',
    `\uD83D\uDCAC Чат: ${title}`,
    `\u23F1 Ожидание: ${minutesElapsed} мин`,
    '',
    `\uD83D\uDCDD Сообщение: <i>${escapeHtml(preview)}</i>`,
    '',
    'Пожалуйста, ответьте клиенту как можно скорее.',
  ];

  return lines.join('\n');
}

/**
 * Format resolution confirmation message
 *
 * Appended to alert message when resolved via button.
 *
 * @param action - Resolution action type
 * @returns Formatted confirmation text
 */
export function formatResolutionConfirmation(
  action: 'mark_resolved' | 'accountant_responded' | 'auto_expired'
): string {
  switch (action) {
    case 'mark_resolved':
      return '\n\n\u2705 Отмечено как решённое'; // White heavy check mark
    case 'accountant_responded':
      return '\n\n\u2705 Бухгалтер ответил клиенту';
    case 'auto_expired':
      return '\n\n\u23F0 Автоматически закрыто (макс. эскалаций)'; // Alarm clock
    default:
      return '\n\n\u2705 Решено';
  }
}

/**
 * Data required to format a breach chat notification
 */
export interface BreachChatNotificationData {
  /** Client's Telegram username (may be null) */
  clientUsername: string | null;
  /** Preview of the client's message (will be truncated) */
  messagePreview: string;
  /** SLA threshold in minutes */
  thresholdMinutes: number;
  /** Minutes elapsed since request received */
  minutesElapsed: number;
}

/**
 * Format breach notification for group chat
 *
 * Sent automatically to the chat when SLA is breached and notifyInChatOnBreach is enabled.
 *
 * @param data - Breach notification data
 * @returns Formatted HTML string
 */
export function formatBreachChatNotification(data: BreachChatNotificationData): string {
  const { clientUsername, messagePreview, thresholdMinutes, minutesElapsed } = data;

  const clientInfo = clientUsername ? `@${escapeHtml(clientUsername)}` : 'Клиент';
  const preview = truncateText(messagePreview, 100);

  const lines = [
    '\u26A0\uFE0F <b>ВНИМАНИЕ: Превышен срок ответа!</b>', // Warning sign
    '',
    `\uD83D\uDC64 ${clientInfo} ожидает ответа уже ${minutesElapsed} мин.`,
    `\uD83D\uDCCA Пороговое значение: ${thresholdMinutes} мин.`,
    '',
    `\uD83D\uDCDD Сообщение: <i>${escapeHtml(preview)}</i>`,
  ];

  return lines.join('\n');
}

export default {
  formatAlertMessage,
  formatShortNotification,
  formatAccountantNotification,
  formatResolutionConfirmation,
  formatBreachChatNotification,
  escapeHtml,
  truncateText,
};

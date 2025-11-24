/**
 * Template Keyboard Builder
 *
 * Creates inline keyboards for template selection.
 * Uses callback_data pattern: template:use:{templateId}
 *
 * Available Actions:
 * - Select template: Callback to send template with substitution
 *
 * Callback Data Format:
 * - template:use:{templateId}
 *
 * @module bot/keyboards/template
 */

import { Markup } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/types';
import type { TemplateCategory } from '../../generated/prisma/client.js';

/**
 * Category emoji mapping for better UX
 */
const CATEGORY_EMOJIS: Record<TemplateCategory, string> = {
  greeting: '\uD83D\uDC4B', // Waving hand
  status: '\uD83D\uDCCA', // Bar chart
  document_request: '\uD83D\uDCCB', // Clipboard
  reminder: '\u23F0', // Alarm clock
  closing: '\u2705', // Check mark
};

/**
 * Category names in Russian
 */
const CATEGORY_NAMES: Record<TemplateCategory, string> = {
  greeting: 'Приветствие',
  status: 'Статус',
  document_request: 'Запрос документов',
  reminder: 'Напоминание',
  closing: 'Завершение',
};

/**
 * Template data for keyboard generation
 */
export interface TemplateButtonData {
  /** Template ID */
  id: string;
  /** Template title */
  title: string;
  /** Template category */
  category: TemplateCategory;
}

/**
 * Creates an inline keyboard with template buttons
 *
 * Templates are grouped by category for better navigation.
 * Each button displays: emoji + truncated title
 *
 * @param templates - Array of templates to display
 * @returns Inline keyboard markup with template buttons
 *
 * @example
 * ```typescript
 * const templates = [
 *   { id: '1', title: 'Welcome message', category: 'greeting' },
 *   { id: '2', title: 'Document reminder', category: 'reminder' },
 * ];
 * const keyboard = createTemplateListKeyboard(templates);
 * await ctx.reply('Select a template:', keyboard);
 * ```
 */
export function createTemplateListKeyboard(
  templates: TemplateButtonData[]
): Markup.Markup<InlineKeyboardMarkup> {
  // Group templates by category
  const grouped = new Map<TemplateCategory, TemplateButtonData[]>();

  for (const template of templates) {
    const categoryTemplates = grouped.get(template.category) ?? [];
    categoryTemplates.push(template);
    grouped.set(template.category, categoryTemplates);
  }

  // Build keyboard rows (2 buttons per row)
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  for (const [category, categoryTemplates] of grouped) {
    const emoji = CATEGORY_EMOJIS[category];

    for (let i = 0; i < categoryTemplates.length; i += 2) {
      const row: ReturnType<typeof Markup.button.callback>[] = [];

      const first = categoryTemplates[i];
      if (first) {
        const truncatedTitle = truncateTitle(first.title, 25);
        row.push(
          Markup.button.callback(
            `${emoji} ${truncatedTitle}`,
            `template:use:${first.id}`
          )
        );
      }

      const second = categoryTemplates[i + 1];
      if (second) {
        const truncatedTitle = truncateTitle(second.title, 25);
        row.push(
          Markup.button.callback(
            `${emoji} ${truncatedTitle}`,
            `template:use:${second.id}`
          )
        );
      }

      if (row.length > 0) {
        rows.push(row);
      }
    }
  }

  // Add cancel button
  rows.push([Markup.button.callback('\u274C Отмена', 'template:cancel')]);

  return Markup.inlineKeyboard(rows);
}

/**
 * Truncate title to fit in button
 *
 * @param title - Original title
 * @param maxLength - Maximum length
 * @returns Truncated title with ellipsis if needed
 */
function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) {
    return title;
  }
  return title.slice(0, maxLength - 1) + '\u2026'; // ellipsis
}

/**
 * Get category display name with emoji
 *
 * @param category - Template category
 * @returns Display name with emoji
 */
export function getCategoryDisplay(category: TemplateCategory): string {
  const emoji = CATEGORY_EMOJIS[category];
  const name = CATEGORY_NAMES[category];
  return `${emoji} ${name}`;
}

/**
 * Messages for template operations
 */
export const TEMPLATE_MESSAGES = {
  /** Header for template list */
  LIST_HEADER: '\uD83D\uDCDD *Шаблоны сообщений*\n\nВыберите шаблон для отправки:',

  /** No templates available */
  NO_TEMPLATES: '\uD83D\uDCED Нет доступных шаблонов.\n\nОбратитесь к администратору для добавления шаблонов.',

  /** Template not found */
  NOT_FOUND: '\u26A0\uFE0F Шаблон не найден.',

  /** Template sent confirmation */
  SENT: '\u2705 Шаблон отправлен.',

  /** Operation cancelled */
  CANCELLED: '\u274C Отменено.',

  /** Invalid command usage */
  USAGE: `\uD83D\uDCDD *Использование команды /template*

/template - показать список шаблонов
/template list - показать список шаблонов
/template <id> - отправить шаблон по ID

*Переменные в шаблонах:*
\u2022 {{clientName}} - имя клиента
\u2022 {{accountantName}} - имя бухгалтера
\u2022 {{chatTitle}} - название чата
\u2022 {{date}} - текущая дата
\u2022 {{time}} - текущее время`,
};

/**
 * Parsed template callback data
 */
export interface TemplateCallbackData {
  /** Action type */
  action: 'use' | 'cancel';
  /** Template ID (only for 'use' action) */
  templateId?: string;
}

/**
 * Parse callback data from template button
 *
 * @param callbackData - The callback_data from button press
 * @returns Parsed data or null if invalid format
 *
 * @example
 * ```typescript
 * const data = parseTemplateCallback('template:use:abc-123');
 * // Returns: { action: 'use', templateId: 'abc-123' }
 *
 * const cancel = parseTemplateCallback('template:cancel');
 * // Returns: { action: 'cancel' }
 * ```
 */
export function parseTemplateCallback(
  callbackData: string
): TemplateCallbackData | null {
  if (callbackData === 'template:cancel') {
    return { action: 'cancel' };
  }

  const match = callbackData.match(/^template:use:(.+)$/);
  if (match?.[1]) {
    return { action: 'use', templateId: match[1] };
  }

  return null;
}

export default {
  createTemplateListKeyboard,
  getCategoryDisplay,
  parseTemplateCallback,
  TEMPLATE_MESSAGES,
};

/**
 * Client Menu Inline Keyboard
 *
 * Creates inline keyboard for client self-service menu.
 * Provides quick access to common client actions.
 *
 * Available Actions:
 * - Document status: View status of submitted documents
 * - Contact accountant: Request callback from accountant
 * - Request service: Submit new service request
 *
 * Callback Data Format:
 * - menu:doc_status
 * - menu:contact
 * - menu:request_service
 *
 * @module bot/keyboards/client-menu.keyboard
 */

import { Markup } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/types';

/**
 * Callback action identifiers for menu buttons
 */
export const MENU_CALLBACKS = {
  /** View document status */
  DOC_STATUS: 'menu:doc_status',
  /** Contact accountant */
  CONTACT: 'menu:contact',
  /** Request service */
  REQUEST_SERVICE: 'menu:request_service',
} as const;

/**
 * Response messages for menu actions (Russian)
 */
export const MENU_MESSAGES = {
  /** Menu title */
  MENU_TITLE: 'Выберите действие:',
  /** Document status placeholder */
  DOC_STATUS_RESPONSE:
    'Функция в разработке. Статус ваших документов будет доступен в ближайшее время.',
  /** Contact accountant confirmation */
  CONTACT_RESPONSE: 'Ваш запрос передан бухгалтеру. Ожидайте ответа.',
  /** Request service prompt */
  REQUEST_SERVICE_RESPONSE:
    'Опишите, какая услуга вам нужна, и мы свяжемся с вами.',
} as const;

/**
 * Build inline keyboard for client menu
 *
 * Creates a keyboard with self-service options for clients:
 * 1. "Document status" - View status of documents
 * 2. "Contact accountant" - Request callback
 * 3. "Request service" - Submit new service request
 *
 * @returns Telegraf Markup with inline keyboard
 *
 * @example
 * ```typescript
 * const keyboard = buildClientMenuKeyboard();
 *
 * await ctx.reply(MENU_MESSAGES.MENU_TITLE, keyboard);
 * ```
 */
export function buildClientMenuKeyboard(): Markup.Markup<InlineKeyboardMarkup> {
  return Markup.inlineKeyboard([
    // Row 1: Document status
    [
      Markup.button.callback(
        '\uD83D\uDCC4 Статус документов', // Page facing up emoji
        MENU_CALLBACKS.DOC_STATUS
      ),
    ],
    // Row 2: Contact accountant
    [
      Markup.button.callback(
        '\uD83D\uDC64 Связаться с бухгалтером', // Bust in silhouette emoji
        MENU_CALLBACKS.CONTACT
      ),
    ],
    // Row 3: Request service
    [
      Markup.button.callback(
        '\uD83D\uDCDD Запросить услугу', // Memo emoji
        MENU_CALLBACKS.REQUEST_SERVICE
      ),
    ],
  ]);
}

export default {
  buildClientMenuKeyboard,
  MENU_CALLBACKS,
  MENU_MESSAGES,
};

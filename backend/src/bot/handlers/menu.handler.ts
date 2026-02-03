/**
 * Client Menu Handler
 *
 * Handles /menu command and inline keyboard callbacks for client self-service menu.
 *
 * Features:
 * - /menu command to display inline menu
 * - menu:doc_status callback for document status
 * - menu:contact callback to request accountant contact
 * - menu:request_service callback for service requests
 *
 * @module bot/handlers/menu.handler
 */

import { bot } from '../bot.js';
import logger from '../../utils/logger.js';
import {
  buildClientMenuKeyboard,
  MENU_CALLBACKS,
  MENU_MESSAGES,
} from '../keyboards/client-menu.keyboard.js';

/**
 * Register menu command and callback handlers
 *
 * Must be called during bot initialization to enable
 * client menu functionality.
 *
 * Handlers:
 * 1. /menu command - Shows inline menu with action buttons
 * 2. menu:doc_status callback - Document status placeholder
 * 3. menu:contact callback - Accountant contact request
 * 4. menu:request_service callback - Service request prompt
 *
 * @example
 * ```typescript
 * import { registerMenuHandler } from './handlers/menu.handler.js';
 *
 * // During bot initialization
 * registerMenuHandler();
 * ```
 */
export function registerMenuHandler(): void {
  logger.info('Registering menu handlers', { service: 'menu-handler' });

  // Handle /menu command
  bot.command('menu', async (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    const username = ctx.from?.username;

    logger.info('Menu command received', {
      chatId,
      userId,
      username,
      service: 'menu-handler',
    });

    try {
      const keyboard = buildClientMenuKeyboard();
      await ctx.reply(MENU_MESSAGES.MENU_TITLE, keyboard);

      logger.debug('Menu displayed successfully', {
        chatId,
        userId,
        service: 'menu-handler',
      });
    } catch (error) {
      logger.error('Failed to display menu', {
        chatId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        service: 'menu-handler',
      });
    }
  });

  // Handle document status callback
  bot.action(MENU_CALLBACKS.DOC_STATUS, async (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;

    logger.info('Document status callback received', {
      chatId,
      userId,
      service: 'menu-handler',
    });

    try {
      await ctx.answerCbQuery();
      await ctx.reply(MENU_MESSAGES.DOC_STATUS_RESPONSE);

      logger.debug('Document status response sent', {
        chatId,
        userId,
        service: 'menu-handler',
      });
    } catch (error) {
      logger.error('Failed to handle doc_status callback', {
        chatId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        service: 'menu-handler',
      });
      await ctx.answerCbQuery('Error processing request').catch(() => {});
    }
  });

  // Handle contact accountant callback
  bot.action(MENU_CALLBACKS.CONTACT, async (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;

    logger.info('Contact accountant callback received', {
      chatId,
      userId,
      service: 'menu-handler',
    });

    try {
      await ctx.answerCbQuery();
      await ctx.reply(MENU_MESSAGES.CONTACT_RESPONSE);

      logger.debug('Contact response sent', {
        chatId,
        userId,
        service: 'menu-handler',
      });
    } catch (error) {
      logger.error('Failed to handle contact callback', {
        chatId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        service: 'menu-handler',
      });
      await ctx.answerCbQuery('Error processing request').catch(() => {});
    }
  });

  // Handle request service callback
  bot.action(MENU_CALLBACKS.REQUEST_SERVICE, async (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;

    logger.info('Request service callback received', {
      chatId,
      userId,
      service: 'menu-handler',
    });

    try {
      await ctx.answerCbQuery();
      await ctx.reply(MENU_MESSAGES.REQUEST_SERVICE_RESPONSE);

      logger.debug('Request service response sent', {
        chatId,
        userId,
        service: 'menu-handler',
      });
    } catch (error) {
      logger.error('Failed to handle request_service callback', {
        chatId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        service: 'menu-handler',
      });
      await ctx.answerCbQuery('Error processing request').catch(() => {});
    }
  });

  logger.info('Menu handlers registered', { service: 'menu-handler' });
}

export default registerMenuHandler;

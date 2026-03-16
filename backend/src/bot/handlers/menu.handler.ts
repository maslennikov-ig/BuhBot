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
import { prisma } from '../../lib/prisma.js';
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

  // Handle contact accountant callback — notify the assigned accountant
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

      if (!chatId) {
        await ctx.reply('Не удалось определить чат.');
        return;
      }

      // Find the chat and its primary accountant
      const chat = await prisma.chat.findFirst({
        where: { id: BigInt(chatId) },
        select: {
          title: true,
          accountantTelegramIds: true,
          inviteLink: true,
          chatType: true,
        },
      });

      const accountantTgId = chat?.accountantTelegramIds?.[0];

      if (accountantTgId) {
        const chatTitle = chat?.title ?? `Чат ${chatId}`;

        // Build chat link
        let chatUrl: string | undefined;
        if (chat?.inviteLink) {
          chatUrl = chat.inviteLink;
        } else if (chat?.chatType === 'supergroup') {
          const formattedId = String(chatId).startsWith('-100')
            ? String(chatId).slice(4)
            : String(chatId).replace('-', '');
          chatUrl = `https://t.me/c/${formattedId}`;
        }

        const keyboard = chatUrl
          ? { reply_markup: { inline_keyboard: [[{ text: '💬 Открыть чат', url: chatUrl }]] } }
          : {};

        await bot.telegram.sendMessage(
          String(accountantTgId),
          `📩 Клиент просит связаться!\n💬 Чат: ${chatTitle}`,
          keyboard
        );

        await ctx.reply('✅ Запрос отправлен бухгалтеру. Ожидайте ответа.');

        logger.info('Contact request sent to accountant', {
          chatId,
          accountantTgId: String(accountantTgId),
          service: 'menu-handler',
        });
      } else {
        await ctx.reply('⚠️ Ответственный бухгалтер не назначен для этого чата.');

        logger.warn('No accountant assigned for contact request', {
          chatId,
          service: 'menu-handler',
        });
      }
    } catch (error) {
      logger.error('Failed to handle contact callback', {
        chatId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        service: 'menu-handler',
      });
      await ctx.reply('Произошла ошибка при отправке запроса.').catch(() => {});
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

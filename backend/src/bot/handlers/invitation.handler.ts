/**
 * Invitation Handler
 *
 * Handles chat linking via invitation codes/tokens:
 * 1. Deep Linking: /start <token> (Private chats)
 * 2. Command: /connect <token> (Group chats)
 *
 * @module bot/handlers/invitation.handler
 */

import { bot, BotContext } from '../bot.js';
import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

// Token validation: alphanumeric, 8-64 characters
const TOKEN_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Validate invitation token format
 */
function isValidTokenFormat(token: string): boolean {
  return TOKEN_REGEX.test(token);
}

/**
 * Sanitize chat title to prevent XSS and control characters
 */
function sanitizeChatTitle(title: string | null | undefined): string {
  if (!title) return 'Новый чат';

  // Remove control characters and limit length
  const cleaned = title
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .trim()
    .substring(0, 255);

  return cleaned || 'Новый чат';
}

/**
 * Register invitation handlers
 */
export function registerInvitationHandler(): void {
  // Handle /start <token> (Deep Linking)
  bot.start(async (ctx: BotContext) => {
    try {
      // Parse payload from message text: "/start abc123" -> "abc123"
      const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      const parts = messageText.split(' ');
      const payload = parts.length > 1 ? parts.slice(1).join(' ').trim() : undefined;

      const chatId = ctx.chat?.id;
      const user = ctx.from;

      if (!payload || !chatId || !user) {
        // Normal start without token
        await ctx.reply('Привет! Я бот-бухгалтер. Чтобы подключить меня, попросите ссылку у вашего менеджера.');
        return;
      }

      logger.info('Processing invitation via /start', {
        chatId,
        tokenLength: payload.length,
        service: 'invitation-handler',
      });

      await processInvitation(ctx, payload, BigInt(chatId), ctx.chat.type);
      return;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling /start', {
        error: errorMessage,
        service: 'invitation-handler'
      });
      await ctx.reply('Произошла ошибка при обработке приглашения.');
      return;
    }
  });

  // Handle /connect <token> command
  bot.command('connect', async (ctx: BotContext) => {
    try {
      // Parse token from message text: "/connect 12345" -> "12345"
      const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      const token = text.split(' ')[1]?.trim();
      const chatId = ctx.chat?.id;

      if (!token) {
        await ctx.reply('Пожалуйста, укажите код приглашения. Пример: /connect abc123');
        return;
      }

      if (!chatId) {
        return;
      }

      logger.info('Processing invitation via /connect', {
        chatId,
        tokenLength: token.length,
        service: 'invitation-handler',
      });

      await processInvitation(ctx, token, BigInt(chatId), ctx.chat.type);
      return;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling /connect', {
        error: errorMessage,
        service: 'invitation-handler'
      });
      await ctx.reply('Произошла ошибка при подключении.');
      return;
    }
  });

  // Handle /help command
  bot.help(async (ctx: BotContext) => {
    try {
      const helpMessage = `📋 *Справка по боту*

🔹 /start — начать работу с ботом
🔹 /menu — открыть меню самообслуживания
🔹 /help — показать эту справку
🔹 /connect <код> — подключить групповой чат

*Как это работает:*
Бот помогает отслеживать время ответа на ваши сообщения. Когда вы пишете сообщение, бухгалтер получает уведомление и должен ответить в установленный срок.

*Нужна помощь?*
Обратитесь к вашему бухгалтеру или администратору системы.`;

      await ctx.reply(helpMessage, { parse_mode: 'Markdown' });

      logger.info('Help command processed', {
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        service: 'invitation-handler',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling /help', {
        error: errorMessage,
        service: 'invitation-handler'
      });
      await ctx.reply('Произошла ошибка при отображении справки.');
    }
  });

  logger.info('Invitation handler registered', { service: 'invitation-handler' });
}

/**
 * Core logic for processing an invitation token
 * Uses database transaction to prevent race conditions
 */
async function processInvitation(
  ctx: BotContext,
  token: string,
  chatId: bigint,
  chatType: string
): Promise<void> {
  // Validate token format before database lookup
  if (!isValidTokenFormat(token)) {
    logger.warn('Invalid token format attempted', {
      tokenLength: token.length,
      chatId,
      service: 'invitation-handler',
    });
    await ctx.reply('❌ Неверный формат кода приглашения.');
    return;
  }

  try {
    // Use transaction to prevent race condition (double-use of invitation)
    await prisma.$transaction(async (tx) => {
      // 1. Find the invitation in DB
      const invitation = await tx.chatInvitation.findUnique({
        where: { token },
      });

      if (!invitation) {
        throw new Error('INVALID_TOKEN');
      }

      if (invitation.isUsed) {
        throw new Error('ALREADY_USED');
      }

      if (invitation.expiresAt < new Date()) {
        throw new Error('EXPIRED');
      }

      // 2. Register or Update the Chat
      const rawTitle = (ctx.chat && 'title' in ctx.chat ? ctx.chat.title : null)
                    || invitation.initialTitle
                    || (ctx.from?.first_name ? `Чат с ${ctx.from.first_name}` : null);

      const title = sanitizeChatTitle(rawTitle);

      // Try to fetch invite link from Telegram API
      // Bot must be admin with invite_users permission
      let inviteLink: string | null = null;
      try {
        inviteLink = await ctx.telegram.exportChatInviteLink(Number(chatId));
        logger.info('Fetched invite link for chat', {
          chatId,
          hasInviteLink: !!inviteLink,
          service: 'invitation-handler',
        });
      } catch (error) {
        // Bot might not have permission to export invite links
        // This is not critical - we can still register the chat
        logger.warn('Failed to fetch invite link (bot might lack permissions)', {
          chatId,
          error: error instanceof Error ? error.message : String(error),
          service: 'invitation-handler',
        });
      }

      // Upsert Chat within transaction
      await tx.chat.upsert({
        where: { id: chatId },
        create: {
          id: chatId,
          chatType: chatType as 'private' | 'group' | 'supergroup',
          title: title,
          inviteLink: inviteLink,
          slaEnabled: true,
          monitoringEnabled: true,
          assignedAccountantId: invitation.assignedAccountantId,
        },
        update: {
          ...(invitation.assignedAccountantId && { assignedAccountantId: invitation.assignedAccountantId }),
          ...(inviteLink && { inviteLink: inviteLink }),
          slaEnabled: true,
          monitoringEnabled: true,
          title: title,
        }
      });

      // 3. Mark invitation as used (within same transaction)
      await tx.chatInvitation.update({
        where: { id: invitation.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
          createdChatId: chatId,
        }
      });
    }, {
      timeout: 10000, // 10 second timeout
    });

    // 4. Success Message (outside transaction)
    await ctx.reply('✅ Чат успешно подключен!\nТеперь мы на связи. История сообщений сохраняется.');

    logger.info('Invitation successfully processed', {
      chatId,
      tokenPrefix: token.substring(0, 8) + '...',
      service: 'invitation-handler'
    });
    return;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage === 'INVALID_TOKEN') {
      await ctx.reply('❌ Неверный или устаревший код приглашения.');
      return;
    }

    if (errorMessage === 'ALREADY_USED') {
      await ctx.reply('⚠️ Этот код приглашения уже был использован.');
      return;
    }

    if (errorMessage === 'EXPIRED') {
      await ctx.reply('⏰ Срок действия этого кода истек.');
      return;
    }

    // Log unexpected errors
    logger.error('Unexpected error processing invitation', {
      error: errorMessage,
      chatId,
      service: 'invitation-handler',
    });

    await ctx.reply('Произошла ошибка при обработке приглашения. Попробуйте позже.');
    return;
  }
}

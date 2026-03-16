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
import env from '../../config/env.js';
import { getBotInfo, privacyModeWarning } from '../utils/bot-info.js';
import { findUserByTelegramId } from '../utils/user.js';
import { hasMinRole } from '../utils/roles.js';

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
        await ctx.reply(
          'Привет! Я бот-бухгалтер. Чтобы подключить меня, попросите ссылку у вашего менеджера.'
        );
        return;
      }

      // Handle verification token (accountant Telegram linking)
      if (payload.startsWith('verify_')) {
        await processVerification(ctx, payload.substring(7));
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
        service: 'invitation-handler',
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
        service: 'invitation-handler',
      });
      await ctx.reply('Произошла ошибка при подключении.');
      return;
    }
  });

  // Handle /help command — contextual by role
  bot.help(async (ctx: BotContext) => {
    try {
      const lines: string[] = [
        '📋 *Справка по боту*',
        '',
        '🔹 /start — начать работу с ботом',
        '🔹 /menu — открыть меню самообслуживания',
        '🔹 /help — показать эту справку',
        '🔹 /connect <код> — подключить групповой чат',
      ];

      // Check if user is registered and add role-specific commands
      let userRole: string | null = null;
      if (ctx.from) {
        const user = await findUserByTelegramId(ctx.from.id);
        if (user) {
          userRole = user.role;
        }
      }

      if (userRole && hasMinRole(userRole, 'accountant')) {
        lines.push(
          '',
          '*Команды бухгалтера:*',
          '🔹 /mystats — ваша статистика',
          '🔹 /mychats — ваши чаты',
          '🔹 /newchat — создать приглашение для нового чата',
          '🔹 /notifications — настройки уведомлений',
          '🔹 /account — управление аккаунтом'
        );
      }

      if (userRole && hasMinRole(userRole, 'manager')) {
        lines.push('', '*Команды менеджера:*', '🔹 /diagnose — диагностика получения сообщений');
      }

      if (userRole && hasMinRole(userRole, 'admin')) {
        lines.push('', '*Команды администратора:*', '🔹 /info — информация о боте');
      }

      lines.push(
        '',
        '*Как это работает:*',
        'Бот помогает отслеживать время ответа на ваши сообщения. Когда вы пишете сообщение, бухгалтер получает уведомление и должен ответить в установленный срок.',
        '',
        '*Нужна помощь?*',
        'Обратитесь к вашему бухгалтеру или администратору системы.'
      );

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });

      logger.info('Help command processed', {
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        userRole,
        service: 'invitation-handler',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling /help', {
        error: errorMessage,
        service: 'invitation-handler',
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
    await prisma.$transaction(
      async (tx) => {
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
        const rawTitle =
          (ctx.chat && 'title' in ctx.chat ? ctx.chat.title : null) ||
          invitation.initialTitle ||
          (ctx.from?.first_name ? `Чат с ${ctx.from.first_name}` : null);

        const title = sanitizeChatTitle(rawTitle);

        // Try to fetch invite link from Telegram API
        // Bot must be admin with invite_users permission
        let inviteLink: string | null = null;
        try {
          inviteLink = await ctx.telegram.exportChatInviteLink(chatId.toString());
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
            ...(invitation.assignedAccountantId && {
              assignedAccountantId: invitation.assignedAccountantId,
            }),
            ...(inviteLink && { inviteLink: inviteLink }),
            slaEnabled: true,
            monitoringEnabled: true,
            title: title,
          },
        });

        // 3. Mark invitation as used (within same transaction)
        await tx.chatInvitation.update({
          where: { id: invitation.id },
          data: {
            isUsed: true,
            usedAt: new Date(),
            createdChatId: chatId,
          },
        });
      },
      {
        timeout: 10000, // 10 second timeout
      }
    );

    // 4. Success Message (outside transaction)
    await ctx.reply(
      '✅ Чат успешно подключен!\nТеперь мы на связи. История сообщений сохраняется.'
    );

    logger.info('Invitation successfully processed', {
      chatId,
      tokenPrefix: token.substring(0, 8) + '...',
      service: 'invitation-handler',
    });

    // 5. Check if bot can read messages (non-blocking)
    try {
      const botInfo = await getBotInfo();
      if (!botInfo.can_read_all_group_messages && chatType !== 'private') {
        const member = await ctx.telegram.getChatMember(chatId.toString(), botInfo.id);
        if (member.status !== 'administrator' && member.status !== 'creator') {
          await ctx.reply(privacyModeWarning(botInfo.username));
          logger.warn('Bot lacks admin rights with Privacy Mode ON after /connect', {
            chatId,
            chatType,
            botStatus: member.status,
            service: 'invitation-handler',
          });
        }
      }
    } catch (checkError) {
      // Non-blocking: don't fail /connect if this check fails
      logger.warn('Failed to check bot permissions after /connect', {
        chatId,
        error: checkError instanceof Error ? checkError.message : String(checkError),
        service: 'invitation-handler',
      });
    }

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

/**
 * Process Telegram verification token for accountant onboarding
 *
 * Links a Telegram account to a BuhBot user via verification token.
 * Token format: /start verify_<token>
 */
async function processVerification(ctx: BotContext, token: string): Promise<void> {
  const telegramUser = ctx.from;
  if (!telegramUser) {
    await ctx.reply('Не удалось определить пользователя Telegram.');
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Find verification token
      const verificationToken = await tx.verificationToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!verificationToken) {
        throw new Error('INVALID_TOKEN');
      }

      if (verificationToken.isUsed) {
        throw new Error('ALREADY_USED');
      }

      if (verificationToken.expiresAt < new Date()) {
        throw new Error('EXPIRED');
      }

      // 2. Check Telegram ID not already linked to another user
      const existingLink = await tx.user.findFirst({
        where: {
          telegramId: BigInt(telegramUser.id),
          id: { not: verificationToken.userId },
        },
      });

      if (existingLink) {
        throw new Error('TELEGRAM_ALREADY_LINKED');
      }

      // 3. Update user with Telegram info
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: {
          telegramId: BigInt(telegramUser.id),
          telegramUsername: telegramUser.username ?? null,
          isOnboardingComplete: true,
        },
      });

      // 4. Upsert TelegramAccount
      await tx.telegramAccount.upsert({
        where: { telegramId: BigInt(telegramUser.id) },
        create: {
          userId: verificationToken.userId,
          telegramId: BigInt(telegramUser.id),
          username: telegramUser.username ?? null,
          firstName: telegramUser.first_name ?? null,
          lastName: telegramUser.last_name ?? null,
          authDate: BigInt(Math.floor(Date.now() / 1000)),
        },
        update: {
          userId: verificationToken.userId,
          username: telegramUser.username ?? null,
          firstName: telegramUser.first_name ?? null,
          lastName: telegramUser.last_name ?? null,
        },
      });

      // 5. Mark token as used
      await tx.verificationToken.update({
        where: { id: verificationToken.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });
    });

    await ctx.reply(
      '✅ Верификация успешна!\n\nВаш аккаунт Telegram привязан к BuhBot.\n\n' +
        'Доступные команды:\n' +
        '/mystats — ваша статистика\n' +
        '/mychats — ваши чаты\n' +
        '/newchat — создать приглашение для нового чата\n' +
        '/account — управление аккаунтом и пароль',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 Личный кабинет', url: `${env.FRONTEND_URL}/settings/profile` }],
            [
              {
                text: '🔑 Установить пароль (по желанию)',
                callback_data: 'request_password_email',
              },
            ],
          ],
        },
      }
    );

    logger.info('Accountant verification successful', {
      telegramId: telegramUser.id,
      service: 'invitation-handler',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage === 'INVALID_TOKEN') {
      await ctx.reply('❌ Неверный или несуществующий токен верификации.');
      return;
    }
    if (errorMessage === 'ALREADY_USED') {
      await ctx.reply('⚠️ Этот токен верификации уже был использован.');
      return;
    }
    if (errorMessage === 'EXPIRED') {
      await ctx.reply('⏰ Срок действия токена верификации истёк. Обратитесь к администратору.');
      return;
    }
    if (errorMessage === 'TELEGRAM_ALREADY_LINKED') {
      await ctx.reply('⚠️ Ваш аккаунт Telegram уже привязан к другому пользователю BuhBot.');
      return;
    }

    logger.error('Unexpected error during verification', {
      error: errorMessage,
      telegramId: telegramUser.id,
      service: 'invitation-handler',
    });
    await ctx.reply('Произошла ошибка при верификации. Попробуйте позже.');
  }
}

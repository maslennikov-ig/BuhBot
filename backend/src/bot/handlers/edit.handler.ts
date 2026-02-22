/**
 * Edit Handler for Telegram Message Edits (Append-Only)
 *
 * Captures edited messages as new rows with incremented editVersion.
 * Never overwrites existing data — truth lives in the chat.
 *
 * Uses atomic INSERT...SELECT MAX(edit_version)+1...ON CONFLICT DO NOTHING
 * to prevent race conditions when parallel edited_message events arrive
 * for the same message.
 *
 * @module bot/handlers/edit.handler
 */

import { bot, BotContext } from '../bot.js';
import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { TelegramMessageSchema } from '../utils/telegram-schemas.js';

export function registerEditHandler(): void {
  bot.on('edited_message', async (ctx: BotContext) => {
    // Only process edited text messages in groups/supergroups
    if (!ctx.editedMessage) return;
    if (!('text' in ctx.editedMessage)) return;
    if (!ctx.chat || !['group', 'supergroup'].includes(ctx.chat.type)) return;

    const chatId = ctx.chat.id;
    const messageId = ctx.editedMessage.message_id;
    const newText = ctx.editedMessage.text;
    const editDate = ctx.editedMessage.edit_date ?? ctx.editedMessage.date;

    // Validate edited message data before database insertion
    const validationResult = TelegramMessageSchema.safeParse({
      text: newText,
      username: ctx.from?.username ?? null,
      firstName: ctx.from?.first_name ?? null,
      lastName: ctx.from?.last_name ?? null,
    });

    if (!validationResult.success) {
      logger.warn('Invalid edited message data, skipping', {
        chatId,
        messageId,
        errors: validationResult.error.flatten(),
        service: 'edit-handler',
      });
      return;
    }

    const chatIdBig = BigInt(chatId);
    const messageIdBig = BigInt(messageId);
    const telegramDate = new Date(editDate * 1000);
    const ctxUserId = BigInt(ctx.from?.id ?? 0);
    const ctxUsername = ctx.from?.username ?? null;
    const ctxFirstName = ctx.from?.first_name ?? null;
    const ctxLastName = ctx.from?.last_name ?? null;

    try {
      // Check if any prior version exists (for warning log only)
      const priorCount = await prisma.$queryRaw<[{ cnt: bigint }]>`
        SELECT COUNT(*)::bigint AS cnt
        FROM public.chat_messages
        WHERE chat_id = ${chatIdBig}
          AND message_id = ${messageIdBig}
      `;

      if (priorCount[0].cnt === 0n) {
        logger.warn('Edited message has no prior version in DB, storing as editVersion 0', {
          chatId,
          messageId,
          service: 'edit-handler',
        });
      }

      // Atomic insert: compute next edit_version inside the INSERT itself.
      // ON CONFLICT DO NOTHING prevents duplicate rows if two handlers
      // race on the same edit_version (the loser silently no-ops).
      const rowsInserted = await prisma.$executeRaw`
        INSERT INTO public.chat_messages (
          id,
          chat_id,
          message_id,
          telegram_user_id,
          username,
          first_name,
          last_name,
          message_text,
          is_accountant,
          reply_to_message_id,
          telegram_date,
          edit_version,
          message_type,
          created_at
        )
        SELECT
          gen_random_uuid(),
          ${chatIdBig},
          ${messageIdBig},
          COALESCE(prev.telegram_user_id, ${ctxUserId}),
          COALESCE(${ctxUsername}, prev.username),
          COALESCE(${ctxFirstName}, prev.first_name),
          COALESCE(${ctxLastName}, prev.last_name),
          ${newText},
          COALESCE(prev.is_accountant, false),
          prev.reply_to_message_id,
          ${telegramDate}::timestamptz,
          COALESCE(prev.max_version + 1, 0),
          COALESCE(prev.message_type, 'text'),
          NOW()
        FROM (
          SELECT
            MAX(edit_version) AS max_version,
            (array_agg(telegram_user_id ORDER BY edit_version DESC))[1] AS telegram_user_id,
            (array_agg(username ORDER BY edit_version DESC))[1] AS username,
            (array_agg(first_name ORDER BY edit_version DESC))[1] AS first_name,
            (array_agg(last_name ORDER BY edit_version DESC))[1] AS last_name,
            (array_agg(is_accountant ORDER BY edit_version DESC))[1] AS is_accountant,
            (array_agg(reply_to_message_id ORDER BY edit_version DESC))[1] AS reply_to_message_id,
            (array_agg(message_type ORDER BY edit_version DESC))[1] AS message_type
          FROM public.chat_messages
          WHERE chat_id = ${chatIdBig}
            AND message_id = ${messageIdBig}
        ) AS prev
        ON CONFLICT (chat_id, message_id, edit_version) DO NOTHING
      `;

      if (rowsInserted > 0) {
        logger.info('Edited message captured', {
          chatId,
          messageId,
          service: 'edit-handler',
        });
      } else {
        logger.warn('Edited message insert was a no-op (duplicate race or empty subquery)', {
          chatId,
          messageId,
          service: 'edit-handler',
        });
      }
    } catch (error) {
      logger.error('Error capturing edited message', {
        chatId,
        messageId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        service: 'edit-handler',
      });
    }
  });

  logger.info('Edit handler registered', { service: 'edit-handler' });
}

export default registerEditHandler;

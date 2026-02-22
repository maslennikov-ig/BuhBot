/**
 * Edit Handler for Telegram Message Edits (Append-Only)
 *
 * Captures edited messages as new rows with incremented editVersion.
 * Never overwrites existing data — truth lives in the chat.
 *
 * @module bot/handlers/edit.handler
 */

import { bot, BotContext } from '../bot.js';
import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

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

    try {
      // Find the current highest editVersion for this message
      const latestVersion = await prisma.chatMessage.findFirst({
        where: {
          chatId: BigInt(chatId),
          messageId: BigInt(messageId),
        },
        orderBy: { editVersion: 'desc' },
        select: {
          editVersion: true,
          telegramUserId: true,
          username: true,
          firstName: true,
          lastName: true,
          isAccountant: true,
          replyToMessageId: true,
          messageType: true,
        },
      });

      const nextVersion = (latestVersion?.editVersion ?? -1) + 1;

      // Edge case: original message was never logged (bot was down or not in chat yet)
      if (!latestVersion) {
        logger.warn('Edited message has no prior version in DB, storing as editVersion 0', {
          chatId,
          messageId,
          service: 'edit-handler',
        });
      }

      // Append-only: insert new version, never update existing
      await prisma.chatMessage.createMany({
        data: [
          {
            chatId: BigInt(chatId),
            messageId: BigInt(messageId),
            telegramUserId: latestVersion?.telegramUserId ?? BigInt(ctx.from?.id ?? 0),
            username: ctx.from?.username ?? latestVersion?.username ?? null,
            firstName: ctx.from?.first_name ?? latestVersion?.firstName ?? null,
            lastName: ctx.from?.last_name ?? latestVersion?.lastName ?? null,
            messageText: newText,
            isAccountant: latestVersion?.isAccountant ?? false,
            replyToMessageId: latestVersion?.replyToMessageId ?? null,
            telegramDate: new Date(editDate * 1000),
            editVersion: nextVersion,
            messageType: latestVersion?.messageType ?? 'text',
          },
        ],
        skipDuplicates: true,
      });

      logger.info('Edited message captured', {
        chatId,
        messageId,
        editVersion: nextVersion,
        service: 'edit-handler',
      });
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

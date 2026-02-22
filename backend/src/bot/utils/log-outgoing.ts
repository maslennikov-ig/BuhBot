/**
 * Utility for logging bot outgoing messages to ChatMessage (append-only)
 *
 * Wraps ctx.reply() to capture the bot's own messages in the message store.
 * This ensures the web panel shows the same messages as the Telegram chat.
 *
 * @module bot/utils/log-outgoing
 */

import type { Message } from 'telegraf/types';
import type { BotContext } from '../bot.js';
import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

/**
 * Send a reply and log it to ChatMessage as a bot outgoing message.
 *
 * @param ctx - Telegraf bot context
 * @param text - Message text to send
 * @param extra - Optional Telegraf reply extra parameters
 * @returns The sent message
 */
export async function replyAndLog(
  ctx: BotContext,
  text: string,
  extra?: Parameters<typeof ctx.reply>[1]
): Promise<Message.TextMessage> {
  const sent = await ctx.reply(text, extra);

  try {
    await prisma.chatMessage.createMany({
      data: [
        {
          chatId: BigInt(ctx.chat!.id),
          messageId: BigInt(sent.message_id),
          telegramUserId: BigInt(sent.from?.id ?? 0),
          username: sent.from?.username ?? 'BuhBot',
          firstName: sent.from?.first_name ?? 'BuhBot',
          messageText: text,
          isAccountant: false,
          isBotOutgoing: true,
          telegramDate: new Date(sent.date * 1000),
          editVersion: 0,
          messageType: 'text',
        },
      ],
      skipDuplicates: true,
    });
  } catch (error) {
    // Don't fail the reply if logging fails
    logger.warn('Failed to log outgoing bot message', {
      chatId: ctx.chat?.id,
      messageId: sent.message_id,
      error: error instanceof Error ? error.message : String(error),
      service: 'log-outgoing',
    });
  }

  return sent;
}

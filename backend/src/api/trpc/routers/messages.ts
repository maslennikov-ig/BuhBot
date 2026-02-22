/**
 * Messages Router - Chat Message History
 *
 * Procedures:
 * - listByChat: List messages for a chat with cursor-based pagination
 *
 * Uses raw SQL with DISTINCT ON to return only the latest edit_version
 * per (chat_id, message_id) pair, supporting the append-only ChatMessage model.
 *
 * @module api/trpc/routers/messages
 */

import { router, authedProcedure } from '../trpc.js';
import { requireChatAccess } from '../authorization.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { safeNumberFromBigInt } from '../../../utils/bigint.js';

/**
 * Raw row shape returned by the DISTINCT ON query (snake_case DB columns).
 */
type RawChatMessage = {
  id: string;
  chat_id: bigint;
  message_id: bigint;
  telegram_user_id: bigint;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  message_text: string;
  is_accountant: boolean;
  reply_to_message_id: bigint | null;
  created_at: Date;
  telegram_date: Date;
  edit_version: number;
  message_type: string;
  media_file_id: string | null;
  media_file_name: string | null;
  caption: string | null;
  is_bot_outgoing: boolean;
  deleted_at: Date | null;
  resolved_request_id: string | null;
};

// Simple in-memory rate limiter
// In production, consider using Redis for distributed rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries periodically (every 5 minutes)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetAt < now) {
        rateLimitMap.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

/**
 * Check rate limit for a user
 * @param userId - User identifier
 * @param limit - Max requests per window (default: 100)
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @throws TRPCError with TOO_MANY_REQUESTS if limit exceeded
 */
function checkRateLimit(userId: string, limit = 100, windowMs = 60000): void {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || userLimit.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (userLimit.count >= limit) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Превышен лимит запросов. Попробуйте позже.',
    });
  }

  userLimit.count++;
}

export const messagesRouter = router({
  /**
   * List messages for a chat with cursor-based pagination
   *
   * Returns the latest edit_version of each message (DISTINCT ON),
   * excludes soft-deleted messages, and paginates by telegramDate.
   *
   * @param chatId - Chat ID (Telegram chat ID)
   * @param limit - Number of messages to fetch (default: 50, max: 100)
   * @param cursor - Cursor for pagination (message UUID to start after)
   * @returns Messages with pagination info
   */
  listByChat: authedProcedure
    .input(
      z.object({
        chatId: z.number(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().uuid().optional(),
      })
    )
    .output(
      z.object({
        messages: z.array(
          z.object({
            id: z.string().uuid(),
            chatId: z.number(),
            messageId: z.number(),
            telegramUserId: z.number(),
            username: z.string().nullable(),
            firstName: z.string().nullable(),
            lastName: z.string().nullable(),
            messageText: z.string(),
            isAccountant: z.boolean(),
            replyToMessageId: z.number().nullable(),
            resolvedRequestId: z.string().uuid().nullable(),
            createdAt: z.date(),
            telegramDate: z.date(),
            editVersion: z.number(),
            messageType: z.string(),
            caption: z.string().nullable(),
            isBotOutgoing: z.boolean(),
          })
        ),
        nextCursor: z.string().uuid().nullable(),
        hasMore: z.boolean(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Rate limit: 100 requests per minute per user
      checkRateLimit(ctx.user.id, 100, 60000);

      // Verify chat exists
      const chat = await ctx.prisma.chat.findUnique({
        where: { id: BigInt(input.chatId) },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat with ID ${input.chatId} not found`,
        });
      }

      requireChatAccess(ctx.user, chat);

      // Resolve cursor to (telegramDate, id) for compound cursor pagination.
      // Telegram timestamps have second precision, so multiple messages can share
      // the same telegram_date. Using a compound (telegram_date, id) cursor with
      // tuple comparison ensures no messages are lost during pagination.
      let cursorDate: Date | null = null;
      let cursorId: string | null = null;
      if (input.cursor) {
        const cursorMessage = await ctx.prisma.chatMessage.findUnique({
          where: { id: input.cursor },
          select: { telegramDate: true, id: true },
        });

        if (cursorMessage) {
          cursorDate = cursorMessage.telegramDate;
          cursorId = cursorMessage.id;
        }
      }

      // Build compound cursor SQL fragment using tuple comparison.
      // (telegram_date, id) < (cursorDate, cursorId) correctly pages through
      // messages even when multiple messages share the same telegram_date.
      const cursorFragment =
        cursorDate && cursorId
          ? Prisma.sql`AND (telegram_date, id) < (${cursorDate}, ${cursorId}::uuid)`
          : Prisma.empty;

      // Fetch messages using DISTINCT ON to get only the latest edit_version
      // per (chat_id, message_id).
      // The subquery picks the highest edit_version per message;
      // the outer query filters soft-deleted rows (deleted_at IS NULL) AFTER
      // DISTINCT ON so that soft-delete applies to the latest version of
      // each message, then applies cursor pagination and LIMIT.
      const rawMessages = await ctx.prisma.$queryRaw<RawChatMessage[]>`
        SELECT * FROM (
          SELECT DISTINCT ON (chat_id, message_id) *
          FROM "public"."chat_messages"
          WHERE chat_id = ${BigInt(input.chatId)}
          ORDER BY chat_id, message_id, edit_version DESC
        ) sub
        WHERE deleted_at IS NULL
          ${cursorFragment}
        ORDER BY telegram_date DESC, id DESC
        LIMIT ${input.limit + 1}
      `;

      // Check if there are more messages
      const hasMore = rawMessages.length > input.limit;
      const resultMessages = hasMore ? rawMessages.slice(0, -1) : rawMessages;

      // Get next cursor
      const lastMessage = resultMessages[resultMessages.length - 1];
      const nextCursor = hasMore && lastMessage ? lastMessage.id : null;

      return {
        messages: resultMessages.map((msg) => ({
          id: msg.id,
          chatId: safeNumberFromBigInt(msg.chat_id),
          messageId: safeNumberFromBigInt(msg.message_id),
          telegramUserId: safeNumberFromBigInt(msg.telegram_user_id),
          username: msg.username,
          firstName: msg.first_name,
          lastName: msg.last_name,
          messageText: msg.message_text,
          isAccountant: msg.is_accountant,
          replyToMessageId: msg.reply_to_message_id
            ? safeNumberFromBigInt(msg.reply_to_message_id)
            : null,
          resolvedRequestId: msg.resolved_request_id,
          createdAt: msg.created_at,
          telegramDate: msg.telegram_date,
          editVersion: msg.edit_version,
          messageType: msg.message_type,
          caption: msg.caption,
          isBotOutgoing: msg.is_bot_outgoing,
        })),
        nextCursor,
        hasMore,
      };
    }),
});

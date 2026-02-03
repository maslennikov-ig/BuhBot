/**
 * Messages Router - Chat Message History
 *
 * Procedures:
 * - listByChat: List messages for a chat with cursor-based pagination
 *
 * @module api/trpc/routers/messages
 */

import { router, authedProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { safeNumberFromBigInt } from '../../../utils/bigint.js';

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

      // Build cursor condition (always fetch older messages for infinite scroll)
      let cursorCondition = {};
      if (input.cursor) {
        const cursorMessage = await ctx.prisma.chatMessage.findUnique({
          where: { id: input.cursor },
          select: { createdAt: true },
        });

        if (cursorMessage) {
          cursorCondition = {
            createdAt: { lt: cursorMessage.createdAt },
          };
        }
      }

      // Fetch messages (newest first, then reverse for display)
      const messages = await ctx.prisma.chatMessage.findMany({
        where: {
          chatId: BigInt(input.chatId),
          ...cursorCondition,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit + 1, // Fetch one extra to check if there are more
        select: {
          id: true,
          chatId: true,
          messageId: true,
          telegramUserId: true,
          username: true,
          firstName: true,
          lastName: true,
          messageText: true,
          isAccountant: true,
          replyToMessageId: true,
          resolvedRequestId: true,
          createdAt: true,
        },
      });

      // Check if there are more messages
      const hasMore = messages.length > input.limit;
      const resultMessages = hasMore ? messages.slice(0, -1) : messages;

      // Get next cursor
      const lastMessage = resultMessages[resultMessages.length - 1];
      const nextCursor = hasMore && lastMessage ? lastMessage.id : null;

      return {
        messages: resultMessages.map((msg) => ({
          ...msg,
          chatId: safeNumberFromBigInt(msg.chatId),
          messageId: safeNumberFromBigInt(msg.messageId),
          telegramUserId: safeNumberFromBigInt(msg.telegramUserId),
          replyToMessageId: msg.replyToMessageId
            ? safeNumberFromBigInt(msg.replyToMessageId)
            : null,
        })),
        nextCursor,
        hasMore,
      };
    }),
});

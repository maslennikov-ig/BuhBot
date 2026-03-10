/**
 * Authorization helpers for tRPC procedures
 *
 * Reusable functions for resource-level access control.
 *
 * @module api/trpc/authorization
 */

import { TRPCError } from '@trpc/server';

interface AuthUser {
  id: string;
  role: 'admin' | 'manager' | 'observer' | 'accountant';
}

interface ChatLike {
  assignedAccountantId: string | null;
}

/**
 * Require chat access: admins see any chat,
 * managers/accountants/observers only see chats assigned to them.
 *
 * Note: For manager scoping via managed accountants, use getScopedChatIds
 * before calling this function, or use requireChatAccessWithScoping.
 *
 * @param user - Authenticated user from context
 * @param chat - Chat (or object with assignedAccountantId)
 * @throws TRPCError FORBIDDEN if user has no access
 */
export function requireChatAccess(user: AuthUser, chat: ChatLike): void {
  if (user.role === 'admin') {
    return;
  }
  if (chat.assignedAccountantId !== user.id) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied. You can only access chats assigned to you.',
    });
  }
}

/**
 * Require chat access with full scoping support.
 * Checks if the chat ID is in the user's scoped chat list.
 *
 * @param user - Authenticated user from context
 * @param chatId - Chat ID (bigint)
 * @param scopedChatIds - Result from getScopedChatIds (null = unrestricted)
 * @throws TRPCError FORBIDDEN if user has no access
 */
export function requireChatAccessWithScoping(
  _user: AuthUser,
  chatId: bigint,
  scopedChatIds: bigint[] | null
): void {
  if (scopedChatIds === null) {
    return; // Admin: unrestricted
  }
  if (!scopedChatIds.some((id) => id === chatId)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied. You can only access chats assigned to you.',
    });
  }
}

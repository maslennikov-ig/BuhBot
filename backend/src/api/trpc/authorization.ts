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
  role: 'admin' | 'manager' | 'observer';
}

interface ChatLike {
  assignedAccountantId: string | null;
}

/**
 * Require chat access: admins/managers see any chat,
 * observers only see chats assigned to them.
 *
 * @param user - Authenticated user from context
 * @param chat - Chat (or object with assignedAccountantId)
 * @throws TRPCError FORBIDDEN if observer has no access
 */
export function requireChatAccess(user: AuthUser, chat: ChatLike): void {
  if (['admin', 'manager'].includes(user.role)) {
    return;
  }
  if (chat.assignedAccountantId !== user.id) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied. You can only access chats assigned to you.',
    });
  }
}

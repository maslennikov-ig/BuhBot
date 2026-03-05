/**
 * Role-based chat scoping helper
 *
 * Determines which chats a user can access based on their role:
 * - admin: all chats (returns null = no filter)
 * - manager: chats assigned to their accountants + directly assigned chats
 * - accountant/observer: only chats assigned to them
 *
 * @module api/trpc/helpers/scoping
 */

import type { PrismaClient } from '@prisma/client';

/**
 * Minimal Prisma client interface for scoping queries.
 * Works with both PrismaClient and transaction clients.
 */
interface ScopingPrismaClient {
  userManager: Pick<PrismaClient['userManager'], 'findMany'>;
  chat: Pick<PrismaClient['chat'], 'findMany'>;
}

/**
 * Get list of chat IDs accessible to a user based on their role.
 *
 * @param prisma - Prisma client or transaction client
 * @param userId - User UUID
 * @param role - User role
 * @returns Array of BigInt chat IDs, or null if user has unrestricted access (admin)
 */
export async function getScopedChatIds(
  prisma: ScopingPrismaClient,
  userId: string,
  role: string
): Promise<bigint[] | null> {
  // Admin: unrestricted access
  if (role === 'admin') {
    return null;
  }

  // Manager: access to chats assigned to their managed accountants + own assigned chats
  if (role === 'manager') {
    const managedRelations = await prisma.userManager.findMany({
      where: { managerId: userId },
      select: { accountantId: true },
    });
    const accountantIds = managedRelations.map((r) => r.accountantId);

    const allUserIds = [...new Set([...accountantIds, userId])];
    const chats = await prisma.chat.findMany({
      where: {
        assignedAccountantId: { in: allUserIds },
        deletedAt: null,
      },
      select: { id: true },
    });

    return chats.map((c) => c.id);
  }

  // Accountant/Observer: only chats where assignedAccountantId matches their user ID.
  // Note: observers are typically not assigned as accountants, so this usually returns [].
  // If observers should have unrestricted read access, return null here instead.
  const chats = await prisma.chat.findMany({
    where: {
      assignedAccountantId: userId,
      deletedAt: null,
    },
    select: { id: true },
  });

  return chats.map((c) => c.id);
}

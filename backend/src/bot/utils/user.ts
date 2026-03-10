/**
 * Shared bot utility for looking up users by Telegram ID.
 *
 * @module bot/utils/user
 */

import { prisma } from '../../lib/prisma.js';

/**
 * Look up the internal User record by Telegram user ID.
 * Returns null when not found.
 */
export async function findUserByTelegramId(telegramId: number) {
  return prisma.user.findFirst({
    where: { telegramId: BigInt(telegramId) },
  });
}

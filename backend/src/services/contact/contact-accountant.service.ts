/**
 * Contact Accountant Service
 *
 * Handles "Contact accountant" button logic with escalation:
 * 1. Find group chat for user (direct if group, via ChatMessage if private)
 * 2. Try accountant -> manager -> global managers
 * 3. Log every step
 *
 * @module services/contact/contact-accountant.service
 */

import { prisma } from '../../lib/prisma.js';
import { bot } from '../../bot/bot.js';
import { getGlobalSettings } from '../../config/config.service.js';
import logger from '../../utils/logger.js';

const SERVICE = 'contact-accountant';

export interface ContactRequest {
  userId: number;
  chatId: number;
  chatType: string;
  username?: string | undefined;
}

export interface ContactResult {
  success: boolean;
  notifiedRole: 'accountant' | 'manager' | 'global_manager' | 'none';
  notifiedIds: string[];
  failedIds: string[];
  groupChatId?: string | undefined;
  groupChatTitle?: string | undefined;
  userMessage: string;
}

const USER_MESSAGES = {
  SENT_TO_ACCOUNTANT:
    '\u2705 \u0417\u0430\u043f\u0440\u043e\u0441 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d \u0431\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0443. \u041e\u0436\u0438\u0434\u0430\u0439\u0442\u0435 \u043e\u0442\u0432\u0435\u0442\u0430.',
  SENT_TO_MANAGER:
    '\u2705 \u0417\u0430\u043f\u0440\u043e\u0441 \u043f\u0435\u0440\u0435\u0434\u0430\u043d \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u0443. \u041e\u0436\u0438\u0434\u0430\u0439\u0442\u0435 \u043e\u0442\u0432\u0435\u0442\u0430.',
  SENT_TO_GLOBAL:
    '\u2705 \u0417\u0430\u043f\u0440\u043e\u0441 \u043f\u0435\u0440\u0435\u0434\u0430\u043d \u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u043c\u0443 \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u0443. \u041e\u0436\u0438\u0434\u0430\u0439\u0442\u0435 \u043e\u0442\u0432\u0435\u0442\u0430.',
  NO_RECIPIENTS:
    '\u26a0\ufe0f \u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u043f\u0440\u043e\u0441. \u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0435 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0438 \u043d\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u044b.',
  ALL_BLOCKED:
    '\u26a0\ufe0f \u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0435 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0438 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.',
} as const;

/** Send notification to a list of Telegram IDs, return results */
async function sendToRecipients(
  recipientIds: string[],
  message: string,
  keyboard?: { reply_markup: { inline_keyboard: { text: string; url: string }[][] } }
): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];

  for (const id of recipientIds) {
    try {
      await bot.telegram.sendMessage(id, message, keyboard ?? {});
      sent.push(id);
      logger.info('Contact notification sent', { recipientId: id, service: SERVICE });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      failed.push(id);
      logger.warn('Contact notification failed', {
        recipientId: id,
        error: errMsg,
        service: SERVICE,
      });
    }
  }

  return { sent, failed };
}

/** Build "Open chat" keyboard from chat data */
function buildChatKeyboard(chat: {
  inviteLink: string | null;
  chatType: string;
  id: bigint;
}): { reply_markup: { inline_keyboard: { text: string; url: string }[][] } } | undefined {
  let chatUrl: string | undefined;
  if (chat.inviteLink) {
    chatUrl = chat.inviteLink;
  } else if (chat.chatType === 'supergroup') {
    const formatted = String(chat.id).startsWith('-100')
      ? String(chat.id).slice(4)
      : String(chat.id).replace('-', '');
    chatUrl = `https://t.me/c/${formatted}`;
  }
  return chatUrl
    ? {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '\ud83d\udcac \u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0447\u0430\u0442',
                url: chatUrl,
              },
            ],
          ],
        },
      }
    : undefined;
}

/**
 * Handle "Contact accountant" request with escalation chain.
 *
 * For private chats, resolves the user's group chat via ChatMessage history.
 * For group/supergroup chats, uses the chatId directly.
 *
 * Escalation: accountant -> chat manager -> global managers.
 */
export async function handleContactAccountant(req: ContactRequest): Promise<ContactResult> {
  logger.info('Contact accountant request started', {
    userId: req.userId,
    chatId: req.chatId,
    chatType: req.chatType,
    username: req.username,
    service: SERVICE,
  });

  // Step 1: Resolve group chat
  const chatSelect = {
    id: true,
    title: true,
    chatType: true,
    accountantTelegramIds: true,
    managerTelegramIds: true,
    inviteLink: true,
  } as const;

  let chat: {
    id: bigint;
    title: string | null;
    chatType: string;
    accountantTelegramIds: bigint[];
    managerTelegramIds: string[];
    inviteLink: string | null;
  } | null = null;

  if (req.chatType === 'group' || req.chatType === 'supergroup') {
    chat = await prisma.chat.findFirst({
      where: { id: BigInt(req.chatId), deletedAt: null },
      select: chatSelect,
    });
    logger.info('Group chat lookup (direct)', {
      found: !!chat,
      chatId: req.chatId,
      service: SERVICE,
    });
  } else {
    // Private chat: find user's most recent group via ChatMessage
    const latestMsg = await prisma.chatMessage.findFirst({
      where: {
        telegramUserId: BigInt(req.userId),
        chat: {
          chatType: { in: ['group', 'supergroup'] },
          deletedAt: null,
        },
      },
      orderBy: { telegramDate: 'desc' },
      select: { chatId: true },
    });

    logger.info('Group chat lookup via ChatMessage', {
      found: !!latestMsg,
      resolvedChatId: latestMsg ? String(latestMsg.chatId) : null,
      userId: req.userId,
      service: SERVICE,
    });

    if (latestMsg) {
      chat = await prisma.chat.findFirst({
        where: { id: latestMsg.chatId, deletedAt: null },
        select: chatSelect,
      });
    }
  }

  const groupChatId = chat ? String(chat.id) : undefined;
  const groupChatTitle = chat?.title ?? undefined;
  const chatTitle =
    chat?.title ??
    '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u0447\u0430\u0442';
  const userLabel = req.username ? `@${req.username}` : `ID: ${req.userId}`;
  const keyboard = chat ? buildChatKeyboard(chat) : undefined;

  // Step 2: Try accountant
  if (chat && chat.accountantTelegramIds.length > 0) {
    const ids = chat.accountantTelegramIds.map((id) => id.toString());
    logger.info('Trying accountant notification', {
      accountantIds: ids,
      groupChatId,
      service: SERVICE,
    });

    const msg = `\ud83d\udce9 \u041a\u043b\u0438\u0435\u043d\u0442 \u043f\u0440\u043e\u0441\u0438\u0442 \u0441\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f!\n\ud83d\udc64 ${userLabel}\n\ud83d\udcac \u0427\u0430\u0442: ${chatTitle}`;
    const { sent, failed } = await sendToRecipients(ids, msg, keyboard);

    if (sent.length > 0) {
      return {
        success: true,
        notifiedRole: 'accountant',
        notifiedIds: sent,
        failedIds: failed,
        groupChatId,
        groupChatTitle,
        userMessage: USER_MESSAGES.SENT_TO_ACCOUNTANT,
      };
    }
    logger.warn('All accountants unreachable, escalating to manager', {
      failedIds: failed,
      service: SERVICE,
    });
  }

  // Step 3: Try chat-specific managers
  if (chat && chat.managerTelegramIds.length > 0) {
    logger.info('Trying manager notification', {
      managerIds: chat.managerTelegramIds,
      groupChatId,
      service: SERVICE,
    });

    const msg = `\ud83d\udce9 \u041a\u043b\u0438\u0435\u043d\u0442 \u043f\u0440\u043e\u0441\u0438\u0442 \u0441\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f!\n\ud83d\udc64 ${userLabel}\n\u26a0\ufe0f \u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d.\n\ud83d\udcac \u0427\u0430\u0442: ${chatTitle}`;
    const { sent, failed } = await sendToRecipients(chat.managerTelegramIds, msg, keyboard);

    if (sent.length > 0) {
      return {
        success: true,
        notifiedRole: 'manager',
        notifiedIds: sent,
        failedIds: failed,
        groupChatId,
        groupChatTitle,
        userMessage: USER_MESSAGES.SENT_TO_MANAGER,
      };
    }
    logger.warn('All chat managers unreachable, escalating to global', {
      failedIds: failed,
      service: SERVICE,
    });
  }

  // Step 4: Try global managers
  const settings = await getGlobalSettings();
  const globalIds = settings.globalManagerIds.filter(Boolean);

  if (globalIds.length > 0) {
    logger.info('Trying global manager notification', {
      globalManagerIds: globalIds,
      service: SERVICE,
    });

    const msg = chat
      ? `\ud83d\udce9 \u041a\u043b\u0438\u0435\u043d\u0442 \u043f\u0440\u043e\u0441\u0438\u0442 \u0441\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f!\n\ud83d\udc64 ${userLabel}\n\u26a0\ufe0f \u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440 \u0438 \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440 \u043d\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u044b.\n\ud83d\udcac \u0427\u0430\u0442: ${chatTitle}`
      : `\ud83d\udce9 \u041a\u043b\u0438\u0435\u043d\u0442 \u043f\u0440\u043e\u0441\u0438\u0442 \u0441\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f!\n\ud83d\udc64 ${userLabel}\n\u26a0\ufe0f \u0420\u0430\u0431\u043e\u0447\u0438\u0439 \u0447\u0430\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.`;
    const { sent, failed } = await sendToRecipients(globalIds, msg, keyboard);

    if (sent.length > 0) {
      return {
        success: true,
        notifiedRole: 'global_manager',
        notifiedIds: sent,
        failedIds: failed,
        groupChatId,
        groupChatTitle,
        userMessage: USER_MESSAGES.SENT_TO_GLOBAL,
      };
    }
    logger.warn('All global managers unreachable', { failedIds: failed, service: SERVICE });

    return {
      success: false,
      notifiedRole: 'none',
      notifiedIds: [],
      failedIds: failed,
      groupChatId,
      groupChatTitle,
      userMessage: USER_MESSAGES.ALL_BLOCKED,
    };
  }

  // No recipients at all
  logger.warn('No recipients found for contact request', {
    hasChat: !!chat,
    accountants: chat?.accountantTelegramIds.length ?? 0,
    managers: chat?.managerTelegramIds.length ?? 0,
    globalManagers: globalIds.length,
    service: SERVICE,
  });

  return {
    success: false,
    notifiedRole: 'none',
    notifiedIds: [],
    failedIds: [],
    groupChatId,
    groupChatTitle,
    userMessage: USER_MESSAGES.NO_RECIPIENTS,
  };
}

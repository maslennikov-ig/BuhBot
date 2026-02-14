/**
 * Chat Event Handler
 *
 * Handles events related to chat membership:
 * - Bot added to a group/supergroup (my_chat_member)
 * - Bot removed from a group (my_chat_member)
 * - Chat title changes (new_chat_title)
 * - Group migration to supergroup (migrate_to_chat_id)
 *
 * automatically registers the chat in the database when the bot is added.
 *
 * @module bot/handlers/chat-event.handler
 */

import { bot, BotContext } from '../bot.js';
import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

/**
 * Register chat event handlers
 */
export function registerChatEventHandler(): void {
  // Handle when the bot's status in a chat changes (added, removed, promoted)
  bot.on('my_chat_member', async (ctx: BotContext) => {
    try {
      const update = ctx.myChatMember;
      if (!update) return;

      const chatId = update.chat.id;
      const chatType = update.chat.type;
      const newStatus = update.new_chat_member.status;
      const oldStatus = update.old_chat_member.status;
      const title = 'title' in update.chat ? update.chat.title : 'Private Chat';

      logger.info('Processing my_chat_member update', {
        chatId,
        chatType,
        newStatus,
        oldStatus,
        title,
        service: 'chat-event-handler',
      });

      // 1. Bot added or promoted in a group/supergroup/channel
      // We accept 'member' or 'administrator' as "active" states
      const isActive = ['member', 'administrator'].includes(newStatus);
      const wasActive = ['member', 'administrator'].includes(oldStatus);

      // Filter for supported chat types (groups)
      if (!['group', 'supergroup'].includes(chatType)) {
        logger.debug('Ignoring unsupported chat type', {
          chatId,
          chatType,
          service: 'chat-event-handler',
        });
        return;
      }

      if (isActive && !wasActive) {
        // Bot was ADDED to the chat
        logger.info('Bot added to chat', { chatId, title, service: 'chat-event-handler' });

        // Fetch default SLA threshold from GlobalSettings
        const globalSettings = await prisma.globalSettings.findUnique({
          where: { id: 'default' },
          select: { defaultSlaThreshold: true },
        });
        const defaultThreshold = globalSettings?.defaultSlaThreshold ?? 60;

        await prisma.chat.upsert({
          where: { id: BigInt(chatId) },
          create: {
            id: BigInt(chatId),
            chatType: chatType as 'group' | 'supergroup',
            title: title,
            slaEnabled: false, // Default to false for safety
            monitoringEnabled: true,
            is24x7Mode: false,
            slaThresholdMinutes: defaultThreshold,
          },
          update: {
            title: title,
            chatType: chatType as 'group' | 'supergroup',
            // Don't re-enable if it was manually disabled, but ensure we update title
          },
        });

        // Optional: Send a welcome message
        // await ctx.reply('Hello! I am ready to work. Please configure me in the dashboard.');
      } else if (!isActive && wasActive) {
        // Bot was REMOVED (kicked or left)
        logger.info('Bot removed from chat', { chatId, title, service: 'chat-event-handler' });

        // Option A: Delete the chat?
        // Option B: Mark as inactive? (We don't have an isActive flag on Chat, only monitoringEnabled)
        // Let's disable monitoring.
        await prisma.chat
          .update({
            where: { id: BigInt(chatId) },
            data: {
              monitoringEnabled: false,
              slaEnabled: false,
            },
          })
          .catch((err) => {
            // Chat might not exist if we never added it
            logger.warn('Failed to disable chat on remove (might not exist)', {
              chatId,
              error: err.message,
            });
          });
      }
    } catch (error) {
      logger.error('Error handling my_chat_member', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        service: 'chat-event-handler',
      });
    }
  });

  // Handle Chat Title Changes
  bot.on('new_chat_title', async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const newTitle = ctx.message.new_chat_title;

      logger.info('Chat title changed', { chatId, newTitle, service: 'chat-event-handler' });

      await prisma.chat
        .update({
          where: { id: BigInt(chatId) },
          data: { title: newTitle },
        })
        .catch(() => {
          logger.debug('Could not update title (chat likely not registered)', { chatId });
        });
    } catch (error) {
      logger.error('Error handling new_chat_title', { error });
    }
  });

  // Handle Group -> Supergroup Migration
  bot.on('migrate_to_chat_id', async (ctx) => {
    try {
      const oldChatId = ctx.chat.id;
      const newChatId = ctx.message.migrate_to_chat_id;

      logger.info('Group migrated to supergroup', {
        oldChatId,
        newChatId,
        service: 'chat-event-handler',
      });

      // Update the ID in the database
      // Prisma doesn't support changing IDs easily. We might need to create new and delete old,
      // or use raw SQL if we want to preserve history linked to the old ID.
      // For now, let's just create the new one and maybe flag the old one.
      // Actually, migration usually brings history.

      // Simple strategy: Create new chat record, move key properties.
      // Complex strategy: Update FKs.

      // Let's do a simple upsert for the new ID for now to ensure continuity of service.
      const oldChat = await prisma.chat.findUnique({ where: { id: BigInt(oldChatId) } });

      if (oldChat) {
        await prisma.chat.upsert({
          where: { id: BigInt(newChatId) },
          create: {
            id: BigInt(newChatId),
            chatType: 'supergroup',
            title: oldChat.title,
            slaEnabled: oldChat.slaEnabled,
            slaThresholdMinutes: oldChat.slaThresholdMinutes,
            monitoringEnabled: oldChat.monitoringEnabled,
            is24x7Mode: oldChat.is24x7Mode,
            managerTelegramIds: oldChat.managerTelegramIds,
            notifyInChatOnBreach: oldChat.notifyInChatOnBreach,
            accountantUsernames: oldChat.accountantUsernames,
            assignedAccountantId: oldChat.assignedAccountantId,
            inviteLink: oldChat.inviteLink,
          },
          update: {
            title: oldChat.title,
            slaEnabled: oldChat.slaEnabled,
            slaThresholdMinutes: oldChat.slaThresholdMinutes,
            monitoringEnabled: oldChat.monitoringEnabled,
            is24x7Mode: oldChat.is24x7Mode,
            managerTelegramIds: oldChat.managerTelegramIds,
            notifyInChatOnBreach: oldChat.notifyInChatOnBreach,
          },
        });
        // Disable old chat
        await prisma.chat.update({
          where: { id: BigInt(oldChatId) },
          data: {
            monitoringEnabled: false,
            slaEnabled: false,
            title: oldChat.title ? `[MIGRATED] ${oldChat.title}` : '[MIGRATED]',
          },
        });
      } else {
        // Just register as new
        await prisma.chat.upsert({
          where: { id: BigInt(newChatId) },
          create: {
            id: BigInt(newChatId),
            chatType: 'supergroup',
            title: 'Migrated Group',
            slaEnabled: false,
            monitoringEnabled: true,
          },
          update: {
            chatType: 'supergroup',
          },
        });
      }
    } catch (error) {
      logger.error('Error handling migration', { error });
    }
  });

  logger.info('Chat event handler registered', { service: 'chat-event-handler' });
}

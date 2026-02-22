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

/** Max chat title length stored in DB (gh-120) */
const MAX_TITLE_LENGTH = 255;

/** Sanitize chat title: trim, remove control chars, limit length (gh-120) */
function sanitizeChatTitle(title: string): string {
  return title
    .replace(/\p{C}/gu, '') // strip control/invisible Unicode characters
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
}

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
      const rawTitle = 'title' in update.chat ? update.chat.title : 'Private Chat';
      const title = sanitizeChatTitle(rawTitle);

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
      const newTitle = sanitizeChatTitle(ctx.message.new_chat_title);

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
    const oldChatId = ctx.chat.id;
    const newChatId = ctx.message.migrate_to_chat_id;
    const oldId = BigInt(oldChatId);
    const newId = BigInt(newChatId);

    try {
      logger.info('Group migrated to supergroup', {
        oldChatId,
        newChatId,
        service: 'chat-event-handler',
      });

      // Interactive transaction: all reads and writes inside tx to avoid TOCTOU races (buh-9g1)
      await prisma.$transaction(
        async (tx) => {
          const oldChat = await tx.chat.findUnique({ where: { id: oldId } });

          if (!oldChat) {
            // Old chat not found — just register the new supergroup
            await tx.chat.upsert({
              where: { id: newId },
              create: {
                id: newId,
                chatType: 'supergroup',
                title: 'Migrated Group',
                slaEnabled: false,
                monitoringEnabled: true,
              },
              update: {
                chatType: 'supergroup',
              },
            });
            return;
          }

          // 1. Upsert new chat with all fields from oldChat, including inviteLink in update (P3-2)
          await tx.chat.upsert({
            where: { id: newId },
            create: {
              id: newId,
              chatType: 'supergroup',
              title: oldChat.title,
              slaEnabled: oldChat.slaEnabled,
              slaThresholdMinutes: oldChat.slaThresholdMinutes,
              monitoringEnabled: oldChat.monitoringEnabled,
              is24x7Mode: oldChat.is24x7Mode,
              managerTelegramIds: oldChat.managerTelegramIds,
              notifyInChatOnBreach: oldChat.notifyInChatOnBreach,
              accountantUsernames: oldChat.accountantUsernames,
              accountantTelegramIds: oldChat.accountantTelegramIds,
              assignedAccountantId: oldChat.assignedAccountantId,
              clientTier: oldChat.clientTier,
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
              accountantUsernames: oldChat.accountantUsernames,
              accountantTelegramIds: oldChat.accountantTelegramIds,
              assignedAccountantId: oldChat.assignedAccountantId,
              clientTier: oldChat.clientTier,
              inviteLink: oldChat.inviteLink,
            },
          });

          // 2. Delete conflicting records in newId before migration to avoid unique constraint violations (P0-2)

          // ChatMessage: @@unique([chatId, messageId, editVersion])
          const existingNewMessages = await tx.chatMessage.findMany({
            where: { chatId: newId },
            select: { messageId: true, editVersion: true },
          });
          if (existingNewMessages.length > 0) {
            // Delete old-chat rows that would conflict with new-chat rows (single query instead of N+1)
            await tx.$executeRaw`
              DELETE FROM "public"."chat_messages"
              WHERE chat_id = ${oldId}
              AND (message_id, edit_version) IN (
                SELECT message_id, edit_version
                FROM "public"."chat_messages"
                WHERE chat_id = ${newId}
              )
            `;
          }

          // WorkingSchedule: @@unique([chatId, dayOfWeek])
          const existingNewSchedules = await tx.workingSchedule.findMany({
            where: { chatId: newId },
            select: { dayOfWeek: true },
          });
          if (existingNewSchedules.length > 0) {
            await tx.workingSchedule.deleteMany({
              where: {
                chatId: oldId,
                dayOfWeek: { in: existingNewSchedules.map((s) => s.dayOfWeek) },
              },
            });
          }

          // SurveyDelivery: @@unique([surveyId, chatId])
          const existingNewSurveys = await tx.surveyDelivery.findMany({
            where: { chatId: newId },
            select: { surveyId: true },
          });
          if (existingNewSurveys.length > 0) {
            await tx.surveyDelivery.deleteMany({
              where: {
                chatId: oldId,
                surveyId: { in: existingNewSurveys.map((s) => s.surveyId) },
              },
            });
          }

          // ChatHoliday: @@unique([chatId, date])
          const existingNewHolidays = await tx.chatHoliday.findMany({
            where: { chatId: newId },
            select: { date: true },
          });
          if (existingNewHolidays.length > 0) {
            await tx.chatHoliday.deleteMany({
              where: {
                chatId: oldId,
                date: { in: existingNewHolidays.map((h) => h.date) },
              },
            });
          }

          // 3. Migrate all child records (independent updateMany calls) + ChatInvitation.createdChatId (P2-3)
          const [
            movedMessages,
            movedRequests,
            movedSchedules,
            movedFeedback,
            movedSurveys,
            movedHolidays,
            movedInvitations,
          ] = await Promise.all([
            tx.chatMessage.updateMany({
              where: { chatId: oldId },
              data: { chatId: newId },
            }),
            tx.clientRequest.updateMany({
              where: { chatId: oldId },
              data: { chatId: newId },
            }),
            tx.workingSchedule.updateMany({
              where: { chatId: oldId },
              data: { chatId: newId },
            }),
            tx.feedbackResponse.updateMany({
              where: { chatId: oldId },
              data: { chatId: newId },
            }),
            tx.surveyDelivery.updateMany({
              where: { chatId: oldId },
              data: { chatId: newId },
            }),
            tx.chatHoliday.updateMany({
              where: { chatId: oldId },
              data: { chatId: newId },
            }),
            tx.chatInvitation.updateMany({
              where: { createdChatId: oldId },
              data: { createdChatId: newId },
            }),
          ]);

          // 4. Disable old chat
          await tx.chat.update({
            where: { id: oldId },
            data: {
              monitoringEnabled: false,
              slaEnabled: false,
              title: oldChat.title ? `[MIGRATED] ${oldChat.title}` : '[MIGRATED]',
            },
          });

          logger.info('Migrated related records to new supergroup ID', {
            oldChatId,
            newChatId,
            movedMessages: movedMessages.count,
            movedRequests: movedRequests.count,
            movedSchedules: movedSchedules.count,
            movedFeedback: movedFeedback.count,
            movedSurveys: movedSurveys.count,
            movedHolidays: movedHolidays.count,
            movedInvitations: movedInvitations.count,
            service: 'chat-event-handler',
          });
        },
        { timeout: 30000 }
      );
    } catch (error) {
      logger.error('Error handling migration', {
        oldChatId,
        newChatId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        service: 'chat-event-handler',
      });
    }
  });

  logger.info('Chat event handler registered', { service: 'chat-event-handler' });
}

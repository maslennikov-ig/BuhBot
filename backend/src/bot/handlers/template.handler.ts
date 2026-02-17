/**
 * Template Handler
 *
 * Handles /template command for sending pre-saved message templates.
 *
 * Commands:
 * - /template - Shows list of available templates with inline keyboard
 * - /template list - Same as /template
 * - /template {id} - Sends the template with variable substitution
 *
 * Features:
 * - Template list with category grouping
 * - Variable substitution ({{clientName}}, {{date}}, etc.)
 * - Usage tracking (increments usageCount)
 * - Inline keyboard for template selection
 *
 * @module bot/handlers/template
 */

import { bot } from '../bot.js';
import logger from '../../utils/logger.js';
import { prisma } from '../../lib/prisma.js';
import { substituteVariables, type VariableContext } from '../../services/templates/index.js';
import {
  createTemplateListKeyboard,
  parseTemplateCallback,
  TEMPLATE_MESSAGES,
  type TemplateButtonData,
} from '../keyboards/template.keyboard.js';

/**
 * Build variable context from Telegram message context
 *
 * @param from - Telegram user info
 * @param chat - Telegram chat info
 * @returns Variable context for substitution
 */
function buildVariableContext(
  from?: { first_name?: string; last_name?: string; username?: string },
  chat?: { title?: string }
): VariableContext {
  // Build client name from available data
  const firstName = from?.first_name ?? '';
  const lastName = from?.last_name ?? '';
  const clientNameRaw = [firstName, lastName].filter(Boolean).join(' ') || from?.username;

  // Only set values that are defined (avoid undefined)
  const context: VariableContext = {};

  if (clientNameRaw) {
    context.clientName = clientNameRaw;
  }

  if (chat?.title) {
    context.chatTitle = chat.title;
  }

  return context;
}

/**
 * Fetch active templates from database
 *
 * @returns Array of active templates ordered by usage count
 */
async function getActiveTemplates(): Promise<TemplateButtonData[]> {
  const templates = await prisma.template.findMany({
    where: {
      // All templates are active by default (no isActive field in current schema)
    },
    select: {
      id: true,
      title: true,
      category: true,
    },
    orderBy: [{ category: 'asc' }, { usageCount: 'desc' }],
  });

  return templates;
}

/**
 * Fetch template by ID
 *
 * @param id - Template ID
 * @returns Template or null
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getTemplateById(id: string) {
  // Validate UUID format before querying DB (gh-118)
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return prisma.template.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
    },
  });
}

/**
 * Increment template usage count
 *
 * @param id - Template ID
 */
async function incrementUsageCount(id: string): Promise<void> {
  try {
    await prisma.template.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });
  } catch (error) {
    // Log but don't fail the operation
    logger.warn('Failed to increment template usage count', {
      templateId: id,
      error: error instanceof Error ? error.message : String(error),
      service: 'template-handler',
    });
  }
}

/**
 * Show template list with inline keyboard
 *
 * @param ctx - Telegraf context with reply capability
 */
async function showTemplateList(ctx: {
  reply: (text: string, extra?: object) => Promise<unknown>;
}): Promise<void> {
  const templates = await getActiveTemplates();

  if (templates.length === 0) {
    await ctx.reply(TEMPLATE_MESSAGES.NO_TEMPLATES, { parse_mode: 'Markdown' });
    return;
  }

  const keyboard = createTemplateListKeyboard(templates);
  await ctx.reply(TEMPLATE_MESSAGES.LIST_HEADER, {
    parse_mode: 'Markdown',
    ...keyboard,
  });
}

/**
 * Send template with variable substitution
 *
 * @param reply - Reply function
 * @param from - Telegram user info
 * @param chat - Telegram chat info
 * @param templateId - Template ID to send
 */
async function sendTemplate(
  reply: (text: string, extra?: object) => Promise<unknown>,
  from: { first_name?: string; last_name?: string; username?: string } | undefined,
  chat: { title?: string; id?: number | string } | undefined,
  templateId: string
): Promise<void> {
  const template = await getTemplateById(templateId);

  if (!template) {
    await reply(TEMPLATE_MESSAGES.NOT_FOUND, { parse_mode: 'Markdown' });
    return;
  }

  // Build context and substitute variables
  const variableContext = buildVariableContext(from, chat);
  const substitutedContent = substituteVariables(template.content, variableContext);

  // Send the template content
  await reply(substitutedContent);

  // Track usage (fire and forget)
  void incrementUsageCount(templateId);

  logger.info('Template sent', {
    templateId,
    templateTitle: template.title,
    category: template.category,
    service: 'template-handler',
  });
}

/**
 * Register template command handlers
 *
 * Must be called during bot initialization to enable
 * template command handling and inline keyboard callbacks.
 *
 * Handlers:
 * 1. /template [list] - Shows available templates
 * 2. /template {id} - Sends specific template
 * 3. template:use:{id} callback - Handles inline keyboard selection
 * 4. template:cancel callback - Handles cancel button
 *
 * @example
 * ```typescript
 * import { registerTemplateHandler } from './handlers/template.handler.js';
 *
 * // During bot initialization
 * registerTemplateHandler();
 * ```
 */
export function registerTemplateHandler(): void {
  logger.info('Registering template command handlers', { service: 'template-handler' });

  // Handle /template command
  bot.command('template', async (ctx) => {
    const args = ctx.message.text.split(/\s+/).slice(1);
    const arg = args[0]?.toLowerCase();

    try {
      // /template or /template list - show template list
      if (!arg || arg === 'list') {
        await showTemplateList(ctx);
        return;
      }

      // /template help - show usage
      if (arg === 'help') {
        await ctx.reply(TEMPLATE_MESSAGES.USAGE, { parse_mode: 'Markdown' });
        return;
      }

      // /template {id} - send specific template
      await sendTemplate(
        ctx.reply.bind(ctx),
        ctx.from,
        ctx.chat && 'title' in ctx.chat
          ? { title: ctx.chat.title, id: ctx.chat.id }
          : { id: ctx.chat?.id },
        arg
      );
    } catch (error) {
      logger.error('Template command error', {
        error: error instanceof Error ? error.message : String(error),
        args,
        chatId: ctx.chat?.id,
        service: 'template-handler',
      });
      await ctx.reply(TEMPLATE_MESSAGES.NOT_FOUND, { parse_mode: 'Markdown' });
    }
  });

  // Handle template selection from inline keyboard
  bot.action(/^template:(use|cancel)/, async (ctx) => {
    // Get callback data safely with type guard
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) {
      await ctx.answerCbQuery('Invalid callback');
      return;
    }

    const callbackData = callbackQuery.data;
    const parsed = parseTemplateCallback(callbackData);
    if (!parsed) {
      await ctx.answerCbQuery('Invalid callback');
      return;
    }

    try {
      if (parsed.action === 'cancel') {
        await ctx.answerCbQuery('Cancelled');
        await ctx.editMessageText(TEMPLATE_MESSAGES.CANCELLED, { parse_mode: 'Markdown' });
        return;
      }

      if (parsed.action === 'use' && parsed.templateId) {
        const template = await getTemplateById(parsed.templateId);

        if (!template) {
          await ctx.answerCbQuery('Template not found');
          await ctx.editMessageText(TEMPLATE_MESSAGES.NOT_FOUND, { parse_mode: 'Markdown' });
          return;
        }

        // Build context and substitute variables
        const chat = ctx.chat && 'title' in ctx.chat ? { title: ctx.chat.title } : undefined;
        const variableContext = buildVariableContext(ctx.from, chat);
        const substitutedContent = substituteVariables(template.content, variableContext);

        // Update the message to show which template was selected
        await ctx.answerCbQuery(`Sending: ${template.title}`);
        await ctx.editMessageText(`\u2705 *Шаблон:* ${template.title}\n\n${substitutedContent}`, {
          parse_mode: 'Markdown',
        });

        // Track usage
        void incrementUsageCount(parsed.templateId);

        logger.info('Template sent via callback', {
          templateId: parsed.templateId,
          templateTitle: template.title,
          category: template.category,
          chatId: ctx.chat?.id,
          service: 'template-handler',
        });
      }
    } catch (error) {
      logger.error('Template callback error', {
        error: error instanceof Error ? error.message : String(error),
        callbackData,
        chatId: ctx.chat?.id,
        service: 'template-handler',
      });
      await ctx.answerCbQuery('Error processing template');
    }
  });

  logger.info('Template command handlers registered', { service: 'template-handler' });
}

export default registerTemplateHandler;

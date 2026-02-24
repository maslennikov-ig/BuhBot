/**
 * Telegram Bot Webhook Setup
 *
 * Configures Telegram bot to receive updates via webhook.
 * Used in production for efficient update delivery.
 *
 * Features:
 * - Secret token validation for security
 * - Integration with Express server
 * - Support for both webhook and polling modes
 *
 * @module bot/webhook
 */

import type { Application } from 'express';
import { bot } from './bot.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';
import { initBotInfo } from './utils/bot-info.js';

/** CR-14: Shared bot command list for both webhook and polling modes */
const BOT_COMMANDS = [
  { command: 'start', description: 'Начать работу с ботом' },
  { command: 'menu', description: 'Открыть меню' },
  { command: 'help', description: 'Помощь' },
  { command: 'connect', description: 'Подключить чат (код)' },
  { command: 'diagnose', description: 'Диагностика получения сообщений' },
];

/**
 * Configure bot defaults shared between webhook and polling modes.
 * Sets bot commands, default admin rights, and initializes bot info cache.
 */
async function configureBotDefaults(): Promise<void> {
  // Set bot commands for menu button
  await bot.telegram.setMyCommands(BOT_COMMANDS);
  logger.debug('Bot commands set successfully', { service: 'webhook' });

  // CR-2: Set suggested admin rights for groups. These are shown to users when
  // promoting the bot through Telegram's admin UI (independent of &admin= links).
  try {
    await bot.telegram.setMyDefaultAdministratorRights({
      rights: {
        is_anonymous: false,
        can_manage_chat: true,
        can_delete_messages: false,
        can_manage_video_chats: false,
        can_restrict_members: false,
        can_promote_members: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_manage_topics: false,
      },
      forChannels: false,
    });
    logger.info('Default administrator rights set (manage_chat only)', {
      service: 'webhook',
    });
  } catch (adminRightsError) {
    logger.warn('Failed to set default administrator rights', {
      error:
        adminRightsError instanceof Error ? adminRightsError.message : String(adminRightsError),
      service: 'webhook',
    });
  }

  // Initialize bot info cache and log Privacy Mode status
  await initBotInfo();
}

/**
 * Setup webhook for Telegram bot
 *
 * Registers the webhook URL with Telegram and attaches the
 * webhook callback middleware to the Express application.
 *
 * @param app - Express application instance
 * @param webhookPath - Path for webhook endpoint (e.g., '/webhook/telegram')
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { setupWebhook } from './bot/webhook.js';
 *
 * const app = express();
 * await setupWebhook(app, '/webhook/telegram');
 * ```
 */
export async function setupWebhook(app: Application, webhookPath: string): Promise<void> {
  const webhookUrl = env.TELEGRAM_WEBHOOK_URL;
  const secretToken = env.TELEGRAM_WEBHOOK_SECRET;

  if (!webhookUrl) {
    logger.warn('TELEGRAM_WEBHOOK_URL not set, skipping webhook setup', {
      service: 'webhook',
    });
    return;
  }

  const fullWebhookUrl = `${webhookUrl}${webhookPath}`;

  logger.info('Setting up Telegram webhook...', {
    webhookPath,
    webhookUrl: fullWebhookUrl,
    hasSecret: !!secretToken,
    service: 'webhook',
  });

  try {
    // Use createWebhook which handles both setWebhook and returns middleware
    // The middleware checks the path internally, so use app.use() without path
    const createWebhookOptions: {
      domain: string;
      path: string;
      drop_pending_updates?: boolean;
      secret_token?: string;
    } = {
      domain: webhookUrl,
      path: webhookPath,
      drop_pending_updates: false,
    };
    if (secretToken) {
      createWebhookOptions.secret_token = secretToken;
    }

    const webhookMiddleware = await bot.createWebhook(createWebhookOptions);

    // Attach middleware to Express with explicit path
    // createWebhook returns middleware that expects to be mounted at the root
    // but we need explicit path matching for Express routing
    app.post(webhookPath, webhookMiddleware);

    await configureBotDefaults();

    logger.info('Telegram webhook configured successfully', {
      webhookUrl: fullWebhookUrl,
      service: 'webhook',
    });
  } catch (error) {
    logger.error('Failed to setup Telegram webhook', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      webhookUrl: fullWebhookUrl,
      service: 'webhook',
    });
    throw error;
  }
}

/**
 * Remove webhook configuration
 *
 * Used when switching to polling mode or during cleanup.
 */
export async function removeWebhook(): Promise<void> {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    logger.info('Telegram webhook removed', { service: 'webhook' });
  } catch (error) {
    logger.error('Failed to remove Telegram webhook', {
      error: error instanceof Error ? error.message : String(error),
      service: 'webhook',
    });
  }
}

/**
 * Webhook info returned by Telegram API
 */
export interface WebhookInfoResult {
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

/**
 * Get current webhook info from Telegram
 *
 * @returns Webhook info from Telegram API
 */
export async function getWebhookInfo(): Promise<WebhookInfoResult> {
  try {
    const info = await bot.telegram.getWebhookInfo();
    logger.debug('Webhook info retrieved', {
      url: info.url,
      hasCustomCertificate: info.has_custom_certificate,
      pendingUpdateCount: info.pending_update_count,
      lastErrorDate: info.last_error_date,
      lastErrorMessage: info.last_error_message,
      service: 'webhook',
    });
    return info;
  } catch (error) {
    logger.error('Failed to get webhook info', {
      error: error instanceof Error ? error.message : String(error),
      service: 'webhook',
    });
    throw error;
  }
}

/**
 * Launch bot in polling mode (for development)
 *
 * Uses long polling instead of webhooks. Suitable for local development
 * where a public URL is not available.
 */
export async function launchPolling(): Promise<void> {
  logger.info('Launching Telegram bot in polling mode...', {
    service: 'webhook',
  });

  try {
    // Remove any existing webhook before starting polling
    await removeWebhook();

    // CR-8: Use same defaults as webhook mode
    await configureBotDefaults();

    // Start polling
    await bot.launch();

    logger.info('Telegram bot launched in polling mode', {
      service: 'webhook',
    });
  } catch (error) {
    logger.error('Failed to launch bot in polling mode', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: 'webhook',
    });
    throw error;
  }
}

export default {
  setupWebhook,
  removeWebhook,
  getWebhookInfo,
  launchPolling,
};

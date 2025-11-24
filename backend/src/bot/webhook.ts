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
export async function setupWebhook(
  app: Application,
  webhookPath: string
): Promise<void> {
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
    // Set webhook with Telegram API
    const webhookOptions: { secret_token?: string; drop_pending_updates?: boolean } = {
      drop_pending_updates: false,
    };
    if (secretToken) {
      webhookOptions.secret_token = secretToken;
    }
    await bot.telegram.setWebhook(fullWebhookUrl, webhookOptions);

    // Attach webhook callback middleware to Express
    // The middleware validates the secret token automatically
    app.use(webhookPath, (req, res, next) => {
      // Validate secret token if configured
      if (secretToken) {
        const receivedToken = req.headers['x-telegram-bot-api-secret-token'];
        if (receivedToken !== secretToken) {
          logger.warn('Invalid webhook secret token', {
            receivedToken: typeof receivedToken,
            service: 'webhook',
          });
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
      }
      next();
    }, bot.webhookCallback(webhookPath));

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

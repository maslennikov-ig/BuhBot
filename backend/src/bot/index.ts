/**
 * Telegram Bot Entry Point
 *
 * Exports bot instance, handlers, and webhook utilities.
 * Use this module to initialize and configure the Telegram bot.
 *
 * Setup Order:
 * 1. Import this module
 * 2. Call registerHandlers() to attach message handlers
 * 3. Either setupWebhook() or launchPolling() to start receiving updates
 *
 * @module bot
 *
 * @example
 * ```typescript
 * import { bot, registerHandlers, setupWebhook, launchPolling } from './bot/index.js';
 * import express from 'express';
 *
 * // Register all handlers
 * registerHandlers();
 *
 * // Production: Use webhook
 * const app = express();
 * await setupWebhook(app, '/webhook/telegram');
 *
 * // Development: Use polling
 * await launchPolling();
 * ```
 */

import { bot, stopBot, type BotContext } from './bot.js';
import { registerMessageHandler } from './handlers/message.handler.js';
import { registerResponseHandler } from './handlers/response.handler.js';
import {
  setupWebhook,
  removeWebhook,
  getWebhookInfo,
  launchPolling,
} from './webhook.js';
import logger from '../utils/logger.js';

/**
 * Register all bot message handlers
 *
 * Must be called before launching the bot in any mode.
 * Registers:
 * - Message handler for SLA monitoring (client messages)
 * - Response handler for accountant replies (SLA timer stop)
 * - (Future) Alert callback handler for inline buttons
 *
 * Handler Order:
 * 1. Message handler processes ALL text messages first
 *    - Classifies and creates ClientRequest for client messages
 *    - Skips if sender is accountant (no SLA tracking)
 * 2. Response handler processes accountant messages
 *    - Detects accountant replies
 *    - Stops SLA timers
 */
export function registerHandlers(): void {
  logger.info('Registering bot handlers...', { service: 'bot' });

  // Register message handler for SLA monitoring (processes client messages)
  registerMessageHandler();

  // Register response handler for accountant replies (stops SLA timers)
  registerResponseHandler();

  // TODO: Future handlers
  // registerAlertCallbackHandler();

  logger.info('Bot handlers registered successfully', { service: 'bot' });
}

// Re-export bot instance and types
export { bot, stopBot, type BotContext };

// Re-export webhook utilities
export {
  setupWebhook,
  removeWebhook,
  getWebhookInfo,
  launchPolling,
};

// Re-export individual handlers for testing
export { registerMessageHandler };
export { registerResponseHandler };

export default bot;

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
import { registerFaqHandler } from './handlers/faq.handler.js';
import { registerMessageHandler } from './handlers/message.handler.js';
import { registerResponseHandler } from './handlers/response.handler.js';
import { registerAlertCallbackHandler } from './handlers/alert-callback.handler.js';
import { registerSurveyHandler } from './handlers/survey.handler.js';
import { registerMenuHandler } from './handlers/menu.handler.js';
import { registerFileHandler } from './handlers/file.handler.js';
import { registerTemplateHandler } from './handlers/template.handler.js';
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
 * - FAQ handler for auto-responses (intercepts before SLA)
 * - Message handler for SLA monitoring (client messages)
 * - Response handler for accountant replies (SLA timer stop)
 * - Alert callback handler for inline buttons
 * - Survey handler for rating callbacks and comments
 * - Menu handler for client self-service
 * - File handler for document/photo uploads
 * - Template handler for /template command
 *
 * Handler Order (IMPORTANT - order matters for message handlers):
 * 1. FAQ handler - auto-responds to FAQ matches, stops propagation
 * 2. Message handler - classifies and tracks non-FAQ messages for SLA
 * 3. Response handler - detects accountant replies, stops SLA timers
 * 4. Alert callback handler - handles alert inline keyboard buttons
 * 5. Survey handler - handles rating callbacks and comments
 * 6. Menu handler - handles /menu command and self-service
 * 7. File handler - auto-confirms document/photo uploads
 * 8. Template handler - handles /template command for message templates
 */
export function registerHandlers(): void {
  logger.info('Registering bot handlers...', { service: 'bot' });

  // Register FAQ handler FIRST to intercept FAQ matches before SLA tracking
  registerFaqHandler();

  // Register message handler for SLA monitoring (processes client messages)
  registerMessageHandler();

  // Register response handler for accountant replies (stops SLA timers)
  registerResponseHandler();

  // Register alert callback handler for inline keyboard buttons
  registerAlertCallbackHandler();

  // Register survey handler for rating callbacks and comments
  registerSurveyHandler();

  // Register menu handler for client self-service menu
  registerMenuHandler();

  // Register file handler for auto-confirmation of document/photo uploads
  registerFileHandler();

  // Register template handler for /template command
  registerTemplateHandler();

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
export { registerFaqHandler };
export { registerMessageHandler };
export { registerResponseHandler };
export { registerAlertCallbackHandler };
export { registerSurveyHandler };
export { registerMenuHandler };
export { registerFileHandler };
export { registerTemplateHandler };

export default bot;

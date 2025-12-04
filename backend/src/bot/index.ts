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
import { registerChatEventHandler } from './handlers/chat-event.handler.js';
import { registerInvitationHandler } from './handlers/invitation.handler.js';
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
 * - Chat event handler for auto-registration of chats
 * - Invitation handler for /start and /connect commands
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
 * 2. Chat event handler - handles bot additions/removals
 * 3. Invitation handler - handles /start and /connect tokens
 * 4. Message handler - classifies and tracks non-FAQ messages for SLA
 * 5. Response handler - detects accountant replies, stops SLA timers
 * 6. Alert callback handler - handles alert inline keyboard buttons
 * 7. Survey handler - handles rating callbacks and comments
 * 8. Menu handler - handles /menu command and self-service
 * 9. File handler - auto-confirms document/photo uploads
 * 10. Template handler - handles /template command for message templates
 */
export function registerHandlers(): void {
  logger.info('Registering bot handlers...', { service: 'bot' });

  // Register FAQ handler FIRST to intercept FAQ matches before SLA tracking
  registerFaqHandler();

  // Register chat event handler (my_chat_member)
  registerChatEventHandler();

  // Register invitation handler (/start <token>, /connect <token>)
  registerInvitationHandler();

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
export { registerChatEventHandler };
export { registerInvitationHandler };
export { registerMessageHandler };
export { registerResponseHandler };
export { registerAlertCallbackHandler };
export { registerSurveyHandler };
export { registerMenuHandler };
export { registerFileHandler };
export { registerTemplateHandler };

export default bot;

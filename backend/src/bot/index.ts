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
import { registerSystemHandler } from './handlers/system.handler.js';
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
 * - Invitation handler for /start, /connect, /help commands
 * - System handler for /info, /version commands
 * - Menu handler for /menu command (BEFORE message handler!)
 * - Template handler for /template command (BEFORE message handler!)
 * - Message handler for SLA monitoring (client messages)
 * - Response handler for accountant replies (SLA timer stop)
 * - Alert callback handler for inline buttons
 * - Survey handler for rating callbacks and comments
 * - File handler for document/photo uploads
 *
 * Handler Order (IMPORTANT - order matters for message handlers):
 * 1. FAQ handler - auto-responds to FAQ matches, calls next() for non-matches
 * 2. Chat event handler - handles bot additions/removals (event-based)
 * 3. Invitation handler - handles /start, /connect, /help commands
 * 4. System handler - handles /info, /version commands
 * 5. Menu handler - handles /menu command (must be BEFORE generic message handlers)
 * 6. Template handler - handles /template command (must be BEFORE generic message handlers)
 * 7. Message handler - classifies and tracks text messages for SLA (groups only)
 * 8. Response handler - detects accountant replies, stops SLA timers
 * 9. Alert callback handler - handles alert inline keyboard buttons
 * 10. Survey handler - handles rating callbacks and comments
 * 11. File handler - auto-confirms document/photo uploads
 */
export function registerHandlers(): void {
  logger.info('Registering bot handlers...', { service: 'bot' });

  // Register FAQ handler FIRST to intercept FAQ matches before SLA tracking
  registerFaqHandler();

  // Register chat event handler (my_chat_member)
  registerChatEventHandler();

  // Register invitation handler (/start <token>, /connect <token>, /help)
  registerInvitationHandler();

  // Register system handler (/info, /version)
  registerSystemHandler();

  // Register menu handler for client self-service menu
  // IMPORTANT: Must be registered BEFORE message handler to ensure /menu command is processed
  registerMenuHandler();

  // Register template handler for /template command
  // IMPORTANT: Must be registered BEFORE message handler to ensure /template command is processed
  registerTemplateHandler();

  // Register message handler for SLA monitoring (processes client messages)
  // This handler captures all text messages, so command handlers must be registered before it
  registerMessageHandler();

  // Register response handler for accountant replies (stops SLA timers)
  registerResponseHandler();

  // Register alert callback handler for inline keyboard buttons
  registerAlertCallbackHandler();

  // Register survey handler for rating callbacks and comments
  registerSurveyHandler();

  // Register file handler for auto-confirmation of document/photo uploads
  registerFileHandler();

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

/**
 * Bot Handlers Index
 *
 * Exports all Telegram bot message handlers.
 *
 * Handler Registration Order:
 * 1. registerFaqHandler - FAQ auto-responses (intercepts before SLA)
 * 2. registerMessageHandler - SLA monitoring (creates ClientRequest)
 * 3. registerResponseHandler - Response tracking
 * 4. registerAlertCallbackHandler - Alert button callbacks
 * 5. registerSurveyHandler - Survey callbacks
 * 6. registerMenuHandler - Menu commands
 * 7. registerFileHandler - File handling
 * 8. registerTemplateHandler - Template commands
 *
 * @module bot/handlers
 */

export { registerFaqHandler } from './faq.handler.js';
export { registerMessageHandler } from './message.handler.js';
export { registerResponseHandler } from './response.handler.js';
export { registerAlertCallbackHandler } from './alert-callback.handler.js';
export { registerSurveyHandler, isAwaitingComment, getAwaitingCommentData } from './survey.handler.js';
export { registerMenuHandler } from './menu.handler.js';
export { registerFileHandler, formatFileSize, formatTimestamp } from './file.handler.js';
export { registerTemplateHandler } from './template.handler.js';

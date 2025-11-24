/**
 * Bot Handlers Index
 *
 * Exports all Telegram bot message handlers.
 *
 * @module bot/handlers
 */

export { registerMessageHandler } from './message.handler.js';
export { registerResponseHandler } from './response.handler.js';
export { registerAlertCallbackHandler } from './alert-callback.handler.js';
export { registerSurveyHandler, isAwaitingComment, getAwaitingCommentData } from './survey.handler.js';

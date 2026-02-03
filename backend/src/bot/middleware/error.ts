/**
 * Error Handling Middleware for Telegraf Bot
 *
 * Provides centralized error handling for all bot handlers.
 * Catches errors, logs them with context, and sends user-friendly
 * Russian error messages to users.
 *
 * Features:
 * - Catches all unhandled errors from downstream middleware
 * - Different messages for different error types
 * - Detailed logging with context (user ID, chat ID, update type)
 * - Never exposes internal errors to users
 * - Graceful degradation on reply failures
 *
 * @module bot/middleware/error
 */

import { Middleware, Context } from 'telegraf';
import logger from '../../utils/logger.js';

/**
 * Error messages in Russian for different error types
 */
const ERROR_MESSAGES = {
  /** Generic error message */
  generic: 'Произошла ошибка. Попробуйте позже или обратитесь к администратору.',
  /** Timeout error message */
  timeout: 'Превышено время ожидания. Попробуйте позже.',
  /** Network error message */
  network: 'Проблемы с сетью. Попробуйте позже.',
} as const;

/**
 * Known error patterns for classification
 */
const ERROR_PATTERNS = {
  timeout: [
    'timeout',
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
    'request timed out',
    'operation timed out',
    'socket hang up',
  ],
  network: [
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'network',
    'fetch failed',
    'connection refused',
    'connection reset',
  ],
} as const;

/**
 * Classifies an error into a known category
 *
 * @param error - The error to classify
 * @returns Error category key or 'generic' if unknown
 */
function classifyError(error: unknown): keyof typeof ERROR_MESSAGES {
  const errorString = getErrorString(error).toLowerCase();

  // Check timeout patterns
  for (const pattern of ERROR_PATTERNS.timeout) {
    if (errorString.includes(pattern.toLowerCase())) {
      return 'timeout';
    }
  }

  // Check network patterns
  for (const pattern of ERROR_PATTERNS.network) {
    if (errorString.includes(pattern.toLowerCase())) {
      return 'network';
    }
  }

  return 'generic';
}

/**
 * Extracts error message string from unknown error type
 *
 * @param error - The error to extract message from
 * @returns Error message string
 */
function getErrorString(error: unknown): string {
  if (error instanceof Error) {
    // Include error code if available (e.g., Node.js system errors)
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code) {
      return `${nodeError.code}: ${error.message}`;
    }
    return error.message;
  }
  return String(error);
}

/**
 * Extracts stack trace from error if available
 *
 * @param error - The error to extract stack from
 * @returns Stack trace string or undefined
 */
function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Extracts error code from Node.js system errors
 *
 * @param error - The error to extract code from
 * @returns Error code string or undefined
 */
function getErrorCode(error: unknown): string | undefined {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    return nodeError.code;
  }
  return undefined;
}

/**
 * Creates an error handling middleware for Telegraf bot
 *
 * Should be placed early in the middleware chain to catch
 * all errors from downstream handlers and middleware.
 *
 * @returns Telegraf middleware function
 *
 * @example
 * ```typescript
 * import { errorMiddleware } from './middleware/error.js';
 *
 * // Apply early in middleware chain
 * bot.use(errorMiddleware());
 *
 * // All errors from subsequent handlers will be caught
 * bot.on('message', async (ctx) => {
 *   throw new Error('Something went wrong');
 *   // User will receive: "Произошла ошибка. Попробуйте позже..."
 * });
 * ```
 */
export function errorMiddleware(): Middleware<Context> {
  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    try {
      await next();
    } catch (error) {
      // Extract error details
      const errorMessage = getErrorString(error);
      const errorStack = getErrorStack(error);
      const errorCode = getErrorCode(error);
      const errorType = classifyError(error);

      // Log error with full context
      logger.error('Bot handler error', {
        error: errorMessage,
        errorCode,
        errorType,
        stack: errorStack,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        chatId: ctx.chat?.id,
        chatType: ctx.chat?.type,
        updateType: ctx.updateType,
        updateId: ctx.update?.update_id,
        // Include message text if available (truncated for safety)
        messageText:
          'message' in ctx.update && ctx.update.message && 'text' in ctx.update.message
            ? ctx.update.message.text?.substring(0, 100)
            : undefined,
        service: 'telegram-bot',
      });

      // Get appropriate user-facing message
      const userMessage = ERROR_MESSAGES[errorType];

      // Try to send error message to user
      try {
        await ctx.reply(userMessage);
      } catch (replyError) {
        // Failed to send error message - user might have blocked bot or chat unavailable
        logger.warn('Failed to send error message to user', {
          originalError: errorMessage,
          replyError: replyError instanceof Error ? replyError.message : String(replyError),
          userId: ctx.from?.id,
          chatId: ctx.chat?.id,
          service: 'telegram-bot',
        });
      }

      // Re-throw to allow bot.catch() to also handle if needed
      // This is optional - remove if you want errors to stop here
      // throw error;
    }
  };
}

export default errorMiddleware;

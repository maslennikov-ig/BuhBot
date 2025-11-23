/**
 * Bot Middleware Exports
 *
 * Centralizes all bot middleware for easy importing.
 * Apply middleware in the recommended order for optimal behavior.
 *
 * Recommended middleware order:
 * 1. errorMiddleware() - Catches all errors (wrap everything)
 * 2. rateLimitMiddleware() - Prevents abuse
 * 3. [custom middleware] - Your business logic
 * 4. [handlers] - Message and command handlers
 *
 * @module bot/middleware
 *
 * @example
 * ```typescript
 * import { errorMiddleware, rateLimitMiddleware } from './middleware/index.js';
 *
 * // Apply in order
 * bot.use(errorMiddleware());
 * bot.use(rateLimitMiddleware({ maxRequests: 30, windowMs: 60000 }));
 *
 * // Then register handlers
 * bot.on('message', handleMessage);
 * ```
 */

export {
  rateLimitMiddleware,
  type RateLimitOptions,
} from './rate-limit.js';

export {
  errorMiddleware,
} from './error.js';

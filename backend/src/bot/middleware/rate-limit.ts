/**
 * Rate Limiting Middleware for Telegraf Bot
 *
 * Implements user-based rate limiting using Redis sliding window algorithm.
 * Protects the bot from abuse and ensures fair usage across all users.
 *
 * Features:
 * - Distributed rate limiting via Redis
 * - Sliding window algorithm for smooth rate limiting
 * - Configurable limits per user
 * - Polite Russian error messages
 * - Detailed logging for violations
 *
 * @module bot/middleware/rate-limit
 */

import { Middleware, Context } from 'telegraf';
import { redis } from '../../lib/redis.js';
import logger from '../../utils/logger.js';

/**
 * Rate limit configuration options
 */
export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60000 - 1 minute) */
  windowMs?: number;
  /** Maximum requests allowed in the window (default: 30) */
  maxRequests?: number;
  /** Redis key prefix for rate limit counters (default: 'ratelimit:') */
  keyPrefix?: string;
}

/**
 * Default rate limit configuration
 */
const DEFAULT_OPTIONS: Required<RateLimitOptions> = {
  windowMs: 60000, // 1 minute
  maxRequests: 30, // 30 requests per minute
  keyPrefix: 'ratelimit:',
};

/**
 * Rate limit error message in Russian
 */
const RATE_LIMIT_MESSAGE = 'Слишком много запросов. Пожалуйста, подождите немного.';

/**
 * Creates a rate limiting middleware for Telegraf bot
 *
 * Uses Redis sliding window algorithm:
 * - Each user has a sorted set in Redis
 * - Timestamps are stored as scores
 * - Old entries (outside window) are removed on each check
 * - Remaining entries are counted against the limit
 *
 * @param options - Rate limit configuration
 * @returns Telegraf middleware function
 *
 * @example
 * ```typescript
 * import { rateLimitMiddleware } from './middleware/rate-limit.js';
 *
 * // Default: 30 requests per minute
 * bot.use(rateLimitMiddleware());
 *
 * // Custom: 10 requests per 30 seconds
 * bot.use(rateLimitMiddleware({
 *   windowMs: 30000,
 *   maxRequests: 10,
 * }));
 * ```
 */
export function rateLimitMiddleware(options?: RateLimitOptions): Middleware<Context> {
  const config: Required<RateLimitOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    // Skip rate limiting if no user ID (shouldn't happen in normal usage)
    const userId = ctx.from?.id;
    if (!userId) {
      return next();
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;
    const key = `${config.keyPrefix}${userId}`;

    try {
      // Execute Redis commands in a pipeline for efficiency
      const pipeline = redis.pipeline();

      // Remove old entries outside the current window
      pipeline.zremrangebyscore(key, '-inf', windowStart);

      // Count remaining entries in the window
      pipeline.zcard(key);

      // Add current request timestamp
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry to clean up after window passes
      pipeline.expire(key, Math.ceil(config.windowMs / 1000) + 1);

      const results = await pipeline.exec();

      // Check if pipeline executed successfully
      if (!results) {
        logger.warn('Rate limit pipeline returned null, allowing request', {
          userId,
          service: 'rate-limiter',
        });
        return next();
      }

      // Get count from second command (zcard)
      const countResult = results[1];
      if (!countResult || countResult[0]) {
        // Error in zcard command, allow request but log
        logger.warn('Rate limit zcard error, allowing request', {
          userId,
          error: countResult?.[0],
          service: 'rate-limiter',
        });
        return next();
      }

      const currentCount = countResult[1] as number;

      // Check if rate limit exceeded
      if (currentCount >= config.maxRequests) {
        logger.warn('Rate limit exceeded', {
          userId,
          username: ctx.from?.username,
          chatId: ctx.chat?.id,
          currentCount,
          maxRequests: config.maxRequests,
          windowMs: config.windowMs,
          updateType: ctx.updateType,
          service: 'rate-limiter',
        });

        // Send polite Russian error message
        try {
          await ctx.reply(RATE_LIMIT_MESSAGE);
        } catch (replyError) {
          // User might have blocked the bot or chat is unavailable
          logger.debug('Failed to send rate limit message', {
            userId,
            error: replyError instanceof Error ? replyError.message : String(replyError),
            service: 'rate-limiter',
          });
        }

        // Stop processing - do not call next()
        return;
      }

      // Request allowed, continue to next middleware
      return next();
    } catch (error) {
      // Redis error - log and allow request to prevent blocking users
      logger.error('Rate limit middleware Redis error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        service: 'rate-limiter',
      });

      // Fail open - allow request if Redis is unavailable
      return next();
    }
  };
}

export default rateLimitMiddleware;

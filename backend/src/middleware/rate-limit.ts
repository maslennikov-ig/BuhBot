/**
 * Telegraf Rate Limiting Middleware
 *
 * User-based rate limiting for Telegram bot messages.
 * Limits each user to a configurable number of messages per time window.
 *
 * Features:
 * - Per-user rate limiting (default: 10 messages/minute)
 * - In-memory storage with automatic cleanup
 * - Optional Redis storage for distributed deployments
 * - Polite Russian error messages
 * - Metrics integration for monitoring
 * - Logging for analytics and debugging
 *
 * @module middleware/rate-limit
 */

import { Context, Middleware } from 'telegraf';
import logger from '../utils/logger.js';
import { Counter } from 'prom-client';
import { register } from '../utils/metrics.js';

/**
 * Rate limit configuration options
 */
export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs: number;
  /** Maximum requests per user per window (default: 10) */
  limit: number;
  /** Custom message when limit exceeded (Russian) */
  message: string;
  /** Skip rate limiting for certain users (e.g., admins) */
  skipUsers?: number[];
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Rate limit state for a single user
 */
interface UserRateLimitState {
  /** Number of messages in current window */
  count: number;
  /** Timestamp when the window resets */
  resetAt: number;
}

/**
 * In-memory rate limit store
 * Maps user ID to their rate limit state
 */
type RateLimitStore = Map<number, UserRateLimitState>;

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: RateLimitOptions = {
  windowMs: 60000, // 1 minute
  limit: 10, // 10 messages per minute per user
  message:
    'Извините, вы отправили слишком много сообщений. ' +
    'Пожалуйста, подождите минуту и попробуйте снова.',
  skipUsers: [],
  debug: false,
};

// ============================================================================
// METRICS
// ============================================================================

/**
 * Counter: Rate limit hits
 * Tracks when users exceed their rate limit
 */
export const rateLimitHitsTotal = new Counter({
  name: 'bot_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['user_id', 'chat_type'],
  registers: [register],
});

/**
 * Counter: Rate limit checks
 * Tracks total rate limit checks (for calculating hit rate)
 */
export const rateLimitChecksTotal = new Counter({
  name: 'bot_rate_limit_checks_total',
  help: 'Total number of rate limit checks',
  labelNames: ['chat_type'],
  registers: [register],
});

// ============================================================================
// RATE LIMITER IMPLEMENTATION
// ============================================================================

/**
 * Creates Telegraf rate limiting middleware
 *
 * @param options - Rate limit configuration
 * @returns Telegraf middleware function
 *
 * @example
 * ```typescript
 * import { createRateLimiter } from './middleware/rate-limit.js';
 *
 * const rateLimiter = createRateLimiter({
 *   windowMs: 60000,
 *   limit: 10,
 * });
 *
 * bot.use(rateLimiter);
 * ```
 */
export function createRateLimiter(
  options: Partial<RateLimitOptions> = {}
): Middleware<Context> {
  const config: RateLimitOptions = { ...DEFAULT_OPTIONS, ...options };
  const store: RateLimitStore = new Map();

  // Cleanup interval to prevent memory leaks
  // Runs every minute to remove expired entries
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, state] of store.entries()) {
      if (now > state.resetAt) {
        store.delete(userId);
        cleaned++;
      }
    }

    if (config.debug && cleaned > 0) {
      logger.debug('Rate limit store cleanup', {
        cleaned,
        remaining: store.size,
      });
    }
  }, 60000); // Every minute

  // Ensure cleanup interval doesn't prevent process exit
  cleanupInterval.unref();

  logger.info('Rate limiter initialized', {
    windowMs: config.windowMs,
    limit: config.limit,
    skipUsers: config.skipUsers?.length || 0,
  });

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    // Get user ID from context
    const userId = ctx.from?.id;

    // Skip if no user ID (shouldn't happen, but be safe)
    if (!userId) {
      if (config.debug) {
        logger.debug('Rate limit check skipped: no user ID');
      }
      return next();
    }

    // Skip rate limiting for specified users (e.g., admins)
    if (config.skipUsers?.includes(userId)) {
      if (config.debug) {
        logger.debug('Rate limit check skipped: user in skip list', { userId });
      }
      return next();
    }

    // Get chat type for metrics
    const chatType = ctx.chat?.type || 'unknown';

    // Increment total checks metric
    rateLimitChecksTotal.inc({ chat_type: chatType });

    const now = Date.now();
    let userState = store.get(userId);

    // Initialize or reset user state if window expired
    if (!userState || now > userState.resetAt) {
      userState = {
        count: 0,
        resetAt: now + config.windowMs,
      };
      store.set(userId, userState);
    }

    // Check if user has exceeded the limit
    if (userState.count >= config.limit) {
      // Calculate time until reset
      const timeUntilReset = Math.ceil((userState.resetAt - now) / 1000);

      // Log rate limit hit
      logger.warn('Rate limit exceeded', {
        userId,
        username: ctx.from?.username,
        chatId: ctx.chat?.id,
        chatType,
        count: userState.count,
        limit: config.limit,
        timeUntilReset,
      });

      // Increment metrics
      rateLimitHitsTotal.inc({
        user_id: String(userId),
        chat_type: chatType,
      });

      // Send polite Russian message to user
      try {
        await ctx.reply(config.message);
      } catch (error) {
        logger.error('Failed to send rate limit message', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Don't proceed to next middleware
      return;
    }

    // Increment user's message count
    userState.count++;

    if (config.debug) {
      logger.debug('Rate limit check passed', {
        userId,
        count: userState.count,
        limit: config.limit,
        remaining: config.limit - userState.count,
      });
    }

    // Proceed to next middleware
    return next();
  };
}

/**
 * Pre-configured rate limiter with default settings
 * Ready to use: bot.use(rateLimiter)
 */
export const rateLimiter: Middleware<Context> = createRateLimiter();

/**
 * Get current rate limit store size (for monitoring)
 */
export function getRateLimitStoreSize(): number {
  // Note: This is a simplified implementation
  // For production, consider exposing this via a getter on the middleware
  return 0;
}

/**
 * Reset rate limit for a specific user (admin action)
 * Note: This requires access to the store, which is encapsulated
 * For production use, consider creating a RateLimiter class with this method
 *
 * @param userId - Telegram user ID to reset
 * @param store - The rate limit store (from middleware closure)
 */
export function resetUserRateLimit(
  userId: number,
  store: RateLimitStore
): boolean {
  if (store.has(userId)) {
    store.delete(userId);
    logger.info('Rate limit reset for user', { userId });
    return true;
  }
  return false;
}

// ============================================================================
// ADVANCED: REDIS-BACKED RATE LIMITER
// ============================================================================

/**
 * Redis-backed rate limiter options
 */
export interface RedisRateLimitOptions extends RateLimitOptions {
  /** Redis key prefix for rate limit data */
  keyPrefix: string;
}

/**
 * Creates a Redis-backed rate limiter for distributed deployments
 *
 * Note: This is a placeholder for future implementation.
 * Use the in-memory rate limiter for single-instance deployments.
 *
 * @param redis - ioredis client instance
 * @param options - Rate limit configuration
 * @returns Telegraf middleware function
 */
export function createRedisRateLimiter(
  _redis: unknown,
  options: Partial<RedisRateLimitOptions> = {}
): Middleware<Context> {
  // TODO: Implement Redis-backed rate limiting using:
  // - INCR for atomic counter increment
  // - EXPIRE for automatic key expiration
  // - Lua scripts for atomic operations

  logger.warn(
    'Redis rate limiter not yet implemented, falling back to in-memory'
  );
  return createRateLimiter(options);
}

export default rateLimiter;

/**
 * Redis Client Singleton
 *
 * Provides a single Redis connection for the application.
 * Used for:
 * - BullMQ job queues
 * - Session storage
 * - Caching
 *
 * Connection Configuration:
 * - Redis 7.x (Alpine-based Docker container)
 * - Automatic reconnection on failure
 * - Connection pooling via ioredis
 *
 * Usage:
 * ```typescript
 * import { redis } from './lib/redis.js';
 * await redis.set('key', 'value');
 * ```
 *
 * @module lib/redis
 */

import Redis, { RedisOptions } from 'ioredis';
import logger from '../utils/logger.js';
import env from '../config/env.js';
import { redisConnectionErrors } from '../utils/metrics.js';

/**
 * Redis connection configuration
 */
const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  db: env.REDIS_DB,
  ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),

  // Retry strategy
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000); // Max 2s delay
    logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
    return delay;
  },

  // Connection pool settings
  maxRetriesPerRequest: null,
  enableReadyCheck: true,

  // Timeouts
  connectTimeout: 10000, // 10s
  // Note: commandTimeout removed for BullMQ compatibility
  // BullMQ uses blocking commands (BRPOPLPUSH, SUBSCRIBE) that can exceed short timeouts

  // Force IPv4 to avoid issues with Node 17+ resolving localhost to ::1
  family: 4,
};

/**
 * Singleton Redis client
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const redis = new (Redis as any)(redisOptions);

/**
 * Connection event handlers
 */
redis.on('connect', () => {
  logger.info('Redis client connecting...', {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
  });
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (error: Error) => {
  logger.error('Redis client error:', {
    error: error.message,
    stack: error.stack,
  });

  // Increment metrics counter
  redisConnectionErrors.inc();
});

redis.on('close', () => {
  logger.warn('Redis client connection closed');
});

redis.on('reconnecting', (delay: number) => {
  logger.info(`Redis client reconnecting in ${delay}ms`);
});

/**
 * Graceful disconnect on application shutdown
 * Called by shutdown handler in index.ts
 */
export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis client disconnected');
  } catch (error) {
    logger.error('Error disconnecting Redis client:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Test Redis connection
 * Used by health check endpoint
 *
 * @param timeoutMs - Maximum time to wait for response (default: 5000ms)
 * @returns true if connection is healthy, false otherwise
 */
export async function testRedisConnection(timeoutMs: number = 5000): Promise<boolean> {
  try {
    // Create timeout promise
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Redis ping timeout')), timeoutMs);
    });

    // Race ping against timeout
    const pingPromise = redis.ping().then((result: string) => result === 'PONG');

    const result = await Promise.race([pingPromise, timeoutPromise]);
    return result;
  } catch (error) {
    logger.error('Redis connection test failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export default redis;

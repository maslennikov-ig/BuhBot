/**
 * Classification Cache Service
 *
 * Caches classification results using SHA256 hashing of normalized message text.
 * Reduces API costs by avoiding repeated classification of identical messages.
 *
 * Features:
 * - SHA256 hashing for consistent cache keys
 * - Configurable TTL (default: 24 hours)
 * - Automatic expiration handling
 * - Graceful degradation on cache failures
 *
 * @module services/classifier/cache.service
 */

import crypto from 'crypto';
import type { PrismaClient, MessageClassification } from '@prisma/client';
import type { ClassificationResult, ClassificationSource } from './types.js';
import logger from '../../utils/logger.js';

/**
 * Default TTL in hours for cached classifications
 */
const DEFAULT_TTL_HOURS = 24;

/**
 * Normalize text for consistent hashing
 *
 * @param text - Raw message text
 * @returns Normalized text
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Generate SHA256 hash from normalized message text
 *
 * @param text - Message text to hash
 * @returns SHA256 hash as hex string
 */
export function hashMessage(text: string): string {
  const normalized = normalizeText(text);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Map database classification enum to service type
 */
function dbToServiceClassification(dbValue: MessageClassification): ClassificationResult['classification'] {
  // The Prisma enum values match our service types
  return dbValue as ClassificationResult['classification'];
}

/**
 * Map service classification to database enum
 */
function serviceToDbClassification(value: ClassificationResult['classification']): MessageClassification {
  // The values are identical, just typed differently
  return value as MessageClassification;
}

/**
 * Get cached classification result
 *
 * @param prisma - Prisma client instance
 * @param text - Message text to look up
 * @returns Cached classification result or null if not found/expired
 *
 * @example
 * ```typescript
 * const cached = await getCached(prisma, "Где мой счёт?");
 * if (cached) {
 *   console.log('Cache hit:', cached.classification);
 * }
 * ```
 */
export async function getCached(
  prisma: PrismaClient,
  text: string
): Promise<ClassificationResult | null> {
  try {
    const hash = hashMessage(text);

    const cached = await prisma.classificationCache.findUnique({
      where: { messageHash: hash },
    });

    if (!cached) {
      return null;
    }

    // Check expiration
    if (cached.expiresAt < new Date()) {
      // Clean up expired entry asynchronously (don't await)
      prisma.classificationCache
        .delete({ where: { messageHash: hash } })
        .catch(error => {
          logger.warn('Failed to delete expired cache entry', {
            hash: hash.substring(0, 16),
            error: error instanceof Error ? error.message : String(error),
            service: 'classifier',
          });
        });

      logger.debug('Cache entry expired', {
        hash: hash.substring(0, 16),
        expiredAt: cached.expiresAt.toISOString(),
        service: 'classifier',
      });

      return null;
    }

    logger.debug('Cache hit', {
      hash: hash.substring(0, 16),
      classification: cached.classification,
      confidence: cached.confidence,
      service: 'classifier',
    });

    return {
      classification: dbToServiceClassification(cached.classification),
      confidence: cached.confidence,
      model: cached.model as ClassificationSource,
      reasoning: 'Retrieved from cache',
    };
  } catch (error) {
    // Graceful degradation - cache failures shouldn't break classification
    logger.error('Cache lookup failed', {
      error: error instanceof Error ? error.message : String(error),
      service: 'classifier',
    });

    return null;
  }
}

/**
 * Store classification result in cache
 *
 * @param prisma - Prisma client instance
 * @param text - Original message text
 * @param result - Classification result to cache
 * @param ttlHours - Time to live in hours (default: 24)
 *
 * @example
 * ```typescript
 * await setCache(prisma, "Нужна справка", {
 *   classification: 'REQUEST',
 *   confidence: 0.95,
 *   model: 'openrouter',
 * });
 * ```
 */
export async function setCache(
  prisma: PrismaClient,
  text: string,
  result: ClassificationResult,
  ttlHours: number = DEFAULT_TTL_HOURS
): Promise<void> {
  try {
    const hash = hashMessage(text);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await prisma.classificationCache.upsert({
      where: { messageHash: hash },
      create: {
        messageHash: hash,
        classification: serviceToDbClassification(result.classification),
        confidence: result.confidence,
        model: result.model,
        expiresAt,
      },
      update: {
        classification: serviceToDbClassification(result.classification),
        confidence: result.confidence,
        model: result.model,
        expiresAt,
      },
    });

    logger.debug('Classification cached', {
      hash: hash.substring(0, 16),
      classification: result.classification,
      ttlHours,
      expiresAt: expiresAt.toISOString(),
      service: 'classifier',
    });
  } catch (error) {
    // Don't throw - cache failures shouldn't break the main flow
    logger.error('Cache storage failed', {
      error: error instanceof Error ? error.message : String(error),
      classification: result.classification,
      service: 'classifier',
    });
  }
}

/**
 * Clean up expired cache entries
 *
 * Should be run periodically (e.g., daily via cron job)
 *
 * @param prisma - Prisma client instance
 * @returns Number of entries deleted
 *
 * @example
 * ```typescript
 * const deleted = await cleanupExpiredCache(prisma);
 * console.log(`Cleaned up ${deleted} expired entries`);
 * ```
 */
export async function cleanupExpiredCache(prisma: PrismaClient): Promise<number> {
  try {
    const result = await prisma.classificationCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    logger.info('Cache cleanup completed', {
      deletedCount: result.count,
      service: 'classifier',
    });

    return result.count;
  } catch (error) {
    logger.error('Cache cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
      service: 'classifier',
    });

    return 0;
  }
}

/**
 * Get cache statistics
 *
 * @param prisma - Prisma client instance
 * @returns Cache statistics
 */
export async function getCacheStats(
  prisma: PrismaClient
): Promise<{ total: number; expired: number; valid: number }> {
  try {
    const now = new Date();

    const [total, expired] = await Promise.all([
      prisma.classificationCache.count(),
      prisma.classificationCache.count({
        where: { expiresAt: { lt: now } },
      }),
    ]);

    return {
      total,
      expired,
      valid: total - expired,
    };
  } catch (error) {
    logger.error('Failed to get cache stats', {
      error: error instanceof Error ? error.message : String(error),
      service: 'classifier',
    });

    return { total: 0, expired: 0, valid: 0 };
  }
}

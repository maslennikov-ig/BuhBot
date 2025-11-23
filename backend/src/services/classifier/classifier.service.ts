/**
 * Message Classifier Service
 *
 * Main classification service implementing the cascade logic:
 * 1. Check cache for existing classification
 * 2. Try AI classification via OpenRouter
 * 3. Fallback to keyword-based classification
 *
 * Features:
 * - Confidence threshold enforcement
 * - Automatic cache storage
 * - Graceful fallback on AI failures
 * - Logging and metrics
 *
 * @module services/classifier/classifier.service
 */

import type { PrismaClient } from '../../../node_modules/.prisma/client/client.js';
import type { ClassificationResult, ClassifierConfig } from './types.js';
import { DEFAULT_CLASSIFIER_CONFIG } from './types.js';
import { classifyWithAI } from './openrouter-client.js';
import { classifyByKeywords } from './keyword-classifier.js';
import { getCached, setCache, cleanupExpiredCache, getCacheStats } from './cache.service.js';
import logger from '../../utils/logger.js';

/**
 * Message Classifier Service
 *
 * Provides unified message classification with AI and keyword fallback
 */
export class ClassifierService {
  private prisma: PrismaClient;
  private config: ClassifierConfig;

  /**
   * Create a new classifier service instance
   *
   * @param prisma - Prisma client for cache operations
   * @param config - Optional configuration overrides
   */
  constructor(prisma: PrismaClient, config: Partial<ClassifierConfig> = {}) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_CLASSIFIER_CONFIG, ...config };

    logger.info('Classifier service initialized', {
      aiThreshold: this.config.aiConfidenceThreshold,
      keywordThreshold: this.config.keywordConfidenceThreshold,
      cacheTTL: this.config.cacheTTLHours,
      model: this.config.openRouterModel,
      service: 'classifier',
    });
  }

  /**
   * Classify a message using AI with keyword fallback
   *
   * Classification cascade:
   * 1. Check cache for existing result
   * 2. Try AI classification if cache miss
   * 3. Use keyword fallback if AI fails or low confidence
   *
   * @param text - Message text to classify
   * @returns Classification result with category and confidence
   *
   * @example
   * ```typescript
   * const service = new ClassifierService(prisma);
   * const result = await service.classifyMessage("Где мой счёт?");
   * // { classification: 'REQUEST', confidence: 0.92, model: 'openrouter' }
   * ```
   */
  async classifyMessage(text: string): Promise<ClassificationResult> {
    const startTime = Date.now();

    // 1. Check cache first
    const cached = await getCached(this.prisma, text);
    if (cached) {
      logger.debug('Classification cache hit', {
        classification: cached.classification,
        processingTime: Date.now() - startTime,
        service: 'classifier',
      });
      return cached;
    }

    // 2. Try AI classification
    let aiResult: ClassificationResult | null = null;
    try {
      aiResult = await classifyWithAI(text, this.config);

      // If AI confidence is above threshold, use it
      if (aiResult.confidence >= this.config.aiConfidenceThreshold) {
        await setCache(this.prisma, text, aiResult, this.config.cacheTTLHours);

        logger.info('Classification completed (AI)', {
          classification: aiResult.classification,
          confidence: aiResult.confidence,
          processingTime: Date.now() - startTime,
          service: 'classifier',
        });

        return aiResult;
      }

      // AI confidence below threshold, will use fallback
      logger.info('AI confidence below threshold, using keyword fallback', {
        aiConfidence: aiResult.confidence,
        threshold: this.config.aiConfidenceThreshold,
        service: 'classifier',
      });
    } catch (error) {
      // AI classification failed, use fallback
      logger.warn('AI classification failed, using keyword fallback', {
        error: error instanceof Error ? error.message : String(error),
        service: 'classifier',
      });
    }

    // 3. Fallback to keyword classification
    const keywordResult = classifyByKeywords(text);

    // Choose between low-confidence AI and keyword result
    let finalResult: ClassificationResult;

    if (aiResult && aiResult.confidence > keywordResult.confidence) {
      // AI result is still more confident, use it despite being below threshold
      finalResult = {
        ...aiResult,
        reasoning: `AI (low confidence: ${aiResult.confidence.toFixed(2)}): ${aiResult.reasoning ?? 'No reasoning'}`,
      };
    } else {
      finalResult = keywordResult;
    }

    // Apply minimum confidence threshold for keyword results
    if (
      finalResult.model === 'keyword-fallback' &&
      finalResult.confidence < this.config.keywordConfidenceThreshold
    ) {
      // Very low confidence - default to REQUEST (safer to track)
      finalResult = {
        classification: 'REQUEST',
        confidence: this.config.keywordConfidenceThreshold,
        model: 'keyword-fallback',
        reasoning: 'Low confidence classification, defaulting to REQUEST for safety',
      };
    }

    // Cache the result
    await setCache(this.prisma, text, finalResult, this.config.cacheTTLHours);

    logger.info('Classification completed (fallback)', {
      classification: finalResult.classification,
      confidence: finalResult.confidence,
      model: finalResult.model,
      processingTime: Date.now() - startTime,
      service: 'classifier',
    });

    return finalResult;
  }

  /**
   * Classify multiple messages in parallel
   *
   * @param texts - Array of message texts to classify
   * @returns Array of classification results
   */
  async classifyBatch(texts: string[]): Promise<ClassificationResult[]> {
    const startTime = Date.now();

    const results = await Promise.all(
      texts.map(text => this.classifyMessage(text))
    );

    logger.info('Batch classification completed', {
      count: texts.length,
      processingTime: Date.now() - startTime,
      service: 'classifier',
    });

    return results;
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics object
   */
  async getCacheStats(): Promise<{ total: number; expired: number; valid: number }> {
    return getCacheStats(this.prisma);
  }

  /**
   * Clean up expired cache entries
   *
   * @returns Number of entries deleted
   */
  async cleanupCache(): Promise<number> {
    return cleanupExpiredCache(this.prisma);
  }

  /**
   * Get current configuration
   *
   * @returns Current classifier configuration
   */
  getConfig(): ClassifierConfig {
    return { ...this.config };
  }
}

/**
 * Singleton service instance
 */
let serviceInstance: ClassifierService | null = null;

/**
 * Get or create classifier service instance
 *
 * @param prisma - Prisma client instance
 * @param config - Optional configuration overrides
 * @returns Classifier service instance
 */
export function getClassifierService(
  prisma: PrismaClient,
  config?: Partial<ClassifierConfig>
): ClassifierService {
  if (!serviceInstance || config) {
    serviceInstance = new ClassifierService(prisma, config);
  }
  return serviceInstance;
}

/**
 * Convenience function for one-off classification
 *
 * @param prisma - Prisma client instance
 * @param text - Message text to classify
 * @param config - Optional configuration overrides
 * @returns Classification result
 *
 * @example
 * ```typescript
 * import { classifyMessage } from './classifier.service.js';
 * import { prisma } from '../../lib/prisma.js';
 *
 * const result = await classifyMessage(prisma, "Нужна справка 2-НДФЛ");
 * ```
 */
export async function classifyMessage(
  prisma: PrismaClient,
  text: string,
  config?: Partial<ClassifierConfig>
): Promise<ClassificationResult> {
  const service = getClassifierService(prisma, config);
  return service.classifyMessage(text);
}

/**
 * Reset the service instance (useful for testing)
 */
export function resetClassifierService(): void {
  serviceInstance = null;
}

export default ClassifierService;

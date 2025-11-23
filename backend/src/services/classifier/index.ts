/**
 * Message Classifier Module
 *
 * AI-powered and keyword-based message classification for BuhBot SLA monitoring.
 *
 * Features:
 * - AI classification via OpenRouter (OpenAI-compatible API)
 * - Keyword-based fallback for Russian text patterns
 * - SHA256-based classification caching
 * - Configurable confidence thresholds
 *
 * Usage:
 * ```typescript
 * import { classifyMessage, ClassifierService } from '@services/classifier';
 * import { prisma } from '../../lib/prisma.js';
 *
 * // One-off classification
 * const result = await classifyMessage(prisma, "Где мой счёт?");
 *
 * // Service instance for multiple classifications
 * const service = new ClassifierService(prisma);
 * const result = await service.classifyMessage("Нужна справка 2-НДФЛ");
 * ```
 *
 * @module services/classifier
 */

// Types
export type {
  ClassificationResult,
  MessageCategory,
  ClassificationSource,
  ClassifierConfig,
  AIClassificationResponse,
} from './types.js';

export { DEFAULT_CLASSIFIER_CONFIG } from './types.js';

// Keyword classifier
export { classifyByKeywords } from './keyword-classifier.js';

// OpenRouter AI client
export { classifyWithAI, OpenRouterClient, resetClient } from './openrouter-client.js';

// Cache service
export {
  getCached,
  setCache,
  cleanupExpiredCache,
  getCacheStats,
  hashMessage,
} from './cache.service.js';

// Main classifier service
export {
  ClassifierService,
  getClassifierService,
  classifyMessage,
  resetClassifierService,
} from './classifier.service.js';

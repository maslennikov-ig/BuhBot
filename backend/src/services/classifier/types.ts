/**
 * Message Classification Types
 *
 * TypeScript interfaces for the BuhBot message classification system.
 * Used for SLA monitoring and request categorization.
 *
 * @module services/classifier/types
 */

/**
 * Message classification categories
 * Aligned with Prisma enum MessageClassification
 */
export type MessageCategory = 'REQUEST' | 'SPAM' | 'GRATITUDE' | 'CLARIFICATION';

/**
 * Classification source indicator
 */
export type ClassificationSource = 'openrouter' | 'keyword-fallback' | 'cache';

/**
 * Result of message classification
 */
export interface ClassificationResult {
  /** Assigned category */
  classification: MessageCategory;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Model/method used for classification */
  model: ClassificationSource;
  /** Optional explanation for the classification */
  reasoning?: string;
}

/**
 * Circuit Breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Consecutive failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Consecutive successes to close circuit from half-open (default: 2) */
  successThreshold?: number;
  /** Timeout before transitioning from open to half-open in ms (default: 60000) */
  timeoutMs?: number;
}

/**
 * Configuration for the classifier service
 */
export interface ClassifierConfig {
  /** Confidence threshold for AI classification (default: 0.7) */
  aiConfidenceThreshold: number;
  /** Confidence threshold for keyword classification (default: 0.5) */
  keywordConfidenceThreshold: number;
  /** Cache TTL in hours (default: 24) */
  cacheTTLHours: number;
  /** OpenRouter model to use (default: openai/gpt-3.5-turbo) */
  openRouterModel: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs: number;
  /** Maximum retry attempts for API calls (default: 3) */
  maxRetries: number;
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
}

/**
 * Default classifier configuration
 */
export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
  aiConfidenceThreshold: 0.7,
  keywordConfidenceThreshold: 0.5,
  cacheTTLHours: 24,
  openRouterModel: 'openai/gpt-3.5-turbo',
  timeoutMs: 30000,
  maxRetries: 3,
};

/**
 * OpenRouter API response structure for classification
 */
export interface AIClassificationResponse {
  classification: MessageCategory;
  confidence: number;
  reasoning: string;
}

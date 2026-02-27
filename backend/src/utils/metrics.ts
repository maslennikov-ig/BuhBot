/**
 * Prometheus Metrics Collection Utility
 *
 * Initializes and exports custom application metrics for monitoring:
 * - Bot message processing metrics
 * - Redis queue metrics
 * - Supabase/database query metrics
 * - System health indicators
 *
 * All metrics are exposed via /metrics endpoint in Prometheus text format.
 *
 * @module utils/metrics
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import logger from './logger.js';

/**
 * Prometheus Registry
 * Thread-safe singleton for all application metrics
 */
export const register = new Registry();

/**
 * Collect default Node.js metrics
 * Includes: heap usage, CPU, event loop lag, file descriptors, etc.
 */
collectDefaultMetrics({
  register,
  prefix: 'nodejs_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // GC duration buckets in seconds
});

// ============================================================================
// BOT MESSAGE METRICS
// ============================================================================

/**
 * Counter: Total incoming messages received by the bot
 * Labels:
 * - chat_type: 'private' | 'group' | 'supergroup'
 * - user_type: 'client' | 'accountant' | 'unknown'
 */
export const botMessagesReceivedTotal = new Counter({
  name: 'bot_messages_received_total',
  help: 'Total number of messages received by the bot',
  labelNames: ['chat_type', 'user_type'],
  registers: [register],
});

/**
 * Histogram: Message processing duration in seconds
 * Tracks end-to-end latency from webhook reception to response
 * Buckets optimized for typical Telegram bot response times
 */
export const botMessageProcessingDuration = new Histogram({
  name: 'bot_message_processing_duration',
  help: 'Duration of bot message processing in seconds',
  labelNames: ['chat_type', 'user_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5], // 10ms to 5s
  registers: [register],
});

/**
 * Counter: Webhook signature validation failures
 * Indicates potential security issues or misconfiguration
 */
export const botWebhookSignatureFailures = new Counter({
  name: 'bot_webhook_signature_failures',
  help: 'Number of webhook requests with invalid signatures',
  registers: [register],
});

// ============================================================================
// HTTP ERROR METRICS
// ============================================================================

/**
 * Counter: Total HTTP 500 errors
 * Labels:
 * - method: HTTP method (GET, POST, etc.)
 * - path: Route path or request path
 */
export const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total HTTP 500 errors',
  labelNames: ['method', 'path'] as const,
  registers: [register],
});

// ============================================================================
// REDIS QUEUE METRICS (BullMQ)
// ============================================================================

/**
 * Gauge: Current queue length (pending jobs)
 * Updated periodically by queue monitoring service
 */
export const redisQueueLength = new Gauge({
  name: 'redis_queue_length',
  help: 'Number of pending jobs in BullMQ queue',
  labelNames: ['queue_name'],
  registers: [register],
});

/**
 * Counter: Redis connection errors
 * Tracks connection failures for alerting
 */
export const redisConnectionErrors = new Counter({
  name: 'redis_connection_errors',
  help: 'Number of Redis connection errors',
  registers: [register],
});

// ============================================================================
// SUPABASE / DATABASE METRICS
// ============================================================================

/**
 * Histogram: Database query duration in seconds
 * Tracks Prisma/Supabase query latency
 * Buckets optimized for typical PostgreSQL query times
 */
export const supabaseQueryDuration = new Histogram({
  name: 'supabase_query_duration',
  help: 'Duration of Supabase/Prisma queries in seconds',
  labelNames: ['query_type', 'model'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1], // 10ms to 1s
  registers: [register],
});

/**
 * Counter: Supabase connection errors
 * Tracks database connection failures
 */
export const supabaseConnectionErrors = new Counter({
  name: 'supabase_connection_errors',
  help: 'Number of Supabase connection errors',
  registers: [register],
});

/**
 * Gauge: Supabase connection pool size
 * Tracks active database connections
 */
export const supabaseConnectionPoolSize = new Gauge({
  name: 'supabase_connection_pool_size',
  help: 'Number of active Supabase connections',
  registers: [register],
});

// ============================================================================
// CLASSIFIER METRICS
// ============================================================================

/**
 * Counter: Total classifier requests
 * Labels:
 * - model: 'openrouter' | 'keyword-fallback' | 'cache'
 * - classification: 'REQUEST' | 'SPAM' | 'GRATITUDE' | 'CLARIFICATION'
 */
export const classifierRequestsTotal = new Counter({
  name: 'classifier_requests_total',
  help: 'Total number of classifier requests',
  labelNames: ['model', 'classification'],
  registers: [register],
});

/**
 * Histogram: Classifier latency in seconds
 * Labels:
 * - model: 'openrouter' | 'keyword-fallback' | 'cache'
 */
export const classifierLatencySeconds = new Histogram({
  name: 'classifier_latency_seconds',
  help: 'Classifier request latency in seconds',
  labelNames: ['model'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5], // 50ms to 5s
  registers: [register],
});

/**
 * Counter: Classifier errors
 * Labels:
 * - error_type: 'api_error' | 'parse_error' | 'timeout' | 'rate_limit'
 */
export const classifierErrorsTotal = new Counter({
  name: 'classifier_errors_total',
  help: 'Total number of classifier errors',
  labelNames: ['error_type'],
  registers: [register],
});

/**
 * Counter: Cache hits
 */
export const classifierCacheHitsTotal = new Counter({
  name: 'classifier_cache_hits_total',
  help: 'Total number of classifier cache hits',
  registers: [register],
});

/**
 * Counter: Cache misses
 */
export const classifierCacheMissesTotal = new Counter({
  name: 'classifier_cache_misses_total',
  help: 'Total number of classifier cache misses',
  registers: [register],
});

// ============================================================================
// CIRCUIT BREAKER METRICS
// ============================================================================

/**
 * Gauge: Circuit breaker state
 * 0 = CLOSED, 1 = OPEN, 2 = HALF_OPEN
 */
export const classifierCircuitBreakerState = new Gauge({
  name: 'classifier_circuit_breaker_state',
  help: 'Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)',
  registers: [register],
});

/**
 * Counter: Circuit breaker state transitions
 * Labels: from_state, to_state
 */
export const classifierCircuitBreakerTripsTotal = new Counter({
  name: 'classifier_circuit_breaker_trips_total',
  help: 'Total number of circuit breaker state transitions',
  labelNames: ['from_state', 'to_state'],
  registers: [register],
});

// ============================================================================
// FEEDBACK SYSTEM METRICS
// ============================================================================

/**
 * Counter: Total survey deliveries by status
 * Labels:
 * - status: 'delivered' | 'failed' | 'expired'
 * Tracks how many surveys were successfully sent, failed, or expired
 */
export const surveyDeliveriesTotal = new Counter({
  name: 'buhbot_survey_deliveries_total',
  help: 'Total survey deliveries by status',
  labelNames: ['status'],
  registers: [register],
});

/**
 * Counter: Total feedback responses by rating
 * Labels:
 * - rating: '1' | '2' | '3' | '4' | '5'
 * Tracks customer satisfaction ratings distribution
 */
export const feedbackResponsesTotal = new Counter({
  name: 'buhbot_feedback_responses_total',
  help: 'Total feedback responses by rating',
  labelNames: ['rating'],
  registers: [register],
});

/**
 * Gauge: Current NPS score
 * Range: -100 to 100
 * Updated whenever feedback responses are received
 * Calculated as: (promoters - detractors) / (total responses) * 100
 */
export const feedbackNpsGauge = new Gauge({
  name: 'buhbot_feedback_nps_gauge',
  help: 'Current NPS score (-100 to 100)',
  registers: [register],
});

// ============================================================================
// DASHBOARD CACHE METRICS
// ============================================================================

/**
 * Counter: Dashboard cache hits
 * Incremented when getDashboard returns data from Redis cache
 */
export const dashboardCacheHitsTotal = new Counter({
  name: 'buhbot_dashboard_cache_hits_total',
  help: 'Total number of dashboard cache hits',
  registers: [register],
});

/**
 * Counter: Dashboard cache misses
 * Incremented when getDashboard must query the database
 */
export const dashboardCacheMissesTotal = new Counter({
  name: 'buhbot_dashboard_cache_misses_total',
  help: 'Total number of dashboard cache misses',
  registers: [register],
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Timer helper for measuring operation duration
 * Returns a function that records the duration when called
 *
 * @example
 * const end = startTimer(botMessageProcessingDuration, { chat_type: 'private', user_type: 'client' });
 * // ... do work ...
 * end(); // Records duration automatically
 */
export function startTimer(histogram: Histogram<string>, labels?: Record<string, string>) {
  const start = Date.now();
  return () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    histogram.observe(labels || {}, duration);
  };
}

/**
 * Increment counter with error handling
 * Safely increments counter even if labels are invalid
 */
export function incrementCounter(counter: Counter<string>, labels?: Record<string, string>) {
  try {
    counter.inc(labels || {});
  } catch (error) {
    logger.error('Error incrementing counter', {
      error: error instanceof Error ? error.message : String(error),
      service: 'metrics',
    });
  }
}

/**
 * Set gauge value with error handling
 */
export function setGauge(gauge: Gauge<string>, value: number, labels?: Record<string, string>) {
  try {
    gauge.set(labels || {}, value);
  } catch (error) {
    logger.error('Error setting gauge', {
      error: error instanceof Error ? error.message : String(error),
      service: 'metrics',
    });
  }
}

/**
 * Get all metrics in Prometheus text format
 * Used by /metrics endpoint
 */
export async function getMetricsText(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics as JSON (for debugging)
 */
export async function getMetricsJson(): Promise<object> {
  return register.getMetricsAsJSON();
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
}

// ============================================================================
// FEEDBACK SYSTEM HELPERS
// ============================================================================

/**
 * Increment survey delivery counter by status
 * @param status - 'delivered' | 'failed' | 'expired'
 *
 * @example
 * incrementSurveyDelivery('delivered');
 */
export function incrementSurveyDelivery(status: 'delivered' | 'failed' | 'expired'): void {
  incrementCounter(surveyDeliveriesTotal, { status });
}

/**
 * Increment feedback response counter by rating
 * @param rating - 1-5 star rating
 *
 * @example
 * incrementFeedbackResponse(5);
 */
export function incrementFeedbackResponse(rating: number): void {
  if (rating < 1 || rating > 5) {
    logger.error('Invalid feedback rating', {
      rating,
      service: 'metrics',
    });
    return;
  }
  incrementCounter(feedbackResponsesTotal, { rating: String(rating) });
}

/**
 * Update NPS gauge with current NPS score
 * @param npsScore - NPS score from -100 to 100
 *
 * @example
 * updateNPSGauge(42);
 */
export function updateNPSGauge(npsScore: number): void {
  if (npsScore < -100 || npsScore > 100) {
    logger.error('Invalid NPS score', {
      npsScore,
      service: 'metrics',
    });
    return;
  }
  setGauge(feedbackNpsGauge, npsScore);
}

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
    console.error('[Metrics] Error incrementing counter:', error);
  }
}

/**
 * Set gauge value with error handling
 */
export function setGauge(gauge: Gauge<string>, value: number, labels?: Record<string, string>) {
  try {
    gauge.set(labels || {}, value);
  } catch (error) {
    console.error('[Metrics] Error setting gauge:', error);
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

/**
 * OpenTelemetry Distributed Tracing Setup (gh-77)
 *
 * Provides auto-instrumentation for Express, HTTP, Redis, and Prisma.
 * Exports traces via OTLP HTTP to a configurable collector endpoint.
 *
 * Enable with OTEL_TRACING_ENABLED=true environment variable.
 * Configure endpoint with OTEL_EXPORTER_OTLP_ENDPOINT (default: http://localhost:4318).
 *
 * @module lib/tracing
 */

import { trace, SpanStatusCode, type Span, type Tracer } from '@opentelemetry/api';

let sdkInstance: { shutdown: () => Promise<void> } | null = null;

/**
 * Initialize OpenTelemetry tracing.
 * Must be called before any other imports that need instrumentation.
 */
export async function initTracing(): Promise<void> {
  const enabled = process.env['OTEL_TRACING_ENABLED'] === 'true';

  if (!enabled) {
    return;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import(
      '@opentelemetry/auto-instrumentations-node'
    );
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { resourceFromAttributes } = await import('@opentelemetry/resources');
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import(
      '@opentelemetry/semantic-conventions'
    );

    const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318';

    const traceExporter = new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    });

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'buhbot-backend',
        [ATTR_SERVICE_VERSION]: process.env['npm_package_version'] ?? '0.0.0',
        ['deployment.environment']: process.env['NODE_ENV'] ?? 'development',
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable noisy FS instrumentation
          '@opentelemetry/instrumentation-fs': { enabled: false },
          // Disable DNS to reduce noise
          '@opentelemetry/instrumentation-dns': { enabled: false },
        }),
      ],
    });

    sdk.start();
    sdkInstance = sdk;

    console.log(`[OTEL] Tracing enabled, exporting to ${endpoint}`);
  } catch (error) {
    console.error('[OTEL] Failed to initialize tracing:', error);
  }
}

/**
 * Gracefully shutdown the OpenTelemetry SDK.
 * Flushes pending spans before exit.
 */
export async function shutdownTracing(): Promise<void> {
  if (sdkInstance) {
    try {
      await sdkInstance.shutdown();
      console.log('[OTEL] Tracing terminated');
    } catch (error) {
      console.error('[OTEL] Error terminating tracing:', error);
    }
  }
}

/**
 * Get a tracer for manual span creation.
 *
 * @param name - Tracer name (typically module name)
 * @returns OpenTelemetry Tracer instance
 *
 * @example
 * ```typescript
 * const tracer = getTracer('message-handler');
 * const span = tracer.startSpan('process_message');
 * span.setAttribute('chat_id', chatId);
 * // ... processing
 * span.end();
 * ```
 */
export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}

/**
 * Wrap an async function with a traced span.
 *
 * @param tracer - Tracer instance
 * @param spanName - Name for the span
 * @param attributes - Initial span attributes
 * @param fn - Async function to trace
 * @returns Result of the wrapped function
 *
 * @example
 * ```typescript
 * const result = await withSpan(tracer, 'classify_message', { chat_id: chatId }, async (span) => {
 *   const classification = await classifyMessage(text);
 *   span.setAttribute('classification', classification.result);
 *   return classification;
 * });
 * ```
 */
export async function withSpan<T>(
  tracer: Tracer,
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

export { trace, SpanStatusCode };
export type { Span, Tracer };

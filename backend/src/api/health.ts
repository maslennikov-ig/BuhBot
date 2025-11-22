/**
 * Health Check API Endpoint
 *
 * Provides comprehensive health status for the BuhBot backend application.
 * Checks critical dependencies: database (Prisma/Supabase) and Redis.
 *
 * Endpoint: GET /health
 * Response: JSON with status and individual check results
 *
 * Status Codes:
 * - 200: All checks passed (healthy)
 * - 503: One or more checks failed (unhealthy)
 *
 * Health States:
 * - "ok": All checks passed
 * - "degraded": Non-critical checks failed
 * - "down": Critical checks failed
 *
 * @module api/health
 */

import { Request, Response } from 'express';
import { testDatabaseConnection } from '../lib/prisma.js';
import { testRedisConnection } from '../lib/redis.js';
import logger from '../utils/logger.js';

/**
 * Health status types
 */
type HealthStatus = 'ok' | 'degraded' | 'down';

/**
 * Individual check result
 */
interface CheckResult {
  status: 'ok' | 'down';
  latency_ms?: number;
  error?: string;
}

/**
 * Health check response structure
 */
interface HealthCheckResponse {
  status: HealthStatus;
  uptime: number;
  timestamp: string;
  checks: {
    database: CheckResult;
    redis: CheckResult;
  };
}

/**
 * Check database health
 * Measures connection latency and returns status
 *
 * @param timeoutMs - Maximum time to wait (default: 5000ms)
 * @returns Check result with status and latency
 */
async function checkDatabase(timeoutMs: number = 5000): Promise<CheckResult> {
  const start = Date.now();

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Database check timeout')), timeoutMs);
    });

    // Race connection test against timeout
    const checkPromise = testDatabaseConnection();
    const isHealthy = await Promise.race([checkPromise, timeoutPromise]);

    const latency = Date.now() - start;

    if (isHealthy) {
      return {
        status: 'ok',
        latency_ms: latency,
      };
    } else {
      return {
        status: 'down',
        latency_ms: latency,
        error: 'Database connection test failed',
      };
    }
  } catch (error) {
    const latency = Date.now() - start;
    return {
      status: 'down',
      latency_ms: latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis health
 * Measures connection latency and returns status
 *
 * @param timeoutMs - Maximum time to wait (default: 5000ms)
 * @returns Check result with status and latency
 */
async function checkRedis(timeoutMs: number = 5000): Promise<CheckResult> {
  const start = Date.now();

  try {
    const isHealthy = await testRedisConnection(timeoutMs);
    const latency = Date.now() - start;

    if (isHealthy) {
      return {
        status: 'ok',
        latency_ms: latency,
      };
    } else {
      return {
        status: 'down',
        latency_ms: latency,
        error: 'Redis connection test failed',
      };
    }
  } catch (error) {
    const latency = Date.now() - start;
    return {
      status: 'down',
      latency_ms: latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Determine overall health status from individual checks
 *
 * Logic:
 * - "ok": All checks passed
 * - "degraded": Redis down (non-critical, app can function)
 * - "down": Database down (critical, app cannot function)
 *
 * @param checks - Individual check results
 * @returns Overall health status
 */
function determineHealthStatus(checks: {
  database: CheckResult;
  redis: CheckResult;
}): HealthStatus {
  // Database is critical - if it's down, the whole service is down
  if (checks.database.status === 'down') {
    return 'down';
  }

  // Redis is important but not critical - degraded if down
  if (checks.redis.status === 'down') {
    return 'degraded';
  }

  // All checks passed
  return 'ok';
}

/**
 * Health check endpoint handler
 *
 * Performs health checks on all critical dependencies and returns status.
 * Each check has a 5-second timeout to prevent hanging.
 *
 * @param _req - Express request (unused)
 * @param res - Express response
 */
export async function healthHandler(_req: Request, res: Response): Promise<void> {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  try {
    // Run health checks in parallel with 5s timeout
    const [databaseCheck, redisCheck] = await Promise.all([
      checkDatabase(5000),
      checkRedis(5000),
    ]);

    const checks = {
      database: databaseCheck,
      redis: redisCheck,
    };

    // Determine overall status
    const status = determineHealthStatus(checks);

    // Build response
    const response: HealthCheckResponse = {
      status,
      uptime,
      timestamp,
      checks,
    };

    // Set HTTP status code based on health status
    const httpStatus = status === 'ok' ? 200 : 503;

    // Log health check (debug level to avoid noise)
    logger.debug('Health check completed', {
      status,
      databaseLatency: databaseCheck.latency_ms,
      redisLatency: redisCheck.latency_ms,
    });

    res.status(httpStatus).json(response);
  } catch (error) {
    // Unexpected error during health check
    logger.error('Error performing health check:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return unhealthy status
    res.status(503).json({
      status: 'down',
      uptime,
      timestamp,
      checks: {
        database: {
          status: 'down',
          error: 'Health check failed',
        },
        redis: {
          status: 'down',
          error: 'Health check failed',
        },
      },
      error: 'Unexpected error during health check',
    });
  }
}

/**
 * Register health check endpoint with Express app
 *
 * @example
 * import express from 'express';
 * import { registerHealthEndpoint } from './api/health.js';
 *
 * const app = express();
 * registerHealthEndpoint(app);
 */
export function registerHealthEndpoint(app: any): void {
  app.get('/health', healthHandler);
  logger.info('Health check endpoint registered at /health');
}

export default healthHandler;

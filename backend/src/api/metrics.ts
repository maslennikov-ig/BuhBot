/**
 * Metrics API Endpoint
 *
 * Exposes Prometheus metrics for scraping by monitoring services.
 * Returns metrics in Prometheus text format.
 *
 * Endpoint: GET /metrics
 * Response: text/plain; version=0.0.4; charset=utf-8
 *
 * @module api/metrics
 */

import { Request, Response, Application } from 'express';
import { getMetricsText } from '../utils/metrics.js';
import logger from '../utils/logger.js';

/**
 * Metrics endpoint handler
 *
 * Returns all registered Prometheus metrics in text format.
 * Includes both default Node.js metrics and custom application metrics.
 *
 * @param _req - Express request (unused)
 * @param res - Express response
 */
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  try {
    // Get metrics in Prometheus text format
    const metrics = await getMetricsText();

    // Set appropriate content-type for Prometheus
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);

    logger.debug('Metrics endpoint accessed');
  } catch (error) {
    logger.error('Error generating metrics:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return 500 if metrics generation fails
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate metrics',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Register metrics endpoint with Express app
 *
 * @example
 * import express from 'express';
 * import { registerMetricsEndpoint } from './api/metrics.js';
 *
 * const app = express();
 * registerMetricsEndpoint(app);
 */
export function registerMetricsEndpoint(app: Application): void {
  app.get('/metrics', metricsHandler);
  logger.info('Metrics endpoint registered at /metrics');
}

export default metricsHandler;

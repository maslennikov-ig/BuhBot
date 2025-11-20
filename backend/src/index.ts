import express from 'express';
import logger from './utils/logger.js';
import env, { isProduction, isDevelopment } from './config/env.js';
import { healthHandler } from './api/health.js';
import { metricsHandler } from './api/metrics.js';
import { disconnectPrisma } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';

/**
 * BuhBot Backend Server
 *
 * Main entry point for the BuhBot backend application.
 * This file initializes the Express server, sets up middleware,
 * and starts listening for incoming requests.
 */

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check endpoint with database and Redis checks
app.get('/health', healthHandler);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Ready check endpoint (for Kubernetes readiness probes)
// Simplified check - use /health for detailed status
app.get('/ready', (_req, res) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// API root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'BuhBot Backend API',
    version: '0.1.0',
    description: 'Платформа автоматизации коммуникаций для бухгалтерских фирм',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      ready: '/ready',
      api: '/api'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: isProduction() ? 'Something went wrong' : err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = env.PORT;
const server = app.listen(PORT, () => {
  logger.info(`BuhBot server started successfully`, {
    port: PORT,
    environment: env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform
  });

  if (isDevelopment()) {
    logger.info(`Server is running at http://localhost:${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
  }
});

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close database connections
      await disconnectPrisma();

      // Close Redis connection
      await disconnectRedis();

      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', {
    reason,
    promise
  });
});

export default app;

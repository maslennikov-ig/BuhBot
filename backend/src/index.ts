import express from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';
import logger from './utils/logger.js';
import env, { isProduction, isDevelopment } from './config/env.js';
import { healthHandler } from './api/health.js';
import { metricsHandler } from './api/metrics.js';
import { disconnectPrisma } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';
import { appRouter, createContext } from './api/trpc/index.js';
import { registerHandlers, setupWebhook, launchPolling, stopBot } from './bot/index.js';

// Initialize BullMQ workers for background job processing
// Workers self-register when imported, enabling SLA monitoring, alert delivery, and surveys
import './queues/sla-timer.worker.js';
import './queues/alert.worker.js';
import './queues/survey.worker.js';
import { closeQueues } from './queues/setup.js';

/**
 * BuhBot Backend Server
 *
 * Main entry point for the BuhBot backend application.
 * This file initializes the Express server, sets up middleware,
 * and starts listening for incoming requests.
 */

const app = express();

// Middleware
// IMPORTANT: Webhook path must NOT go through express.json() as Telegraf needs raw body
// express.json() consumes the body stream, making it unavailable for Telegraf
const webhookPath = '/webhook/telegram';
app.use((req, res, next) => {
  if (req.path === webhookPath) {
    // Skip JSON parsing for webhook - Telegraf handles it internally
    return next();
  }
  express.json()(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === webhookPath) {
    return next();
  }
  express.urlencoded({ extended: true })(req, res, next);
});

// Request logging middleware
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Initialize Telegram bot handlers
registerHandlers();

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

// tRPC API endpoint
app.use(
  '/api/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

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
      api: '/api',
      trpc: '/api/trpc',
      webhook: '/webhook/telegram'
    }
  });
});

import type { Server } from 'http';

// Start server with dynamic port selection
let server: Server;

// Register 404 and error handlers after webhook setup
const registerFinalHandlers = () => {
  // 404 handler - must be registered after all routes including webhook
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
};

const startServer = async (port: number) => {
  // Setup Telegram bot (Webhook or Polling)
  try {
    if (env.TELEGRAM_WEBHOOK_URL) {
      // Production/Staging: Use Webhook
      await setupWebhook(app, '/webhook/telegram');
    } else {
      // Fallback: Use Polling if no webhook URL provided (even in production)
      // This ensures the bot works even if the webhook URL is missing in config
      logger.warn('TELEGRAM_WEBHOOK_URL not set. Launching in POLLING mode. This is less efficient for production but ensures functionality.');
      
      // Launch polling in background
      launchPolling().catch(err => {
        logger.error('Failed to launch polling', { error: err.message });
      });
    }
  } catch (error) {
    logger.error('Failed to setup Telegram bot on startup', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Register 404/error handlers AFTER webhook route
  registerFinalHandlers();

  const s = app.listen(port, () => {
    logger.info(`BuhBot server started successfully`, {
      port,
      environment: env.NODE_ENV,
      nodeVersion: process.version,
      platform: process.platform
    });

    if (isDevelopment()) {
      logger.info(`Server is running at http://localhost:${port}`);
      logger.info(`Health check: http://localhost:${port}/health`);
    }
  });

  s.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      logger.error('Failed to start server:', err);
      process.exit(1);
    }
  });

  server = s;
};

// Start server (async IIFE to handle top-level await)
void startServer(env.PORT);

// Graceful shutdown configuration
// ... (rest of the file remains same)
const SHUTDOWN_TIMEOUT_MS = 30000; // 30 seconds as per PM-009 spec

// Track shutdown state to prevent multiple shutdown attempts
let isShuttingDown = false;

// Graceful shutdown handler
const gracefulShutdown = async (signal: string): Promise<void> => {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress, ignoring ${signal}`);
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown...`, {
    signal,
    timeoutMs: SHUTDOWN_TIMEOUT_MS
  });

  // Set up force exit timeout
  const forceExitTimer = setTimeout(() => {
    logger.warn('Graceful shutdown timed out, forcing exit', {
      timeoutMs: SHUTDOWN_TIMEOUT_MS
    });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Ensure timeout doesn't prevent process from exiting
  forceExitTimer.unref();

  try {
    // Stop accepting new connections
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error('Error closing HTTP server:', {
            error: err.message
          });
          reject(err);
        } else {
          logger.info('HTTP server stopped accepting new connections');
          resolve();
        }
      });
    });

    // Stop Telegram bot
    logger.info('Stopping Telegram bot...');
    stopBot(signal);
    logger.info('Telegram bot stopped');

    // Close BullMQ workers and queues (must be before Redis disconnect)
    logger.info('Closing BullMQ workers and queues...');
    await closeQueues();
    logger.info('BullMQ workers and queues closed');

    // Close Redis connections
    logger.info('Closing Redis connections...');
    await disconnectRedis();
    logger.info('Redis connections closed');

    // Disconnect Prisma
    logger.info('Disconnecting from database...');
    await disconnectPrisma();
    logger.info('Database disconnected');

    // Clear the force exit timer since we're done
    clearTimeout(forceExitTimer);

    logger.info('Graceful shutdown completed successfully', {
      signal,
      duration: 'completed before timeout'
    });
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    // Clear the force exit timer
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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

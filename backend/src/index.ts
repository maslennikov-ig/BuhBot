import express from 'express';
import logger from './utils/logger.js';
import env, { isProduction, isDevelopment } from './config/env.js';

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

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    service: 'buhbot-backend',
    version: '0.1.0'
  });
});

// Ready check endpoint (for Kubernetes readiness probes)
app.get('/ready', (_req, res) => {
  // TODO: Add actual readiness checks (database, redis, etc.)
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
const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);

  server.close(() => {
    logger.info('HTTP server closed');

    // TODO: Close database connections, Redis, etc.
    // await prisma.$disconnect();
    // await redis.quit();

    logger.info('Shutdown complete');
    process.exit(0);
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

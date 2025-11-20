/**
 * Prisma Client Singleton
 *
 * Provides a single PrismaClient instance for the application.
 * Prevents multiple client instances and connection pool exhaustion.
 *
 * Connection Configuration:
 * - Database: PostgreSQL 15+ (Supabase Cloud)
 * - Connection pooling: via Supabase Supavisor (PgBouncer)
 * - Max connections: 10 (per constitution)
 *
 * Usage:
 * ```typescript
 * import { prisma } from './lib/prisma.js';
 * const users = await prisma.user.findMany();
 * ```
 *
 * @module lib/prisma
 */

import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

/**
 * Global augmentation for PrismaClient caching in development
 * Prevents hot-reload from creating multiple instances
 */
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma Client
 *
 * In development: cached in global scope to survive hot-reloads
 * In production: created once and reused
 */
export const prisma = global.prisma || new PrismaClient({
  // Log queries in development (helps with debugging)
  log: process.env['NODE_ENV'] === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

// Cache in global scope for development hot-reload
if (process.env['NODE_ENV'] === 'development') {
  global.prisma = prisma;
}

/**
 * Graceful disconnect on application shutdown
 * Called by shutdown handler in index.ts
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Prisma client disconnected');
  } catch (error) {
    logger.error('Error disconnecting Prisma client:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Test database connection
 * Used by health check endpoint
 *
 * @returns true if connection is healthy, false otherwise
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export default prisma;

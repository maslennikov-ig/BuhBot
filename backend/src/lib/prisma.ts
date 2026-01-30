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

// Ensure env is loaded first
import '../config/env.js';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pg;

/**
 * Global augmentation for PrismaClient caching in development
 * Prevents hot-reload from creating multiple instances
 */
declare global {
  var prisma: PrismaClient | undefined;
  var pgPool: pg.Pool | undefined;
}

/**
 * Create PostgreSQL connection pool
 *
 * Connection priority:
 * 1. DIRECT_URL - Direct connection (port 5432), bypasses Supavisor pooler
 * 2. DATABASE_URL - Fallback, may use pooler (port 6543)
 *
 * Note: Supabase pooler (Supavisor) in session mode requires JWT authentication.
 * Direct connection bypasses this requirement and works with service credentials.
 */
function createPool(): pg.Pool {
  const isDev = process.env['NODE_ENV'] === 'development';

  // In development, prefer DATABASE_URL (local) over DIRECT_URL
  // In production, prefer DIRECT_URL to bypass Supabase pooler JWT requirement
  const connectionString = isDev
    ? process.env['DATABASE_URL'] || process.env['DIRECT_URL']
    : process.env['DIRECT_URL'] || process.env['DATABASE_URL'];

  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL environment variable is required');
  }

  return new Pool({
    connectionString,
    max: 10, // Maximum connections per constitution
    idleTimeoutMillis: 30000,
    // Longer timeout in development (WSL2, Docker, etc.)
    connectionTimeoutMillis: isDev ? 15000 : 5000,
    // Force IPv4 DNS resolution (fixes WSL2 IPv6 connectivity issues)
    // @ts-expect-error - family is a valid option for net.connect() used by pg
    family: 4,
  });
}

/**
 * Create Prisma client with PostgreSQL adapter
 */
function createPrismaClient(pool: pg.Pool): PrismaClient {
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env['NODE_ENV'] === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });
}

// Create or reuse pool and client
const pool = global.pgPool || createPool();
export const prisma = global.prisma || createPrismaClient(pool);

// Cache in global scope for development hot-reload
if (process.env['NODE_ENV'] === 'development') {
  global.pgPool = pool;
  global.prisma = prisma;
}

/**
 * Graceful disconnect on application shutdown
 * Called by shutdown handler in index.ts
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    await pool.end();
    logger.info('Prisma client and pool disconnected');
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

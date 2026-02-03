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

// Ensure env is loaded first; use validated env for connection (includes test defaults)
import env from '../config/env.js';

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
 * Connection priority (environment-aware):
 * - Development: DATABASE_URL (pooler, port 6543) - more reliable in WSL2/local envs
 * - Production: DIRECT_URL (port 5432) - bypasses Supavisor for migrations
 *
 * Note: Supabase pooler (Supavisor) works with service credentials in transaction mode.
 * Direct connection is preferred for production but may have IPv6 issues locally.
 */
function createPool(): pg.Pool {
  const isDev = env.NODE_ENV === 'development';

  // Use validated env (includes test defaults when NODE_ENV=test)
  // In development, prefer DATABASE_URL (local) over DIRECT_URL
  // In production, prefer DIRECT_URL to bypass Supabase pooler JWT requirement
  const connectionString = isDev
    ? env.DIRECT_URL || env.DATABASE_URL
    : env.DIRECT_URL || env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL environment variable is required');
  }

  // Log which connection type is being used (helpful for debugging)
  // Using console.log because this runs before logger module is initialized
  const isSupabase = connectionString.includes('supabase.com');
  const urlType = connectionString.includes('pooler.supabase.com') ? 'pooler' : 'direct';
  // eslint-disable-next-line no-console
  console.log(
    `[prisma] Database connection: using ${urlType} URL in ${isDev ? 'development' : 'production'} mode`
  );

  // For Supabase in dev environments with TLS issues, disable certificate verification
  // This is safe for development but should be investigated for production
  if (isDev && isSupabase) {
    // eslint-disable-next-line no-console
    console.log('[prisma] Disabling TLS certificate verification for development');
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
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
    // SSL configuration for Supabase pooler
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });
}

/**
 * Create Prisma client with PostgreSQL adapter
 */
function createPrismaClient(pool: pg.Pool): PrismaClient {
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

// Create or reuse pool and client
const pool = global.pgPool || createPool();
export const prisma = global.prisma || createPrismaClient(pool);

// Cache in global scope for development hot-reload
if (env.NODE_ENV === 'development') {
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

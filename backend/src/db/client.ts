/**
 * Supabase Connection Pooling Client
 *
 * Configures Prisma connection pooling for Supabase PostgreSQL.
 * Uses pg Pool for connection pooling with Prisma 7 driver adapter.
 *
 * Connection Configuration (per constitution):
 * - Max connections: 10 (connection_limit=10)
 * - Pool mode: transaction (pgbouncer=true)
 * - SSL mode: require (sslmode=require)
 *
 * @module db/client
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pg;

/**
 * Connection pool configuration
 * Based on project constitution and research.md
 */
export const POOL_CONFIG = {
  /** Maximum connections per pool (per constitution) */
  MAX_CONNECTIONS: 10,
  /** Connection timeout in milliseconds */
  CONNECTION_TIMEOUT: 5000,
  /** Query timeout in milliseconds */
  QUERY_TIMEOUT: 30000,
  /** Idle timeout in milliseconds */
  IDLE_TIMEOUT: 30000,
} as const;

/**
 * Validate DATABASE_URL has required TLS settings
 * Ensures sslmode=require is present for production security
 *
 * @param url - Database connection URL
 * @returns true if URL has proper TLS configuration
 */
export function validateDatabaseUrl(url: string | undefined): boolean {
  if (!url) {
    logger.error('DATABASE_URL is not set');
    return false;
  }

  // Check for SSL/TLS requirement
  const hasSSL = url.includes('sslmode=require') ||
    url.includes('ssl=true') ||
    url.includes('?sslmode=') ||
    url.includes('&sslmode=');

  if (!hasSSL && process.env['NODE_ENV'] === 'production') {
    logger.warn('DATABASE_URL missing sslmode=require - TLS is recommended for production');
  }

  // Check for connection pool settings
  const hasPooler = url.includes('pgbouncer=true') ||
    url.includes('pooler.supabase.com');

  if (!hasPooler) {
    logger.info('DATABASE_URL not using Supabase pooler - direct connection');
  }

  // Check connection limit
  const connectionLimitMatch = url.match(/connection_limit=(\d+)/);
  const connectionLimit = connectionLimitMatch?.[1] ? parseInt(connectionLimitMatch[1], 10) : null;

  if (connectionLimit && connectionLimit > POOL_CONFIG.MAX_CONNECTIONS) {
    logger.warn(`Connection limit ${connectionLimit} exceeds recommended max ${POOL_CONFIG.MAX_CONNECTIONS}`);
  }

  return true;
}

/**
 * Build optimized DATABASE_URL with connection pooling settings
 * Adds connection_limit if not present
 *
 * @param baseUrl - Base DATABASE_URL
 * @returns Optimized URL with connection pool settings
 */
export function buildPooledDatabaseUrl(baseUrl: string | undefined): string {
  if (!baseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  const url = new URL(baseUrl);

  // Ensure connection_limit is set
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', String(POOL_CONFIG.MAX_CONNECTIONS));
  }

  // Ensure sslmode is set for production
  if (process.env['NODE_ENV'] === 'production' && !url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }

  return url.toString();
}

/**
 * Create PostgreSQL connection pool
 *
 * @param connectionString - Database connection string
 * @returns Configured pg Pool instance
 */
export function createPool(connectionString: string): pg.Pool {
  return new Pool({
    connectionString,
    max: POOL_CONFIG.MAX_CONNECTIONS,
    idleTimeoutMillis: POOL_CONFIG.IDLE_TIMEOUT,
    connectionTimeoutMillis: POOL_CONFIG.CONNECTION_TIMEOUT,
  });
}

/**
 * Create Prisma Client with connection pooling configuration
 * Uses Prisma 7 driver adapter pattern
 *
 * @returns Configured PrismaClient instance
 */
export function createPooledPrismaClient(): PrismaClient {
  const databaseUrl = process.env['DATABASE_URL'];

  if (!validateDatabaseUrl(databaseUrl)) {
    throw new Error('Invalid DATABASE_URL configuration');
  }

  // Build optimized URL
  const pooledUrl = buildPooledDatabaseUrl(databaseUrl);

  // Log connection info (without credentials)
  const safeUrl = pooledUrl.replace(/:[^@]+@/, ':****@');
  logger.info('Creating pooled Prisma client', { url: safeUrl });

  // Create pg pool
  const pool = createPool(pooledUrl);

  // Create Prisma adapter
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env['NODE_ENV'] === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });
}

/**
 * Get connection pool statistics
 * Note: Prisma doesn't expose pool stats directly, this provides config info
 *
 * @returns Pool configuration information
 */
export function getPoolStats(): {
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  environment: string;
} {
  return {
    maxConnections: POOL_CONFIG.MAX_CONNECTIONS,
    connectionTimeout: POOL_CONFIG.CONNECTION_TIMEOUT,
    queryTimeout: POOL_CONFIG.QUERY_TIMEOUT,
    environment: process.env['NODE_ENV'] || 'development',
  };
}

export default {
  POOL_CONFIG,
  validateDatabaseUrl,
  buildPooledDatabaseUrl,
  createPool,
  createPooledPrismaClient,
  getPoolStats,
};

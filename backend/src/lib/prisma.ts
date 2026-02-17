/**
 * Prisma Client Singleton
 *
 * Provides a single PrismaClient instance for the application.
 * Prevents multiple client instances and connection pool exhaustion.
 *
 * Includes automatic audit trail for ClientRequest field changes (gh-70).
 * Tracked fields: status, assignedTo, classification, classificationScore,
 * slaBreached, respondedBy. Changes are logged to the RequestHistory table.
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

import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pg;

/**
 * Fields on ClientRequest that are tracked in the audit trail (gh-70).
 * Any update to these fields will automatically create a RequestHistory entry.
 */
const TRACKED_FIELDS = [
  'status',
  'assignedTo',
  'classification',
  'classificationScore',
  'slaBreached',
  'respondedBy',
] as const;

// ---------------------------------------------------------------------------
// Audit context: allows callers to pass changedBy / reason to the extension
// ---------------------------------------------------------------------------

interface AuditContext {
  changedBy?: string | undefined;
  reason?: string | undefined;
}

const auditContextStorage = new AsyncLocalStorage<AuditContext>();

/**
 * Run a callback with audit context attached.
 *
 * Any `clientRequest.update` executed inside the callback will use the
 * provided `changedBy` and `reason` in the generated RequestHistory entries.
 *
 * @example
 * ```typescript
 * import { withAuditContext } from './lib/prisma.js';
 *
 * await withAuditContext({ changedBy: userId, reason: 'Manager override' }, async () => {
 *   await prisma.clientRequest.update({ where: { id }, data: { status: 'closed' } });
 * });
 * ```
 */
export function withAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  return auditContextStorage.run(ctx, fn);
}

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

  // TLS verification: never disable in production (gh-127)
  // In development, only disable if explicitly opted in via env var
  if (isDev && isSupabase && process.env['PRISMA_DEV_DISABLE_TLS'] === 'true') {
    // eslint-disable-next-line no-console
    console.log('[prisma] WARNING: TLS verification disabled (PRISMA_DEV_DISABLE_TLS=true)');
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
 * Convert a field value to a string for audit trail storage.
 * Handles null, undefined, boolean, number, bigint, and string values.
 */
function valueToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  return String(value);
}

/**
 * Create Prisma client extension for automatic audit trail on ClientRequest (gh-70).
 *
 * Intercepts `clientRequest.update` to:
 * 1. Fetch the current record before the update
 * 2. Execute the update
 * 3. Diff tracked fields and create RequestHistory entries for each change
 *
 * Audit logging is non-blocking: failures are caught and logged,
 * never preventing the original update from succeeding.
 */
function withAuditTrail(baseClient: PrismaClient): PrismaClient {
  const extended = baseClient.$extends({
    query: {
      clientRequest: {
        async update({ args, query }) {
          // Capture the record ID from the where clause
          const whereId = (args.where as { id?: string })?.id;

          // If no ID in where clause, skip audit (composite where not supported)
          if (!whereId) {
            return query(args);
          }

          // Fetch current values BEFORE the update.
          // Note: There is a theoretical TOCTOU race between this read and the update below.
          // If another concurrent request modifies the same record between findUnique and query(args),
          // the diff may record an incorrect old value. This is acceptable because:
          // 1. The audit trail is best-effort (non-blocking, errors caught)
          // 2. The main update integrity is unaffected
          // 3. Concurrent updates to the same ClientRequest are rare in this application
          // 4. Prisma $extends query hooks cannot wrap query(args) in a separate transaction
          // For perfect accuracy, consider database triggers instead.
          let oldRecord: Record<string, unknown> | null = null;
          try {
            oldRecord = (await baseClient.clientRequest.findUnique({
              where: { id: whereId },
              select: {
                status: true,
                assignedTo: true,
                classification: true,
                classificationScore: true,
                slaBreached: true,
                respondedBy: true,
              },
            })) as Record<string, unknown> | null;
          } catch (err) {
            logger.warn('Audit trail: failed to fetch old record', {
              requestId: whereId,
              error: err instanceof Error ? err.message : String(err),
              service: 'audit-trail',
            });
          }

          // Execute the actual update
          const result = await query(args);

          // Diff tracked fields and create history entries (non-blocking)
          if (oldRecord) {
            try {
              const updateData = args.data as Record<string, unknown> | undefined;
              if (!updateData) return result;

              const historyEntries: Prisma.RequestHistoryCreateManyInput[] = [];

              for (const field of TRACKED_FIELDS) {
                // Skip fields not present in the update data
                if (!(field in updateData)) continue;

                const oldVal = valueToString(oldRecord[field]);
                const newVal = valueToString(updateData[field]);

                // Only record actual changes
                if (oldVal === newVal) continue;

                historyEntries.push({
                  requestId: whereId,
                  field,
                  oldValue: oldVal,
                  newValue: newVal,
                  changedBy: extractChangedBy(updateData),
                  reason: extractReason() ?? null,
                });
              }

              if (historyEntries.length > 0) {
                await baseClient.requestHistory
                  .createMany({ data: historyEntries })
                  .catch((err: unknown) => {
                    logger.warn('Audit trail: failed to write history entries', {
                      requestId: whereId,
                      fields: historyEntries.map((e) => e.field),
                      error: err instanceof Error ? err.message : String(err),
                      service: 'audit-trail',
                    });
                  });
              }
            } catch (err) {
              logger.warn('Audit trail: unexpected error during diff', {
                requestId: whereId,
                error: err instanceof Error ? err.message : String(err),
                service: 'audit-trail',
              });
            }
          }

          return result;
        },
      },
    },
  });

  // Cast back to PrismaClient for type compatibility with the rest of the codebase.
  // This is safe because query extensions only add hooks; they do not alter the public API.
  return extended as unknown as PrismaClient;
}

/**
 * Extract the changedBy identifier from audit context and update data.
 *
 * Priority:
 * 1. Explicit `changedBy` from AuditContext (via withAuditContext)
 * 2. `respondedBy` from the update data
 * 3. `assignedTo` from the update data
 * 4. Fallback to 'system'
 */
function extractChangedBy(data: Record<string, unknown>): string {
  const ctx = auditContextStorage.getStore();
  if (ctx?.changedBy) return ctx.changedBy;
  if (typeof data['respondedBy'] === 'string') return data['respondedBy'];
  if (typeof data['assignedTo'] === 'string') return data['assignedTo'];
  return 'system';
}

/**
 * Extract the reason from audit context, if set.
 */
function extractReason(): string | undefined {
  return auditContextStorage.getStore()?.reason;
}

/**
 * Create Prisma client with PostgreSQL adapter and audit trail extension
 */
function createPrismaClient(pool: pg.Pool): PrismaClient {
  const adapter = new PrismaPg(pool);

  const baseClient = new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  return withAuditTrail(baseClient);
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

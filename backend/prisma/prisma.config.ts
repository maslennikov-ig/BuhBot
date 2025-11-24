/**
 * Prisma Configuration for Prisma 7
 *
 * This file configures datasource connections for Prisma migrations.
 * Connection URLs are loaded from environment variables.
 *
 * Connection Configuration:
 * - Database: PostgreSQL 15+ (Supabase Cloud)
 * - Connection pooling: via Supabase Supavisor (PgBouncer)
 * - Max connections: 10 (per constitution)
 *
 * @module prisma/config
 */

import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

// Load environment variables
import 'dotenv/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(import.meta.dirname, 'schema.prisma'),

  // Migrations configuration
  migrations: {
    path: path.join(import.meta.dirname, 'migrations'),
  },

  // Datasource configuration for migrations
  // Uses DIRECT_URL for migrations (bypasses connection pooler)
  datasource: {
    url: env('DIRECT_URL') || env('DATABASE_URL'),
  },
});

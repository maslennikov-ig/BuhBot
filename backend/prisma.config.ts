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
import * as dotenv from 'dotenv';

// Load environment variables from current directory
dotenv.config({ path: path.join(import.meta.dirname, '.env') });

console.log('CONFIG DEBUG: DATABASE_URL in config:', !!process.env.DATABASE_URL);

export default defineConfig({
  earlyAccess: true,
  schema: path.join(import.meta.dirname, 'prisma/schema.prisma'),

  // Migrations configuration
  migrations: {
    path: path.join(import.meta.dirname, 'prisma/migrations'),
  },

  // Datasource configuration for migrations
  // Uses DIRECT_URL for migrations (bypasses connection pooler)
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy",
  },
});

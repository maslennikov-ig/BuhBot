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
import { defineConfig } from 'prisma/config';

// Load environment variables
import 'dotenv/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(import.meta.dirname, 'schema.prisma'),

  migrate: {
    async resolveConnection() {
      // Use DIRECT_URL for migrations (bypasses pooler)
      // Falls back to DATABASE_URL if DIRECT_URL is not set
      const url = process.env['DIRECT_URL'] || process.env['DATABASE_URL'];

      if (!url) {
        throw new Error('DATABASE_URL or DIRECT_URL environment variable is required for migrations');
      }

      return { url };
    },
  },
});

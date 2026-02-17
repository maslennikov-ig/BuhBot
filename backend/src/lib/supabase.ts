/**
 * Supabase Client Singleton
 *
 * Configures and exports a single Supabase client instance for server-side operations.
 * Uses the service role key for administrative operations and JWT validation.
 *
 * DEV MODE:
 * - When DEV_MODE=true and Supabase credentials are missing, uses placeholder values
 * - Auth is bypassed in context.ts, so the client is never actually used for auth
 * - This keeps the client non-nullable for TypeScript compatibility
 *
 * SECURITY:
 * - Service role key bypasses Row Level Security (RLS) policies
 * - Only use this client for admin operations and JWT verification
 * - Never expose service role key to client-side code
 *
 * @module lib/supabase
 */

import { createClient } from '@supabase/supabase-js';
import { isDevMode } from '../config/env.js';
import logger from '../utils/logger.js';

// Validate credentials (gh-130: no placeholder fallback)
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseServiceKey) {
  if (!isDevMode) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  logger.warn(
    '[Supabase] DEV MODE: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. ' +
      'Auth will be bypassed in context.ts. Set these env vars to enable Supabase auth.'
  );
}

/**
 * Supabase client configured with service role key
 *
 * Configuration:
 * - autoRefreshToken: false (server-side, JWT validated per request)
 * - persistSession: false (server-side, stateless operation)
 */
// In dev mode without credentials, create a no-op client that will fail gracefully
// Auth is bypassed in context.ts anyway (gh-130)
export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseServiceKey ?? 'dev-mode-no-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

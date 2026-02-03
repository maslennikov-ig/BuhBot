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

// Get Supabase credentials or use placeholders in DEV MODE
const supabaseUrl = process.env['SUPABASE_URL'] || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'placeholder-key';

// Validate credentials in production mode
if (!isDevMode) {
  if (!process.env['SUPABASE_URL']) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }
} else if (!process.env['SUPABASE_URL']) {
  logger.warn('[Supabase] DEV MODE: Auth bypassed in context.ts, using placeholder credentials');
}

/**
 * Supabase client configured with service role key
 *
 * Configuration:
 * - autoRefreshToken: false (server-side, JWT validated per request)
 * - persistSession: false (server-side, stateless operation)
 */
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

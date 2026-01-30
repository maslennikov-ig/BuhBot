/**
 * Supabase Client Singleton
 *
 * Configures and exports a single Supabase client instance for server-side operations.
 * Uses the service role key for administrative operations and JWT validation.
 *
 * SECURITY:
 * - Service role key bypasses Row Level Security (RLS) policies
 * - Only use this client for admin operations and JWT verification
 * - Never expose service role key to client-side code
 *
 * DEV MODE:
 * - When Supabase is not configured, auth is bypassed
 * - All requests are treated as authenticated with a dev user
 *
 * @module lib/supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Validate required environment variables
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

// Check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseServiceKey);

// Development mode - bypass auth when Supabase is not configured
export const isDevMode = process.env['NODE_ENV'] === 'development' && !isSupabaseConfigured;

if (isDevMode) {
  console.warn(
    '[Supabase] Running in DEV MODE without Supabase Auth.\n' +
    'Authentication is bypassed. All requests will be treated as authenticated.\n' +
    'To enable auth, add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env'
  );
}

// In production, require Supabase
if (!isSupabaseConfigured && process.env['NODE_ENV'] === 'production') {
  throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * Supabase client configured with service role key
 * Returns null in dev mode when Supabase is not configured
 *
 * Configuration:
 * - autoRefreshToken: false (server-side, JWT validated per request)
 * - persistSession: false (server-side, stateless operation)
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

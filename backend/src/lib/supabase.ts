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
 * @module lib/supabase
 */

import { createClient } from '@supabase/supabase-js';

// Validate required environment variables
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl) {
  throw new Error('Missing required environment variable: SUPABASE_URL');
}

if (!supabaseServiceKey) {
  throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
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

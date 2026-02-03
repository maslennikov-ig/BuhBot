/**
 * tRPC Client Setup for BuhBot Admin Panel
 *
 * Provides type-safe API calls to the backend tRPC server.
 * Uses React Query for caching and state management.
 *
 * @module lib/trpc
 */

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../types/trpc';
import { supabase } from './supabase';
import { isDevMode } from './config';

/**
 * tRPC React hooks
 *
 * Usage:
 * ```tsx
 * const { data } = trpc.chats.list.useQuery();
 * const mutation = trpc.chats.update.useMutation();
 * ```
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Get the tRPC API URL based on environment
 */
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return '';
  }

  // SSR should use absolute URL
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Default to localhost in development (backend runs on port 3000)
  return 'http://localhost:3000';
}

/**
 * Create tRPC client with httpBatchLink
 *
 * Features:
 * - Automatic request batching
 * - JWT token injection from localStorage
 * - Error handling middleware
 * - DEV MODE: Uses mock token when Supabase is not configured
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        async headers() {
          // DEV MODE: Skip Supabase auth, send dev mode headers
          if (isDevMode) {
            return {
              'X-Dev-Mode': 'true',
              Authorization: 'Bearer dev-mode-token',
            };
          }

          // Get JWT token from Supabase session (client-side only)
          if (typeof window !== 'undefined' && supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              return {
                Authorization: `Bearer ${session.access_token}`,
              };
            }
          }
          return {};
        },
      }),
    ],
  });
}


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

  // Default to localhost in development
  return 'http://localhost:3001';
}

/**
 * Create tRPC client with httpBatchLink
 *
 * Features:
 * - Automatic request batching
 * - JWT token injection from localStorage
 * - Error handling middleware
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/trpc`,
        headers() {
          // Get JWT token from localStorage (client-side only)
          if (typeof window !== 'undefined') {
            const token = localStorage.getItem('access_token');
            if (token) {
              return {
                Authorization: `Bearer ${token}`,
              };
            }
          }
          return {};
        },
      }),
    ],
  });
}

/**
 * Vanilla tRPC client for non-React contexts
 *
 * Usage in Server Actions or API routes:
 * ```ts
 * import { vanillaClient } from '@/lib/trpc';
 * const result = await vanillaClient.chats.list.query();
 * ```
 */
export const vanillaClient = createTRPCClient();

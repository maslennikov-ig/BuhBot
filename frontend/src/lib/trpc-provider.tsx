'use client';

/**
 * tRPC Provider Component
 *
 * Wraps the application with tRPC and React Query providers.
 * Must be used in a Client Component.
 *
 * @module lib/trpc-provider
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { trpc, createTRPCClient } from './trpc';

interface TRPCProviderProps {
  children: React.ReactNode;
}

/**
 * TRPCProvider component
 *
 * Usage in layout.tsx:
 * ```tsx
 * import { TRPCProvider } from '@/lib/trpc-provider';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <TRPCProvider>{children}</TRPCProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function TRPCProvider({ children }: TRPCProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Default stale time: 30 seconds
            staleTime: 30 * 1000,
            // Retry failed requests 3 times
            retry: 3,
            // Refetch on window focus for real-time updates
            refetchOnWindowFocus: true,
          },
          mutations: {
            // Don't retry mutations by default
            retry: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

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
            retry: false,
            onError: (error) => {
              if (
                process.env.NEXT_PUBLIC_DEV_MODE === 'true' &&
                process.env.NODE_ENV === 'development'
              ) {
                console.error('[DEV MODE] Mutation failed:', error.message);
                if (typeof window !== 'undefined') {
                  const msg = `API Error: ${error.message}`;
                  console.warn(`%c${msg}`, 'color: red; font-weight: bold; font-size: 14px;');
                }
              }
            },
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

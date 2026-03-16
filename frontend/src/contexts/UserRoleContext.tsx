'use client';

import { createContext, useContext } from 'react';

export type UserRole = 'admin' | 'manager' | 'observer' | 'accountant';

export interface UserRoleContextValue {
  role: UserRole | undefined;
  isLoading: boolean;
}

/**
 * Context provided by AdminLayoutContent after it queries trpc.auth.me.
 * Child components (including useRoleGuard) can consume this instead of
 * making their own trpc.auth.me.useQuery() call.
 *
 * The context is intentionally left as `null` when no provider is present,
 * so consumers can detect that case and fall back to a direct query.
 */
export const UserRoleContext = createContext<UserRoleContextValue | null>(null);

/**
 * Hook to consume UserRoleContext.
 * Returns `null` if called outside of a UserRoleProvider (i.e. outside AdminLayout).
 */
export function useUserRoleContext(): UserRoleContextValue | null {
  return useContext(UserRoleContext);
}

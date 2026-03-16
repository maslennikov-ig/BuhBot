'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useUserRoleContext } from '@/contexts/UserRoleContext';

export function useRoleGuard(deniedRoles: string[]) {
  const ctx = useUserRoleContext();
  // Fall back to direct query when outside UserRoleContext (e.g. login page)
  const { data: me, isLoading: queryLoading } = trpc.auth.me.useQuery(undefined, {
    enabled: ctx === null,
  });

  const role = ctx?.role ?? me?.role;
  const isLoading = ctx ? ctx.isLoading : queryLoading;

  const router = useRouter();
  const deniedRolesKey = deniedRoles.join(',');

  useEffect(() => {
    if (role && deniedRoles.includes(role)) {
      router.replace('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, deniedRolesKey, router]);

  return {
    isAllowed: role ? !deniedRoles.includes(role) : null,
    isLoading,
  };
}

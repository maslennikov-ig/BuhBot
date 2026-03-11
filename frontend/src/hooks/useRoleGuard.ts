'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

export function useRoleGuard(deniedRoles: string[]) {
  const { data: me, isLoading } = trpc.auth.me.useQuery();
  const router = useRouter();

  useEffect(() => {
    if (me && deniedRoles.includes(me.role)) {
      router.replace('/dashboard');
    }
  }, [me, deniedRoles, router]);

  return {
    isAllowed: me ? !deniedRoles.includes(me.role) : null,
    isLoading,
  };
}

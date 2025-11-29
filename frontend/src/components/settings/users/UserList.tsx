'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Search, User as UserIcon, MessageCircle } from 'lucide-react';

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type UserItem = RouterOutputs['auth']['listUsers'][number];

interface UserListProps {
  onEditRole: (user: UserItem) => void;
}

const ROLE_LABELS = {
  admin: 'Администратор',
  manager: 'Менеджер',
  observer: 'Наблюдатель',
};

const ROLE_COLORS = {
  admin: 'text-[var(--buh-error)] bg-[var(--buh-error-muted)]',
  manager: 'text-[var(--buh-primary)] bg-[var(--buh-primary-muted)]',
  observer: 'text-[var(--buh-foreground-muted)] bg-[var(--buh-surface-subtle)]',
};

export function UserList({ onEditRole }: UserListProps) {
  const [search, setSearch] = React.useState('');

  const { data: users, isLoading } = trpc.auth.listUsers.useQuery({});

  const filteredItems = React.useMemo(() => {
    if (!users) return [];
    if (!search) return users;
    const lowerSearch = search.toLowerCase();
    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(lowerSearch) ||
        user.email.toLowerCase().includes(lowerSearch)
    );
  }, [users, search]);

  if (isLoading) {
    return <div className="buh-shimmer h-64 w-full rounded-xl" />;
  }

  return (
    <GlassCard variant="default" padding="md" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--buh-foreground-subtle)]" />
          <input
            type="text"
            placeholder="Поиск пользователей..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] pl-9 pr-4 text-sm focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--buh-border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--buh-surface-subtle)]">
            <tr>
              <th className="px-4 py-3 font-semibold text-[var(--buh-foreground-muted)]">Пользователь</th>
              <th className="px-4 py-3 font-semibold text-[var(--buh-foreground-muted)]">Email</th>
              <th className="px-4 py-3 font-semibold text-[var(--buh-foreground-muted)]">Роль</th>
              <th className="px-4 py-3 font-semibold text-[var(--buh-foreground-muted)] text-center">Telegram</th>
              <th className="px-4 py-3 font-semibold text-[var(--buh-foreground-muted)] text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--buh-border)] bg-[var(--buh-surface)]">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--buh-foreground-muted)]">
                  Нет данных
                </td>
              </tr>
            ) : (
              filteredItems.map((user) => (
                <tr key={user.id} className="hover:bg-[var(--buh-surface-elevated)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--buh-foreground)]">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground-muted)]">
                            <UserIcon className="h-4 w-4" />
                        </div>
                        {user.fullName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--buh-foreground-muted)]">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role as keyof typeof ROLE_COLORS] || ROLE_COLORS.observer}`}>
                        {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.telegramId ? (
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--buh-primary-muted)] text-[var(--buh-primary)]" title="Подключен к Telegram">
                             <MessageCircle className="h-4 w-4" />
                        </div>
                    ) : (
                        <span className="text-[var(--buh-foreground-subtle)]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => onEditRole(user)} className="text-[var(--buh-primary)] hover:text-[var(--buh-primary-hover)]">
                        Изменить роль
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

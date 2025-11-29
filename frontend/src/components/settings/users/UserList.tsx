'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Search, User as UserIcon, MessageCircle, Users } from 'lucide-react';

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
    return (
      <GlassCard variant="default" padding="md" className="flex flex-col gap-4">
        <div className="buh-shimmer h-9 w-64 rounded-lg" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="buh-shimmer h-4 w-32 rounded" />
              <div className="buh-shimmer h-4 w-48 rounded" />
              <div className="buh-shimmer h-4 w-24 rounded" />
            </div>
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="default" padding="md" className="group relative flex flex-col gap-4 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
          <Users className="h-5 w-5 text-[var(--buh-primary)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--buh-foreground)]">Пользователи системы</h3>
          <p className="text-xs text-[var(--buh-foreground-subtle)]">Управление ролями и доступом</p>
        </div>
      </div>

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
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">Пользователь</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">Роль</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">Telegram</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--buh-border)] bg-[var(--buh-surface)]">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)]">
                      <Users className="h-8 w-8 text-[var(--buh-foreground-subtle)]" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-[var(--buh-foreground)]">Нет пользователей</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((user, index) => (
                <tr 
                  key={user.id} 
                  className="hover:bg-[var(--buh-surface-elevated)] transition-colors buh-animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
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

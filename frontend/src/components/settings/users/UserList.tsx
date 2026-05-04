'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import {
  Search,
  User as UserIcon,
  MessageCircle,
  Users,
  Trash2,
  Plus,
  Pencil,
  Link,
  Check,
  Loader2,
} from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/ui/SortableHeader';

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type UserItem = RouterOutputs['auth']['listUsers'][number];

import { ROLE_LABELS, ROLE_COLORS } from './constants';

interface UserListProps {
  onEditUser: (user: UserItem) => void;
  onEditTelegramId: (user: UserItem) => void;
  onDeleteUser: (user: UserItem) => void;
  onAddUser: () => void;
  isAdmin: boolean;
}

const ROLE_FILTER_OPTIONS: { label: string; value: string | null }[] = [
  { label: 'Все', value: null },
  { label: 'Администраторы', value: 'admin' },
  { label: 'Менеджеры', value: 'manager' },
  { label: 'Бухгалтеры', value: 'accountant' },
  { label: 'Наблюдатели', value: 'observer' },
];

export function UserList({
  onEditUser,
  onEditTelegramId,
  onDeleteUser,
  onAddUser,
  isAdmin,
}: UserListProps) {
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string | null>(null);
  const [copiedUserId, setCopiedUserId] = React.useState<string | null>(null);
  const utils = trpc.useContext();

  const { data: users, isLoading } = trpc.auth.listUsers.useQuery({});

  const regenerateLink = trpc.auth.regenerateVerificationLink.useMutation({
    onSuccess: async (data, { userId }) => {
      try {
        await navigator.clipboard.writeText(data.verificationLink);
        setCopiedUserId(userId);
        setTimeout(() => setCopiedUserId(null), 2000);
        utils.auth.listUsers.invalidate();
      } catch {
        // Fallback: show link in alert if clipboard not available
        alert(`Ссылка для подключения:\n\n${data.verificationLink}`);
      }
    },
  });

  const handleCopyVerificationLink = (user: UserItem) => {
    regenerateLink.mutate({ userId: user.id });
  };

  const filteredItems = React.useMemo(() => {
    if (!users) return [];
    let result = users;
    if (roleFilter) {
      result = result.filter((user) => user.role === roleFilter);
    }
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(
        (user) =>
          user.fullName.toLowerCase().includes(lowerSearch) ||
          user.email.toLowerCase().includes(lowerSearch)
      );
    }
    return result;
  }, [users, search, roleFilter]);

  const { sortedData, requestSort, getSortIcon } = useTableSort(filteredItems, 'fullName', 'asc');

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
    <GlassCard
      variant="default"
      padding="md"
      className="group relative flex flex-col gap-4 overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
          <Users className="h-5 w-5 text-[var(--buh-primary)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--buh-foreground)]">
            Пользователи системы
          </h3>
          <p className="text-xs text-[var(--buh-foreground-subtle)]">
            Управление ролями и доступом
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ROLE_FILTER_OPTIONS.map((option) => {
          const isActive = roleFilter === option.value;
          return (
            <button
              key={option.label}
              onClick={() => setRoleFilter(option.value)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--buh-primary)] text-white'
                  : 'bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-primary-muted)] hover:text-[var(--buh-primary)]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
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
        {isAdmin && (
          <Button onClick={onAddUser} className="buh-btn-primary gap-2">
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--buh-border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--buh-surface-subtle)]">
            <tr>
              <SortableHeader
                label="Пользователь"
                sortDirection={getSortIcon('fullName')}
                onClick={() => requestSort('fullName')}
                className="px-6 py-3"
              />
              <SortableHeader
                label="Email"
                sortDirection={getSortIcon('email')}
                onClick={() => requestSort('email')}
                className="px-6 py-3"
              />
              <SortableHeader
                label="Роль"
                sortDirection={getSortIcon('role')}
                onClick={() => requestSort('role')}
                className="px-6 py-3"
              />
              <SortableHeader
                label="Статус"
                sortDirection={getSortIcon('isActive')}
                onClick={() => requestSort('isActive')}
                className="px-6 py-3"
              />
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Telegram
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--buh-border)] bg-[var(--buh-surface)]">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)]">
                      <Users className="h-8 w-8 text-[var(--buh-foreground-subtle)]" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-[var(--buh-foreground)]">
                      Нет пользователей
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((user, index) => (
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
                  <td className="px-4 py-3 text-[var(--buh-foreground-muted)]">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] || ROLE_COLORS.observer}`}
                    >
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-[var(--buh-success)] bg-[var(--buh-success)]/10">
                        Активен
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-[var(--buh-error)] bg-[var(--buh-error-muted)]">
                        Деактивирован
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isAdmin ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEditTelegramId(user)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                            user.telegramId
                              ? 'bg-[var(--buh-primary-muted)] text-[var(--buh-primary)] hover:bg-[var(--buh-primary)]/20'
                              : 'bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground-subtle)] hover:bg-[var(--buh-surface-subtle)] hover:text-[var(--buh-foreground-muted)]'
                          }`}
                          title={
                            user.telegramId
                              ? `Telegram ID: ${user.telegramId}`
                              : 'Установить Telegram ID'
                          }
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                        {user.role === 'accountant' && !user.telegramId && (
                          <button
                            onClick={() => handleCopyVerificationLink(user)}
                            disabled={regenerateLink.isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground-subtle)] hover:bg-[var(--buh-accent-glow)] hover:text-[var(--buh-accent)] transition-colors"
                            title="Сгенерировать ссылку и скопировать в буфер"
                          >
                            {copiedUserId === user.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : regenerateLink.isPending &&
                              regenerateLink.variables?.userId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Link className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    ) : user.telegramId ? (
                      <div
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--buh-primary-muted)] text-[var(--buh-primary)]"
                        title="Подключен к Telegram"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </div>
                    ) : (
                      <span className="text-[var(--buh-foreground-subtle)]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditUser(user)}
                          className="text-[var(--buh-primary)] hover:text-[var(--buh-primary-hover)] hover:bg-[var(--buh-primary-muted)]"
                          title="Редактировать пользователя"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteUser(user)}
                          className="text-[var(--buh-error)] hover:text-[var(--buh-error)] hover:bg-[var(--buh-error-muted)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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

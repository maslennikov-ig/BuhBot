'use client';

/**
 * ChatsListContent - Client Component
 *
 * Interactive content for the chats list page.
 * Shows table of all chats with filtering and pagination.
 *
 * @module components/chats/ChatsListContent
 */

import * as React from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Users,
  User,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  Loader2,
  X,
} from 'lucide-react';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { useTableSort } from '@/hooks/useTableSort';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { HelpButton } from '@/components/ui/HelpButton';
import { InvitationModal } from './InvitationModal';

// ============================================
// TYPES
// ============================================

type ChatType = 'private' | 'group' | 'supergroup';

type Chat = {
  id: number;
  chatType: ChatType;
  title: string | null;
  accountantUsername: string | null;
  assignedAccountantId: string | null;
  slaEnabled: boolean;
  slaResponseMinutes: number;
  createdAt: string;
};

type FilterState = {
  assignedTo: string;
  slaEnabled: string; // 'all' | 'true' | 'false'
};

// Flattened type for sorting (handling nested fields)
type SortableChat = Chat & {
  accountantDisplayName: string; // Computed field for sorting accountant
  slaStatus: string; // Computed field for sorting SLA status ('enabled' | 'disabled')
};

// ============================================
// CONSTANTS
// ============================================

const ITEMS_PER_PAGE = 10;

const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  private: 'Личный',
  group: 'Группа',
  supergroup: 'Супергруппа',
};

const CHAT_TYPE_ICONS: Record<ChatType, React.ElementType> = {
  private: User,
  group: Users,
  supergroup: Users,
};


// ============================================
// CHATS LIST CONTENT COMPONENT
// ============================================

export function ChatsListContent() {
  const [filters, setFilters] = React.useState<FilterState>({
    assignedTo: '',
    slaEnabled: 'all',
  });
  const [page, setPage] = React.useState(0);
  const [showFilters, setShowFilters] = React.useState(false);
  const [showAddModal, setShowAddModal] = React.useState(false);

  const utils = trpc.useUtils();

  // Build query params
  const queryParams = React.useMemo(() => {
    const params: {
      assignedTo?: string;
      slaEnabled?: boolean;
      limit: number;
      offset: number;
    } = {
      limit: ITEMS_PER_PAGE,
      offset: page * ITEMS_PER_PAGE,
    };

    if (filters.assignedTo) {
      params.assignedTo = filters.assignedTo;
    }

    if (filters.slaEnabled !== 'all') {
      params.slaEnabled = filters.slaEnabled === 'true';
    }

    return params;
  }, [filters, page]);

  const { data, isLoading, error } = trpc.chats.list.useQuery(queryParams);

  const chats = (data?.chats ?? []) as Chat[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Transform chats for sorting (add computed fields)
  const sortableChats: SortableChat[] = React.useMemo(
    () =>
      chats.map((chat) => ({
        ...chat,
        accountantDisplayName:
          chat.accountantUsername ||
          chat.assignedAccountantId ||
          '', // Empty string for unassigned
        slaStatus: chat.slaEnabled ? 'enabled' : 'disabled',
      })),
    [chats]
  );

  // Use table sort hook
  const { sortedData, requestSort, getSortIcon } = useTableSort<SortableChat>(
    sortableChats,
    'title',
    'asc'
  );

  // Reset to first page when filters change
  React.useEffect(() => {
    setPage(0);
  }, [filters]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddSuccess = () => {
    utils.chats.list.invalidate();
  };

  return (
    <AdminLayout>
      {/* Page Header */}
      <PageHeader
        title="Управление чатами"
        description="Просмотр и настройка чатов Telegram с клиентами"
        breadcrumbs={[
          { label: 'Панель управления', href: '/dashboard' },
          { label: 'Чаты' },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <HelpButton section="chats" />
            <Button
              onClick={() => setShowAddModal(true)}
              className={cn(
                'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
                'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]',
                'text-white hover:text-white'
              )}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить чат
            </Button>
          </div>
        }
      />

      {/* Filters Section */}
      <div className="mb-6 buh-animate-fade-in-up">
        <GlassCard variant="default" padding="md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Search / Filter Toggle */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  showFilters && 'bg-[var(--buh-primary-muted)] border-[var(--buh-primary)]'
                )}
              >
                <Filter className="mr-2 h-4 w-4" />
                Фильтры
                {(filters.assignedTo || filters.slaEnabled !== 'all') && (
                  <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--buh-accent)] text-xs text-white">
                    {[filters.assignedTo, filters.slaEnabled !== 'all'].filter(
                      Boolean
                    ).length}
                  </span>
                )}
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-4 text-sm text-[var(--buh-foreground-muted)]">
              <span>Всего чатов: <strong className="text-[var(--buh-foreground)]">{total}</strong></span>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[var(--buh-border)] grid gap-4 sm:grid-cols-2 lg:grid-cols-3 buh-animate-fade-in-up">
              {/* Assigned To Filter */}
              <div className="space-y-2">
                <Label className="text-[var(--buh-foreground-muted)] text-xs uppercase tracking-wide">
                  Ответственный
                </Label>
                <Input
                  value={filters.assignedTo}
                  onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
                  placeholder="ID бухгалтера"
                  className="bg-[var(--buh-surface)] border-[var(--buh-border)]"
                />
              </div>

              {/* SLA Enabled Filter */}
              <div className="space-y-2">
                <Label className="text-[var(--buh-foreground-muted)] text-xs uppercase tracking-wide">
                  SLA мониторинг
                </Label>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: 'Все' },
                    { value: 'true', label: 'Включен' },
                    { value: 'false', label: 'Выключен' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange('slaEnabled', option.value)}
                      className={cn(
                        'flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-all',
                        filters.slaEnabled === option.value
                          ? 'bg-[var(--buh-primary-muted)] border-[var(--buh-primary)] text-[var(--buh-primary)]'
                          : 'bg-[var(--buh-surface)] border-[var(--buh-border)] text-[var(--buh-foreground-muted)] hover:border-[var(--buh-foreground-subtle)]'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ assignedTo: '', slaEnabled: 'all' })}
                  className="text-[var(--buh-foreground-muted)]"
                >
                  <X className="mr-2 h-4 w-4" />
                  Сбросить
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Chats Table */}
      <div className="buh-animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <GlassCard variant="default" padding="none">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--buh-accent)]" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle className="h-12 w-12 text-[var(--buh-error)] mb-4" />
              <p className="text-[var(--buh-foreground)]">Ошибка загрузки данных</p>
              <p className="text-sm text-[var(--buh-foreground-muted)]">{error.message}</p>
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-[var(--buh-foreground-subtle)] mb-4" />
              <p className="text-[var(--buh-foreground)]">Чаты не найдены</p>
              <p className="text-sm text-[var(--buh-foreground-muted)]">
                Добавьте первый чат или измените фильтры
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--buh-border)] bg-[var(--buh-surface-overlay)]">
                    <SortableHeader
                      label="Название"
                      sortDirection={getSortIcon('title')}
                      onClick={() => requestSort('title')}
                    />
                    <SortableHeader
                      label="Тип"
                      sortDirection={getSortIcon('chatType')}
                      onClick={() => requestSort('chatType')}
                    />
                    <SortableHeader
                      label="Бухгалтер"
                      sortDirection={getSortIcon('accountantDisplayName')}
                      onClick={() => requestSort('accountantDisplayName')}
                    />
                    <SortableHeader
                      label="SLA"
                      sortDirection={getSortIcon('slaStatus')}
                      onClick={() => requestSort('slaStatus')}
                    />
                    <SortableHeader
                      label="Порог"
                      sortDirection={getSortIcon('slaResponseMinutes')}
                      onClick={() => requestSort('slaResponseMinutes')}
                    />
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--buh-border)]">
                  {sortedData.map((chat, index) => {
                    const TypeIcon = CHAT_TYPE_ICONS[chat.chatType] || MessageSquare;
                    return (
                      <tr
                        key={chat.id}
                        className="hover:bg-[var(--buh-surface-elevated)] transition-colors"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        {/* Title */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--buh-primary-muted)]">
                              <MessageSquare className="h-4 w-4 text-[var(--buh-primary)]" />
                            </div>
                            <div>
                              <Link
                                href={`/chats/${chat.id}`}
                                className="font-medium text-[var(--buh-foreground)] hover:text-[var(--buh-primary)] transition-colors"
                              >
                                {chat.title || `Чат #${chat.id}`}
                              </Link>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-[var(--buh-foreground-muted)]" />
                            <span className="text-sm text-[var(--buh-foreground-muted)]">
                              {CHAT_TYPE_LABELS[chat.chatType]}
                            </span>
                          </div>
                        </td>

                        {/* Accountant */}
                        <td className="px-4 py-4">
                          {chat.accountantUsername ? (
                            <span className="text-sm text-[var(--buh-foreground)]">
                              @{chat.accountantUsername}
                            </span>
                          ) : chat.assignedAccountantId ? (
                            <span className="text-sm text-[var(--buh-foreground-muted)]">
                              ID: {chat.assignedAccountantId}
                            </span>
                          ) : (
                            <span className="text-sm text-[var(--buh-foreground-subtle)] italic">
                              Не назначен
                            </span>
                          )}
                        </td>

                        {/* SLA Status */}
                        <td className="px-4 py-4">
                          {chat.slaEnabled ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-success)]/10 px-2.5 py-1 text-xs font-medium text-[var(--buh-success)]">
                              <CheckCircle className="h-3 w-3" />
                              Включен
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-foreground-subtle)]/10 px-2.5 py-1 text-xs font-medium text-[var(--buh-foreground-subtle)]">
                              <XCircle className="h-3 w-3" />
                              Выключен
                            </span>
                          )}
                        </td>

                        {/* SLA Threshold */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-4 w-4 text-[var(--buh-warning)]" />
                            <span className="text-[var(--buh-foreground)]">
                              {chat.slaResponseMinutes} мин
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4 text-right">
                          <Link
                            href={`/chats/${chat.id}`}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                              'bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground-muted)]',
                              'hover:bg-[var(--buh-primary-muted)] hover:text-[var(--buh-primary)]',
                              'transition-all duration-200'
                            )}
                          >
                            <Settings className="h-4 w-4" />
                            Настройки
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--buh-border)] px-4 py-3">
              <p className="text-sm text-[var(--buh-foreground-muted)]">
                Страница {page + 1} из {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Add Chat Modal */}
      <InvitationModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />
    </AdminLayout>
  );
}


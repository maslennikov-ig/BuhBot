'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
  Plus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Settings,
  Calendar,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type SurveyStatus = 'scheduled' | 'sending' | 'active' | 'closed' | 'expired';

// ============================================
// CONSTANTS
// ============================================

const POLLING_INTERVAL_MS = 30 * 1000; // 30 seconds

const statusConfig: Record<
  SurveyStatus,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  scheduled: {
    label: 'Запланирован',
    icon: Calendar,
    color: 'var(--buh-info)',
    bgColor: 'var(--buh-info-muted)',
  },
  sending: {
    label: 'Отправка',
    icon: Send,
    color: 'var(--buh-warning)',
    bgColor: 'var(--buh-warning-muted)',
  },
  active: {
    label: 'Активен',
    icon: CheckCircle2,
    color: 'var(--buh-success)',
    bgColor: 'var(--buh-success-muted)',
  },
  closed: {
    label: 'Закрыт',
    icon: XCircle,
    color: 'var(--buh-foreground-muted)',
    bgColor: 'var(--buh-surface-elevated)',
  },
  expired: {
    label: 'Истек',
    icon: AlertTriangle,
    color: 'var(--buh-error)',
    bgColor: 'var(--buh-error-muted)',
  },
};

const statusFilterOptions: { value: SurveyStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все статусы' },
  { value: 'scheduled', label: 'Запланированные' },
  { value: 'sending', label: 'Отправляются' },
  { value: 'active', label: 'Активные' },
  { value: 'closed', label: 'Закрытые' },
  { value: 'expired', label: 'Истекшие' },
];

// ============================================
// STATUS BADGE COMPONENT
// ============================================

function StatusBadge({ status }: { status: SurveyStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
    </div>
  );
}

// ============================================
// CREATE SURVEY MODAL
// ============================================

function CreateSurveyModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [quarter, setQuarter] = React.useState('');
  const [scheduledFor, setScheduledFor] = React.useState('');
  const [isImmediate, setIsImmediate] = React.useState(true);

  const createMutation = trpc.survey.create.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
      setQuarter('');
      setScheduledFor('');
      setIsImmediate(true);
    },
  });

  // Generate quarter options (current + next 3 quarters)
  const quarterOptions = React.useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

    for (let i = 0; i < 4; i++) {
      const q = ((currentQuarter - 1 + i) % 4) + 1;
      const y = currentYear + Math.floor((currentQuarter - 1 + i) / 4);
      options.push(`${y}-Q${q}`);
    }
    return options;
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quarter) return;

    createMutation.mutate({
      quarter,
      scheduledFor: isImmediate ? undefined : new Date(scheduledFor),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--buh-border)] bg-[var(--buh-surface)] p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-[var(--buh-foreground)]">
          Создать опрос
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quarter Select */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--buh-foreground)]">
              Квартал
            </label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className={cn(
                'h-10 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-background)] px-3 text-sm',
                'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]'
              )}
              required
            >
              <option value="">Выберите квартал</option>
              {quarterOptions.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          {/* Schedule Options */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--buh-foreground)]">
              Время запуска
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={isImmediate}
                  onChange={() => setIsImmediate(true)}
                  className="h-4 w-4 accent-[var(--buh-accent)]"
                />
                <span className="text-sm text-[var(--buh-foreground)]">
                  Запустить сразу
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!isImmediate}
                  onChange={() => setIsImmediate(false)}
                  className="h-4 w-4 accent-[var(--buh-accent)]"
                />
                <span className="text-sm text-[var(--buh-foreground)]">
                  Запланировать
                </span>
              </label>
            </div>
          </div>

          {/* Scheduled Date/Time */}
          {!isImmediate && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--buh-foreground)]">
                Дата и время запуска
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className={cn(
                  'h-10 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-background)] px-3 text-sm',
                  'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]'
                )}
                required={!isImmediate}
              />
            </div>
          )}

          {/* Error Message */}
          {createMutation.error && (
            <div className="rounded-lg bg-[var(--buh-error-muted)] p-3 text-sm text-[var(--buh-error)]">
              {createMutation.error.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'flex-1 rounded-lg border border-[var(--buh-border)] px-4 py-2 text-sm font-medium',
                'text-[var(--buh-foreground)] hover:bg-[var(--buh-surface-elevated)]',
                'transition-colors duration-200'
              )}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !quarter}
              className={cn(
                'flex-1 rounded-lg bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] px-4 py-2 text-sm font-medium text-white',
                'hover:opacity-90 transition-opacity duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {createMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Создание...
                </span>
              ) : (
                'Создать'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <>
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="h-9 w-64 animate-pulse rounded bg-[var(--buh-card-bg)]" />
        <div className="mt-2 h-5 w-96 animate-pulse rounded bg-[var(--buh-card-bg)]" />
      </div>

      {/* Table Skeleton */}
      <div className="h-[600px] animate-pulse rounded-lg border border-[var(--buh-border)] bg-[var(--buh-card-bg)]" />
    </>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SurveyListContent() {
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<SurveyStatus | 'all'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

  // Fetch surveys
  const {
    data: surveysData,
    isLoading,
    error,
    refetch,
  } = trpc.survey.list.useQuery(
    {
      page,
      pageSize: 20,
      status: statusFilter === 'all' ? undefined : statusFilter,
    },
    {
      refetchInterval: POLLING_INTERVAL_MS,
      refetchIntervalInBackground: false,
    }
  );

  // Format date helper
  const formatDate = (date: Date | string | null): string => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle filter change
  const handleStatusFilterChange = (newStatus: SurveyStatus | 'all') => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingSkeleton />
      </AdminLayout>
    );
  }

  const surveys = surveysData?.items ?? [];
  const pagination = surveysData?.pagination ?? {
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 1,
  };

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
            Управление опросами
          </h1>
          <p className="mt-2 text-[var(--buh-foreground-muted)]">
            Создание и управление квартальными опросами клиентов
            {error && (
              <span className="ml-2 text-sm text-[var(--buh-status-critical)]">
                (ошибка загрузки)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings/survey/settings"
            className={cn(
              'flex items-center gap-2 rounded-lg border border-[var(--buh-border)] px-4 py-2 text-sm font-medium',
              'text-[var(--buh-foreground)] hover:bg-[var(--buh-surface-elevated)]',
              'transition-colors duration-200'
            )}
          >
            <Settings className="h-4 w-4" />
            Настройки
          </Link>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className={cn(
              'flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] px-4 py-2 text-sm font-medium text-white',
              'hover:opacity-90 transition-opacity duration-200'
            )}
          >
            <Plus className="h-4 w-4" />
            Создать опрос
          </button>
        </div>
      </div>

      {/* Survey Table */}
      <GlassCard variant="elevated" padding="none" className="relative overflow-hidden group">
        {/* Gradient accent on hover */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Header with Filter */}
        <div className="flex items-center justify-between border-b border-[var(--buh-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
              <ClipboardList className="h-5 w-5 text-[var(--buh-primary)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--buh-foreground)]">
                Опросы
              </h3>
              <p className="text-xs text-[var(--buh-foreground-subtle)]">
                Всего: {pagination.totalItems}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg',
                'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]',
                'transition-colors duration-200'
              )}
              title="Обновить"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as SurveyStatus | 'all')}
              className={cn(
                'h-9 rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] px-3 text-sm',
                'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]'
              )}
            >
              {statusFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--buh-border)] bg-[var(--buh-surface-elevated)]/50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Квартал
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Создан
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Доставлено
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Ответов
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  % ответов
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--buh-border)]">
              {surveys.map((survey, index) => (
                <tr
                  key={survey.id}
                  className={cn(
                    'transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)]/50',
                    'buh-animate-fade-in-up'
                  )}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* Quarter */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="font-semibold text-[var(--buh-foreground)]">
                      {survey.quarter}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusBadge status={survey.status as SurveyStatus} />
                  </td>

                  {/* Created */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm text-[var(--buh-foreground-muted)]">
                      {formatDate(survey.scheduledAt)}
                    </span>
                  </td>

                  {/* Delivered */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm text-[var(--buh-foreground)]">
                      {survey.deliveredCount} / {survey.totalClients}
                    </span>
                  </td>

                  {/* Responses */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm text-[var(--buh-foreground)]">
                      {survey.responseCount}
                    </span>
                  </td>

                  {/* Response Rate */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        survey.responseRate >= 50
                          ? 'text-[var(--buh-success)]'
                          : survey.responseRate >= 25
                            ? 'text-[var(--buh-warning)]'
                            : 'text-[var(--buh-foreground-muted)]'
                      )}
                    >
                      {survey.responseRate.toFixed(1)}%
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <Link
                      href={`/settings/survey/${survey.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--buh-foreground-muted)] transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]"
                      title="Подробнее"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {surveys.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)]">
              <ClipboardList className="h-8 w-8 text-[var(--buh-foreground-subtle)]" />
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--buh-foreground)]">
              Нет опросов
            </p>
            <p className="mt-1 text-sm text-[var(--buh-foreground-subtle)]">
              Создайте первый опрос, чтобы начать сбор отзывов
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--buh-border)] px-6 py-4">
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Показано {(page - 1) * pagination.pageSize + 1} -{' '}
              {Math.min(page * pagination.pageSize, pagination.totalItems)} из{' '}
              {pagination.totalItems}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--buh-border)]',
                  'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors duration-200'
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-[var(--buh-foreground)]">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--buh-border)]',
                  'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors duration-200'
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Decorative glow */}
        <div className="absolute -bottom-20 right-1/4 h-40 w-40 rounded-full bg-[var(--buh-primary)] opacity-5 blur-3xl transition-opacity duration-500 group-hover:opacity-10" />
      </GlassCard>

      {/* Create Survey Modal */}
      <CreateSurveyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refetch()}
      />
    </AdminLayout>
  );
}

export default SurveyListContent;

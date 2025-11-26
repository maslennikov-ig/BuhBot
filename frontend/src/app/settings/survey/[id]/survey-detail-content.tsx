'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { StatCard } from '@/components/layout/StatCard';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Send,
  XCircle,
  Users,
  CheckCircle2,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Loader2,
  RefreshCw,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type SurveyStatus = 'scheduled' | 'sending' | 'active' | 'closed' | 'expired';
type DeliveryStatus = 'pending' | 'delivered' | 'reminded' | 'expired' | 'responded' | 'failed';

// ============================================
// CONSTANTS
// ============================================

const POLLING_INTERVAL_MS = 15 * 1000; // 15 seconds for detail page

const surveyStatusConfig: Record<
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

const deliveryStatusConfig: Record<
  DeliveryStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: {
    label: 'Ожидает',
    color: 'var(--buh-warning)',
    bgColor: 'var(--buh-warning-muted)',
  },
  delivered: {
    label: 'Доставлен',
    color: 'var(--buh-info)',
    bgColor: 'var(--buh-info-muted)',
  },
  reminded: {
    label: 'Напомнен',
    color: 'var(--buh-info)',
    bgColor: 'var(--buh-info-muted)',
  },
  responded: {
    label: 'Ответил',
    color: 'var(--buh-success)',
    bgColor: 'var(--buh-success-muted)',
  },
  expired: {
    label: 'Истек',
    color: 'var(--buh-error)',
    bgColor: 'var(--buh-error-muted)',
  },
  failed: {
    label: 'Ошибка',
    color: 'var(--buh-error)',
    bgColor: 'var(--buh-error-muted)',
  },
};

const deliveryStatusFilterOptions: { value: DeliveryStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все статусы' },
  { value: 'pending', label: 'Ожидают' },
  { value: 'delivered', label: 'Доставлены' },
  { value: 'reminded', label: 'Напомнены' },
  { value: 'responded', label: 'Ответили' },
  { value: 'expired', label: 'Истекли' },
  { value: 'failed', label: 'Ошибки' },
];

// ============================================
// STATUS BADGE COMPONENTS
// ============================================

function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  const config = surveyStatusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      <Icon className="h-4 w-4" />
      <span>{config.label}</span>
    </div>
  );
}

function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const config = deliveryStatusConfig[status];

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      <span>{config.label}</span>
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
        <div className="h-6 w-32 animate-pulse rounded bg-[var(--buh-card-bg)]" />
        <div className="mt-4 h-9 w-64 animate-pulse rounded bg-[var(--buh-card-bg)]" />
        <div className="mt-2 h-5 w-96 animate-pulse rounded bg-[var(--buh-card-bg)]" />
      </div>

      {/* Stats Skeleton */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lg border border-[var(--buh-border)] bg-[var(--buh-card-bg)]"
          />
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="h-[500px] animate-pulse rounded-lg border border-[var(--buh-border)] bg-[var(--buh-card-bg)]" />
    </>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SurveyDetailContent({ surveyId }: { surveyId: string }) {
  const [deliveryPage, setDeliveryPage] = React.useState(1);
  const [deliveryStatusFilter, setDeliveryStatusFilter] = React.useState<DeliveryStatus | 'all'>('all');

  // Fetch survey details
  const {
    data: surveyData,
    isLoading: surveyLoading,
    error: surveyError,
    refetch: refetchSurvey,
  } = trpc.survey.getById.useQuery(
    { id: surveyId },
    {
      refetchInterval: POLLING_INTERVAL_MS,
      refetchIntervalInBackground: false,
    }
  );

  // Fetch deliveries
  const {
    data: deliveriesData,
    isLoading: deliveriesLoading,
    refetch: refetchDeliveries,
  } = trpc.survey.getDeliveries.useQuery(
    {
      surveyId,
      page: deliveryPage,
      pageSize: 20,
      status: deliveryStatusFilter === 'all' ? undefined : deliveryStatusFilter,
    },
    {
      refetchInterval: POLLING_INTERVAL_MS,
      refetchIntervalInBackground: false,
    }
  );

  // Mutations
  const sendNowMutation = trpc.survey.sendNow.useMutation({
    onSuccess: () => {
      refetchSurvey();
      refetchDeliveries();
    },
  });

  const closeMutation = trpc.survey.close.useMutation({
    onSuccess: () => {
      refetchSurvey();
      refetchDeliveries();
    },
  });

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

  // Handlers
  const handleSendNow = () => {
    if (confirm('Начать отправку опроса сейчас?')) {
      sendNowMutation.mutate({ id: surveyId });
    }
  };

  const handleClose = () => {
    if (confirm('Закрыть опрос? Это остановит сбор ответов.')) {
      closeMutation.mutate({ id: surveyId });
    }
  };

  const handleDeliveryFilterChange = (newStatus: DeliveryStatus | 'all') => {
    setDeliveryStatusFilter(newStatus);
    setDeliveryPage(1);
  };

  if (surveyLoading) {
    return (
      <AdminLayout>
        <LoadingSkeleton />
      </AdminLayout>
    );
  }

  if (surveyError || !surveyData) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="h-16 w-16 text-[var(--buh-error)]" />
          <h2 className="mt-4 text-xl font-semibold text-[var(--buh-foreground)]">
            Опрос не найден
          </h2>
          <p className="mt-2 text-[var(--buh-foreground-muted)]">
            {surveyError?.message || 'Не удалось загрузить данные опроса'}
          </p>
          <Link
            href="/settings/survey"
            className="mt-6 flex items-center gap-2 text-[var(--buh-primary)] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться к списку
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const deliveries = deliveriesData?.items ?? [];
  const deliveryPagination = deliveriesData?.pagination ?? {
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 1,
  };

  const canSendNow = surveyData.status === 'scheduled';
  const canClose = ['active', 'sending'].includes(surveyData.status);

  return (
    <AdminLayout>
      {/* Back Link */}
      <Link
        href="/settings/survey"
        className="mb-4 inline-flex items-center gap-2 text-sm text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к списку опросов
      </Link>

      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
              Опрос {surveyData.quarter}
            </h1>
            <SurveyStatusBadge status={surveyData.status as SurveyStatus} />
          </div>
          <p className="mt-2 text-[var(--buh-foreground-muted)]">
            Создан: {formatDate(surveyData.createdAt)}
            {surveyData.closedAt && ` | Закрыт: ${formatDate(surveyData.closedAt)}`}
            {surveyData.closedBy && ` (${surveyData.closedBy.fullName})`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canSendNow && (
            <button
              onClick={handleSendNow}
              disabled={sendNowMutation.isPending}
              className={cn(
                'flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] px-4 py-2 text-sm font-medium text-white',
                'hover:opacity-90 transition-opacity duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {sendNowMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Отправить сейчас
            </button>
          )}
          {canClose && (
            <button
              onClick={handleClose}
              disabled={closeMutation.isPending}
              className={cn(
                'flex items-center gap-2 rounded-lg border border-[var(--buh-error)] px-4 py-2 text-sm font-medium',
                'text-[var(--buh-error)] hover:bg-[var(--buh-error-muted)]',
                'transition-colors duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {closeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Закрыть опрос
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Всего доставок"
          value={surveyData.deliveryStats.total}
          icon={<Users className="h-6 w-6" />}
          change={
            surveyData.deliveryStats.pending > 0
              ? { value: surveyData.deliveryStats.pending, label: 'ожидают', type: 'neutral' }
              : undefined
          }
        />
        <StatCard
          title="Доставлено"
          value={surveyData.deliveredCount}
          icon={<CheckCircle2 className="h-6 w-6" />}
          change={
            surveyData.deliveryStats.failed > 0
              ? { value: surveyData.deliveryStats.failed, label: 'ошибок', type: 'decrease' }
              : undefined
          }
        />
        <StatCard
          title="Ответили"
          value={surveyData.responseCount}
          icon={<MessageSquare className="h-6 w-6" />}
        />
        <StatCard
          title="Процент ответов"
          value={`${surveyData.responseRate.toFixed(1)}%`}
          icon={<TrendingUp className="h-6 w-6" />}
          change={
            surveyData.averageRating
              ? { value: Math.round(surveyData.averageRating * 10), label: 'ср. оценка', type: surveyData.averageRating >= 4 ? 'increase' : 'neutral' }
              : undefined
          }
        />
      </div>

      {/* Deliveries Table */}
      <GlassCard variant="elevated" padding="none" className="relative overflow-hidden group">
        {/* Gradient accent on hover */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Header with Filter */}
        <div className="flex items-center justify-between border-b border-[var(--buh-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
              <Users className="h-5 w-5 text-[var(--buh-primary)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--buh-foreground)]">
                Доставки
              </h3>
              <p className="text-xs text-[var(--buh-foreground-subtle)]">
                Всего: {deliveryPagination.totalItems}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                refetchSurvey();
                refetchDeliveries();
              }}
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
              value={deliveryStatusFilter}
              onChange={(e) => handleDeliveryFilterChange(e.target.value as DeliveryStatus | 'all')}
              className={cn(
                'h-9 rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] px-3 text-sm',
                'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]'
              )}
            >
              {deliveryStatusFilterOptions.map((opt) => (
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
                  Чат
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Бухгалтер
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Доставлен
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Напоминание
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Попытки
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--buh-border)]">
              {deliveriesLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-[var(--buh-foreground-muted)]">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Загрузка...
                    </div>
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery, index) => (
                  <tr
                    key={delivery.id}
                    className={cn(
                      'transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)]/50',
                      'buh-animate-fade-in-up'
                    )}
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    {/* Chat */}
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="font-medium text-[var(--buh-foreground)]">
                        {delivery.chatTitle || `Chat #${delivery.chatId}`}
                      </span>
                    </td>

                    {/* Accountant */}
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="text-sm text-[var(--buh-foreground-muted)]">
                        {delivery.accountantName || delivery.accountantUsername || '-'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="whitespace-nowrap px-6 py-4">
                      <DeliveryStatusBadge status={delivery.status as DeliveryStatus} />
                      {delivery.errorMessage && (
                        <p className="mt-1 text-xs text-[var(--buh-error)]" title={delivery.errorMessage}>
                          {delivery.errorMessage.length > 30
                            ? `${delivery.errorMessage.slice(0, 30)}...`
                            : delivery.errorMessage}
                        </p>
                      )}
                    </td>

                    {/* Delivered At */}
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="text-sm text-[var(--buh-foreground-muted)]">
                        {formatDate(delivery.deliveredAt)}
                      </span>
                    </td>

                    {/* Reminder Sent At */}
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="text-sm text-[var(--buh-foreground-muted)]">
                        {formatDate(delivery.reminderSentAt)}
                      </span>
                    </td>

                    {/* Retry Count */}
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={cn(
                          'text-sm',
                          delivery.retryCount > 0
                            ? 'text-[var(--buh-warning)]'
                            : 'text-[var(--buh-foreground-muted)]'
                        )}
                      >
                        {delivery.retryCount}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {!deliveriesLoading && deliveries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)]">
              <Users className="h-8 w-8 text-[var(--buh-foreground-subtle)]" />
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--buh-foreground)]">
              Нет доставок
            </p>
            <p className="mt-1 text-sm text-[var(--buh-foreground-subtle)]">
              {deliveryStatusFilter !== 'all'
                ? 'Попробуйте изменить фильтр'
                : 'Опрос еще не был отправлен'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {deliveryPagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--buh-border)] px-6 py-4">
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Показано {(deliveryPage - 1) * deliveryPagination.pageSize + 1} -{' '}
              {Math.min(deliveryPage * deliveryPagination.pageSize, deliveryPagination.totalItems)} из{' '}
              {deliveryPagination.totalItems}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDeliveryPage((p) => Math.max(1, p - 1))}
                disabled={deliveryPage === 1}
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
                {deliveryPage} / {deliveryPagination.totalPages}
              </span>
              <button
                onClick={() => setDeliveryPage((p) => Math.min(deliveryPagination.totalPages, p + 1))}
                disabled={deliveryPage === deliveryPagination.totalPages}
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

      {/* Mutation Error Display */}
      {(sendNowMutation.error || closeMutation.error) && (
        <div className="mt-4 rounded-lg bg-[var(--buh-error-muted)] p-4 text-sm text-[var(--buh-error)]">
          {sendNowMutation.error?.message || closeMutation.error?.message}
        </div>
      )}
    </AdminLayout>
  );
}

export default SurveyDetailContent;

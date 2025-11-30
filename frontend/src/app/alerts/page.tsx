'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/layout/GlassCard';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  CheckSquare,
  Loader2,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';
import { cn } from '@/lib/utils';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type AlertItem = RouterOutputs['alert']['getAlerts']['items'][number];

// Helper for date formatting
const formatDate = (date: Date | string) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
};

// Type for flattened alert data (for sorting)
type FlattenedAlert = {
  id: string;
  alertType: string;
  resolvedAction: string | null;
  alertSentAt: Date;
  minutesElapsed: number;
  clientUsername: string;
  chatTitle: string;
  messagePreview: string;
  accountantName: string;
  resolutionNotes: string | null;
  original: AlertItem;
};

// Resolve Dialog Component
function ResolveAlertDialog({
  open,
  onClose,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  isLoading: boolean;
}) {
  const [notes, setNotes] = React.useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md buh-animate-fade-in-up">
        <GlassCard variant="elevated" padding="lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--buh-success-muted)]">
                <CheckSquare className="h-5 w-5 text-[var(--buh-success)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--buh-foreground)]">
                  Разрешить алерт
                </h2>
                <p className="text-sm text-[var(--buh-foreground-muted)]">
                  Отметить как обработанный
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--buh-foreground)]">
                Комментарий (опционально)
              </label>
              <Textarea
                placeholder="Укажите причину или принятые меры..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-[var(--buh-surface)] border-[var(--buh-border)]"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button
              onClick={() => onConfirm(notes)}
              disabled={isLoading}
              className={cn(
                'flex-1',
                'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
                'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Разрешить'
              )}
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [page, setPage] = React.useState(0);
  const [statusFilter, setStatusFilter] = React.useState<'active' | 'resolved' | 'all'>('active');
  const [typeFilter, setTypeFilter] = React.useState<'all' | 'warning' | 'breach'>('all');
  const [resolveDialogOpen, setResolveDialogOpen] = React.useState(false);
  const [selectedAlertId, setSelectedAlertId] = React.useState<string | null>(null);
  const [showFilters, setShowFilters] = React.useState(false);

  const statsQuery = trpc.alert.getAlertStats.useQuery({});

  const alertsQuery = trpc.alert.getAlerts.useQuery({
    limit: 20,
    offset: page * 20,
    resolved: statusFilter === 'all' ? undefined : statusFilter === 'resolved',
    alertType: typeFilter === 'all' ? undefined : typeFilter,
  });

  const utils = trpc.useContext();
  const resolveMutation = trpc.alert.resolveAlert.useMutation({
    onSuccess: () => {
      toast.success('Алерт успешно разрешен');
      setResolveDialogOpen(false);
      setSelectedAlertId(null);
      utils.alert.getAlerts.invalidate();
      utils.alert.getAlertStats.invalidate();
      utils.alert.getActiveAlertCount.invalidate();
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleResolveClick = (id: string) => {
    setSelectedAlertId(id);
    setResolveDialogOpen(true);
  };

  const handleConfirmResolve = (notes: string) => {
    if (!selectedAlertId) return;
    resolveMutation.mutate({
      alertId: selectedAlertId,
      action: 'mark_resolved',
      resolutionNotes: notes,
    });
  };

  const stats = statsQuery.data;

  // Calculate quick stats from actual data (not just today's)
  const quickStats = React.useMemo(() => {
    const items = alertsQuery.data?.items ?? [];
    const total = alertsQuery.data?.total ?? 0;
    return {
      active: items.filter((a) => !a.resolvedAction).length,
      breaches: items.filter((a) => a.alertType === 'breach' && !a.resolvedAction).length,
      resolved: items.filter((a) => a.resolvedAction !== null).length,
      // For total counts, use the query total if we're showing all statuses
      totalActive: statusFilter === 'active' ? total : items.filter((a) => !a.resolvedAction).length,
    };
  }, [alertsQuery.data?.items, alertsQuery.data?.total, statusFilter]);

  const flattenedAlerts = React.useMemo<FlattenedAlert[]>(() => {
    if (!alertsQuery.data?.items) return [];
    return alertsQuery.data.items.map((alert) => ({
      id: alert.id,
      alertType: alert.alertType,
      resolvedAction: alert.resolvedAction,
      alertSentAt: new Date(alert.alertSentAt),
      minutesElapsed: alert.minutesElapsed,
      clientUsername: alert.request?.clientUsername || 'Неизвестный',
      chatTitle: alert.request?.chatTitle || 'Без названия',
      messagePreview: alert.request?.messagePreview || '-',
      accountantName: alert.request?.accountantName || '',
      resolutionNotes: alert.resolutionNotes,
      original: alert,
    }));
  }, [alertsQuery.data]);

  const { sortedData: sortedAlerts, requestSort, getSortIcon } = useTableSort(
    flattenedAlerts,
    'alertSentAt',
    'desc'
  );

  const activeFiltersCount = [
    statusFilter !== 'active',
    typeFilter !== 'all',
  ].filter(Boolean).length;

  return (
    <AdminLayout>
      {/* Page Header */}
      <PageHeader
        title="Алерты SLA"
        description="Управление нарушениями SLA и предупреждениями"
        breadcrumbs={[
          { label: 'Панель управления', href: '/dashboard' },
          { label: 'Алерты SLA' },
        ]}
      />

      {/* Filters Section */}
      <div className="mb-6 buh-animate-fade-in-up">
        <GlassCard variant="default" padding="md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                {activeFiltersCount > 0 && (
                  <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--buh-accent)] text-xs text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-6 text-sm text-[var(--buh-foreground-muted)]">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[var(--buh-error)]" />
                <span>
                  Активных: <strong className="text-[var(--buh-foreground)]">{quickStats.totalActive}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--buh-warning)]" />
                <span>
                  Нарушений: <strong className="text-[var(--buh-foreground)]">{quickStats.breaches}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[var(--buh-success)]" />
                <span>
                  Разрешено: <strong className="text-[var(--buh-foreground)]">{quickStats.resolved}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--buh-primary)]" />
                <span>
                  Среднее время: <strong className="text-[var(--buh-foreground)]">{stats?.week.avgResolutionMinutes ?? 0} мин</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[var(--buh-border)] grid gap-4 sm:grid-cols-3 buh-animate-fade-in-up">
              <div className="space-y-2">
                <label className="text-[var(--buh-foreground-muted)] text-xs uppercase tracking-wide">
                  Статус
                </label>
                <Select
                  value={statusFilter}
                  onValueChange={(v: 'active' | 'resolved' | 'all') => setStatusFilter(v)}
                >
                  <SelectTrigger className="bg-[var(--buh-surface)] border-[var(--buh-border)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Активные</SelectItem>
                    <SelectItem value="resolved">Разрешенные</SelectItem>
                    <SelectItem value="all">Все</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[var(--buh-foreground-muted)] text-xs uppercase tracking-wide">
                  Тип
                </label>
                <Select
                  value={typeFilter}
                  onValueChange={(v: 'all' | 'warning' | 'breach') => setTypeFilter(v)}
                >
                  <SelectTrigger className="bg-[var(--buh-surface)] border-[var(--buh-border)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все типы</SelectItem>
                    <SelectItem value="warning">Предупреждения</SelectItem>
                    <SelectItem value="breach">Нарушения</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('active');
                    setTypeFilter('all');
                  }}
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

      {/* Alerts Table */}
      <div className="buh-animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <GlassCard variant="default" padding="none">
          {alertsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--buh-accent)]" />
            </div>
          ) : sortedAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-[var(--buh-foreground-subtle)] mb-4" />
              <p className="text-[var(--buh-foreground)]">Алертов не найдено</p>
              <p className="text-sm text-[var(--buh-foreground-muted)]">
                Измените фильтры или дождитесь новых уведомлений
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--buh-border)] bg-[var(--buh-surface-overlay)]">
                    <SortableHeader
                      label="Статус"
                      sortDirection={getSortIcon('alertType')}
                      onClick={() => requestSort('alertType')}
                    />
                    <SortableHeader
                      label="Клиент"
                      sortDirection={getSortIcon('clientUsername')}
                      onClick={() => requestSort('clientUsername')}
                    />
                    <SortableHeader
                      label="Сообщение"
                      sortDirection={getSortIcon('messagePreview')}
                      onClick={() => requestSort('messagePreview')}
                    />
                    <SortableHeader
                      label="Время"
                      sortDirection={getSortIcon('alertSentAt')}
                      onClick={() => requestSort('alertSentAt')}
                    />
                    <SortableHeader
                      label="Ответственный"
                      sortDirection={getSortIcon('accountantName')}
                      onClick={() => requestSort('accountantName')}
                    />
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--buh-border)]">
                  {sortedAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="hover:bg-[var(--buh-surface-elevated)] transition-colors"
                    >
                      <td className="px-4 py-4">
                        {alert.resolvedAction ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-success)]/10 px-2.5 py-1 text-xs font-medium text-[var(--buh-success)]">
                            <CheckCircle className="h-3 w-3" />
                            Разрешен
                          </span>
                        ) : alert.alertType === 'breach' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-error)]/10 px-2.5 py-1 text-xs font-medium text-[var(--buh-error)]">
                            <AlertCircle className="h-3 w-3" />
                            Нарушение
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-warning)]/10 px-2.5 py-1 text-xs font-medium text-[var(--buh-warning)]">
                            <AlertTriangle className="h-3 w-3" />
                            Внимание
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-[var(--buh-foreground)]">
                          {alert.clientUsername}
                        </div>
                        <div className="text-xs text-[var(--buh-foreground-muted)] truncate max-w-[150px]">
                          {alert.chatTitle}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div
                          className="truncate max-w-[300px] text-[var(--buh-foreground-muted)]"
                          title={alert.messagePreview}
                        >
                          {alert.messagePreview}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-[var(--buh-foreground)]">
                          {formatDate(alert.alertSentAt)}
                        </div>
                        <div className="text-xs text-[var(--buh-foreground-subtle)]">
                          +{formatDuration(alert.minutesElapsed)}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {alert.accountantName ? (
                          <span className="text-[var(--buh-foreground)]">
                            {alert.accountantName}
                          </span>
                        ) : (
                          <span className="text-[var(--buh-foreground-subtle)] italic">
                            Не назначен
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        {!alert.resolvedAction ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolveClick(alert.id)}
                          >
                            Разрешить
                          </Button>
                        ) : (
                          <span className="text-xs text-[var(--buh-foreground-subtle)]">
                            {alert.resolutionNotes || 'Без примечаний'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {sortedAlerts.length > 0 && (
            <div className="flex items-center justify-between border-t border-[var(--buh-border)] px-4 py-3">
              <p className="text-sm text-[var(--buh-foreground-muted)]">
                Страница {page + 1}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || alertsQuery.isLoading}
                >
                  Назад
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!alertsQuery.data?.hasMore || alertsQuery.isLoading}
                >
                  Вперед
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      <ResolveAlertDialog
        open={resolveDialogOpen}
        onClose={() => setResolveDialogOpen(false)}
        onConfirm={handleConfirmResolve}
        isLoading={resolveMutation.isPending}
      />
    </AdminLayout>
  );
}

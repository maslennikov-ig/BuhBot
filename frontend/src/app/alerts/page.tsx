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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <GlassCard variant="elevated" padding="lg" className="w-full max-w-md relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--buh-success)]/10 text-[var(--buh-success)]">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">Разрешить алерт</h2>
            <p className="text-sm text-[var(--buh-foreground-muted)] mt-1">
              Вы уверены, что хотите отметить этот алерт как разрешенный?
            </p>
          </div>
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

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button
            onClick={() => onConfirm(notes)}
            disabled={isLoading}
            className={cn(
              'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
              'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]'
            )}
          >
            {isLoading ? 'Сохранение...' : 'Разрешить'}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <GlassCard variant="elevated" padding="md" className="relative overflow-hidden group">
      {/* Gradient accent on hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--buh-foreground-muted)]">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">{value}</p>
          <p className="text-xs text-[var(--buh-foreground-subtle)]">{subtitle}</p>
        </div>
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl',
          iconColor
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {/* Decorative glow */}
      <div className="absolute -bottom-16 -right-16 h-32 w-32 rounded-full bg-[var(--buh-primary)] opacity-5 blur-3xl" />
    </GlassCard>
  );
}

export default function AlertsPage() {
  // State
  const [page, setPage] = React.useState(0);
  const [statusFilter, setStatusFilter] = React.useState<'active' | 'resolved' | 'all'>('active');
  const [typeFilter, setTypeFilter] = React.useState<'all' | 'warning' | 'breach'>('all');
  const [resolveDialogOpen, setResolveDialogOpen] = React.useState(false);
  const [selectedAlertId, setSelectedAlertId] = React.useState<string | null>(null);

  // Queries
  const statsQuery = trpc.alert.getAlertStats.useQuery({});

  const alertsQuery = trpc.alert.getAlerts.useQuery({
    limit: 20,
    offset: page * 20,
    resolved: statusFilter === 'all' ? undefined : statusFilter === 'resolved',
    alertType: typeFilter === 'all' ? undefined : typeFilter,
  });

  // Mutations
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

  // Stats data
  const stats = statsQuery.data;

  // Flatten alert data for sorting
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
  }, [alertsQuery.data?.items]);

  // Sorting
  const { sortedData: sortedAlerts, requestSort, getSortIcon } = useTableSort(
    flattenedAlerts,
    'alertSentAt',
    'desc'
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Алерты SLA"
          description="Управление нарушениями SLA и предупреждениями"
          breadcrumbs={[
            { label: 'Панель управления', href: '/dashboard' },
            { label: 'Алерты SLA' },
          ]}
        />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 buh-animate-fade-in-up">
          <StatCard
            title="Активные алерты"
            value={stats?.today.pending ?? 0}
            subtitle={`${stats?.today.total ?? 0} всего за сегодня`}
            icon={AlertCircle}
            iconColor="bg-[var(--buh-error)]/10 text-[var(--buh-error)]"
          />
          <StatCard
            title="Нарушения (Сегодня)"
            value={stats?.today.breaches ?? 0}
            subtitle="Критических нарушений"
            icon={AlertTriangle}
            iconColor="bg-[var(--buh-warning)]/10 text-[var(--buh-warning)]"
          />
          <StatCard
            title="Разрешено (Сегодня)"
            value={stats?.today.resolved ?? 0}
            subtitle="Обработано операторами"
            icon={CheckCircle}
            iconColor="bg-[var(--buh-success)]/10 text-[var(--buh-success)]"
          />
          <StatCard
            title="Среднее время реакции"
            value={`${stats?.week.avgResolutionMinutes ?? 0} мин`}
            subtitle="За последние 7 дней"
            icon={Clock}
            iconColor="bg-[var(--buh-primary)]/10 text-[var(--buh-primary)]"
          />
        </div>

        {/* Filters & List */}
        <div className="buh-animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <GlassCard variant="default" padding="none">
            {/* Header with filters */}
            <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center p-4 border-b border-[var(--buh-border)]">
              <h2 className="text-lg font-semibold text-[var(--buh-foreground)]">
                Список алертов
              </h2>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(v: 'active' | 'resolved' | 'all') => setStatusFilter(v)}
                >
                  <SelectTrigger className="w-[160px] bg-[var(--buh-surface)] border-[var(--buh-border)]">
                    <SelectValue placeholder="Статус" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Активные</SelectItem>
                    <SelectItem value="resolved">Разрешенные</SelectItem>
                    <SelectItem value="all">Все</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={typeFilter}
                  onValueChange={(v: 'all' | 'warning' | 'breach') => setTypeFilter(v)}
                >
                  <SelectTrigger className="w-[160px] bg-[var(--buh-surface)] border-[var(--buh-border)]">
                    <SelectValue placeholder="Тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все типы</SelectItem>
                    <SelectItem value="warning">Предупреждения</SelectItem>
                    <SelectItem value="breach">Нарушения</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table content */}
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
                    {sortedAlerts.map((alert, index) => (
                      <tr
                        key={alert.id}
                        className="hover:bg-[var(--buh-surface-elevated)] transition-colors"
                        style={{ animationDelay: `${index * 0.03}s` }}
                      >
                        {/* Status */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
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
                          </div>
                        </td>

                        {/* Client */}
                        <td className="px-4 py-4">
                          <div className="font-medium text-[var(--buh-foreground)]">
                            {alert.clientUsername}
                          </div>
                          <div className="text-xs text-[var(--buh-foreground-muted)] truncate max-w-[150px]">
                            {alert.chatTitle}
                          </div>
                        </td>

                        {/* Message */}
                        <td className="px-4 py-4">
                          <div
                            className="truncate max-w-[300px] text-[var(--buh-foreground-muted)]"
                            title={alert.messagePreview}
                          >
                            {alert.messagePreview}
                          </div>
                        </td>

                        {/* Time */}
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-[var(--buh-foreground)]">
                              {formatDate(alert.alertSentAt)}
                            </span>
                            <span className="text-xs text-[var(--buh-foreground-subtle)]">
                              +{formatDuration(alert.minutesElapsed)}
                            </span>
                          </div>
                        </td>

                        {/* Accountant */}
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

                        {/* Actions */}
                        <td className="px-4 py-4 text-right">
                          {!alert.resolvedAction ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResolveClick(alert.id)}
                              className="border-[var(--buh-border)] hover:bg-[var(--buh-surface-elevated)]"
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
                    className="border-[var(--buh-border)]"
                  >
                    Назад
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!alertsQuery.data?.hasMore || alertsQuery.isLoading}
                    className="border-[var(--buh-border)]"
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
      </div>
    </AdminLayout>
  );
}

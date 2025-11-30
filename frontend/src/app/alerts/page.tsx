'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { GlassCard } from '@/components/layout/GlassCard';
import { Textarea } from '@/components/ui/textarea';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

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
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
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
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Комментарий (опционально)
            </label>
            <Textarea
              placeholder="Укажите причину или принятые меры..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button onClick={() => onConfirm(notes)} disabled={isLoading}>
            {isLoading ? 'Сохранение...' : 'Разрешить'}
          </Button>
        </div>
      </GlassCard>
    </div>
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
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
            Алерты SLA
          </h1>
          <p className="text-[var(--buh-foreground-muted)] mt-2">
            Управление нарушениями SLA и предупреждениями
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Активные алерты</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.today.pending ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.today.total ?? 0} всего за сегодня
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Нарушения (Сегодня)</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.today.breaches ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Критических нарушений
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Разрешено (Сегодня)</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.today.resolved ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Обработано операторами
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Среднее время реакции</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.week.avgResolutionMinutes ?? 0} мин
              </div>
              <p className="text-xs text-muted-foreground">
                За последние 7 дней
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters & List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
              <CardTitle>Список алертов</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(v: any) => setStatusFilter(v)}
                >
                  <SelectTrigger className="w-[180px]">
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
                  onValueChange={(v: any) => setTypeFilter(v)}
                >
                  <SelectTrigger className="w-[180px]">
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
          </CardHeader>
          <CardContent>
            {alertsQuery.isLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : sortedAlerts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Алертов не найдено
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                      <tr className="border-b transition-colors">
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
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {sortedAlerts.map((alert) => (
                        <tr
                          key={alert.id}
                          className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                        >
                          <td className="p-4 align-middle">
                            <div className="flex items-center gap-2">
                              {alert.resolvedAction ? (
                                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-green-100 text-green-800 hover:bg-green-200">
                                  Разрешен
                                </span>
                              ) : alert.alertType === 'breach' ? (
                                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-red-100 text-red-800 hover:bg-red-200">
                                  Нарушение
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                                  Внимание
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="font-medium">{alert.clientUsername}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {alert.chatTitle}
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="truncate max-w-[300px]" title={alert.messagePreview}>
                              {alert.messagePreview}
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {formatDate(alert.alertSentAt)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                +{formatDuration(alert.minutesElapsed)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            {alert.accountantName || (
                              <span className="text-muted-foreground italic">Не назначен</span>
                            )}
                          </td>
                          <td className="p-4 align-middle text-right">
                            {!alert.resolvedAction && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResolveClick(alert.id)}
                              >
                                Разрешить
                              </Button>
                            )}
                            {alert.resolvedAction && (
                              <span className="text-xs text-muted-foreground">
                                {alert.resolutionNotes || 'Без примечаний'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="flex items-center justify-end space-x-2 py-4 px-4">
                   <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || alertsQuery.isLoading}
                  >
                    Назад
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Стр. {page + 1}
                  </div>
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
          </CardContent>
        </Card>

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

'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/layout/GlassCard';
import { StatCard } from '@/components/layout/StatCard';
import { trpc } from '@/lib/trpc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  X,
  Loader2,
  User,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { RadialBar, RadialBarChart, PolarAngleAxis } from 'recharts';

// ============================================
// TYPES
// ============================================

type SlaRequest = {
  id: string;
  chatTitle: string;
  clientUsername: string;
  messagePreview: string;
  receivedAt: Date;
  respondedAt: Date | null;
  responseMinutes: number | null;
  slaBreached: boolean;
  accountantName: string;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDate = (date: Date | string) => {
  if (!date) return '-';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

const formatDuration = (minutes: number | null) => {
  if (minutes === null) return '-';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
};

// ============================================
// CHART CONFIG
// ============================================

const chartConfig = {
  compliant: {
    label: 'В норме',
    color: 'var(--buh-success)',
  },
  violated: {
    label: 'Нарушено',
    color: 'var(--buh-error)',
  },
};

// ============================================
// SLA PAGE COMPONENT
// ============================================

export default function SlaPage() {
  const [showFilters, setShowFilters] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'compliant' | 'breached'>('all');
  const [page, setPage] = React.useState(0);

  // Date range (last 7 days by default)
  const [dateRange] = React.useState(() => ({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  }));

  // Fetch SLA compliance stats
  const statsQuery = trpc.analytics.slaCompliance.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  // Fetch requests with filters
  const requestsQuery = trpc.sla.getRequests.useQuery({
    slaBreached: statusFilter === 'all' ? undefined : statusFilter === 'breached',
    dateFrom: dateRange.startDate,
    dateTo: dateRange.endDate,
    limit: 20,
    offset: page * 20,
  });

  const stats = statsQuery.data;
  const hasMore = requestsQuery.data?.hasMore ?? false;

  // Chart data for radial compliance chart
  const chartData = React.useMemo(() => {
    if (!stats) return [];
    const compliancePercent = stats.compliancePercentage;
    return [
      {
        name: 'compliance',
        value: compliancePercent,
        fill: compliancePercent >= 90 ? 'var(--buh-success)' : compliancePercent >= 70 ? 'var(--buh-warning)' : 'var(--buh-error)',
      },
    ];
  }, [stats]);

  // Transform requests for sorting
  const sortableRequests = React.useMemo<SlaRequest[]>(() => {
    const requests = requestsQuery.data?.items ?? [];
    return requests.map((req) => {
      // Create preview from messageText (max 100 chars)
      const messagePreview = req.messageText.length > 100
        ? `${req.messageText.substring(0, 100)}...`
        : req.messageText;

      return {
        id: req.id,
        chatTitle: req.chatTitle || 'Без названия',
        clientUsername: req.clientUsername || 'Неизвестный',
        messagePreview,
        receivedAt: new Date(req.receivedAt),
        respondedAt: req.responseAt ? new Date(req.responseAt) : null,
        responseMinutes: req.responseTimeMinutes,
        slaBreached: req.slaBreached,
        accountantName: req.assignedAccountantName || 'Не назначен',
      };
    });
  }, [requestsQuery.data]);

  const { sortedData, requestSort, getSortIcon } = useTableSort<SlaRequest>(
    sortableRequests,
    'receivedAt',
    'desc'
  );

  const activeFiltersCount = statusFilter !== 'all' ? 1 : 0;

  return (
    <AdminLayout>
      {/* Page Header */}
      <PageHeader
        title="SLA Мониторинг"
        description="Детальная статистика по соблюдению SLA"
        breadcrumbs={[
          { label: 'Панель управления', href: '/dashboard' },
          { label: 'SLA Мониторинг' },
        ]}
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6 buh-animate-fade-in-up">
        <StatCard
          title="Соответствие SLA"
          value={`${stats?.compliancePercentage?.toFixed(1) ?? 0}%`}
          icon={<CheckCircle className="h-6 w-6" />}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title="Запросов за период"
          value={stats?.totalRequests ?? 0}
          icon={<MessageSquare className="h-6 w-6" />}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title="В норме"
          value={stats?.answeredWithinSLA ?? 0}
          icon={<CheckCircle className="h-6 w-6" />}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title="Нарушений"
          value={stats?.breachedSLA ?? 0}
          icon={<XCircle className="h-6 w-6" />}
          loading={statsQuery.isLoading}
        />
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        {/* Compliance Chart */}
        <div className="lg:col-span-1 buh-animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <GlassCard variant="elevated" padding="lg">
            <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)] mb-4">
              Соответствие SLA
            </h3>
            {statsQuery.isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--buh-accent)]" />
              </div>
            ) : (
              <div className="relative h-48" role="img" aria-label={`SLA соответствие ${stats?.compliancePercentage?.toFixed(1) ?? 0} процентов`}>
                <ChartContainer config={chartConfig}>
                  <RadialBarChart
                    data={chartData}
                    startAngle={90}
                    endAngle={-270}
                    innerRadius="80%"
                    outerRadius="100%"
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar
                      dataKey="value"
                      cornerRadius={10}
                      background={{ fill: 'var(--buh-surface-elevated)' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </RadialBarChart>
                </ChartContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-[var(--buh-foreground)]">
                    {stats?.compliancePercentage?.toFixed(1) ?? 0}%
                  </span>
                  <span className="text-xs text-[var(--buh-foreground-subtle)]">
                    соответствие
                  </span>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Response Time Stats */}
        <div className="lg:col-span-2 buh-animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <GlassCard variant="elevated" padding="lg">
            <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)] mb-4">
              Статистика времени ответа
            </h3>
            {statsQuery.isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--buh-accent)]" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6 py-8">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Clock className="h-5 w-5 text-[var(--buh-primary)]" />
                  </div>
                  <div className="text-3xl font-bold text-[var(--buh-foreground)] mb-1">
                    {stats?.averageResponseMinutes?.toFixed(0) ?? 0}
                  </div>
                  <div className="text-xs text-[var(--buh-foreground-muted)]">
                    Среднее (мин)
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Clock className="h-5 w-5 text-[var(--buh-info)]" />
                  </div>
                  <div className="text-3xl font-bold text-[var(--buh-foreground)] mb-1">
                    {stats?.medianResponseMinutes?.toFixed(0) ?? 0}
                  </div>
                  <div className="text-xs text-[var(--buh-foreground-muted)]">
                    Медиана (мин)
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Clock className="h-5 w-5 text-[var(--buh-warning)]" />
                  </div>
                  <div className="text-3xl font-bold text-[var(--buh-foreground)] mb-1">
                    {stats?.p95ResponseMinutes?.toFixed(0) ?? 0}
                  </div>
                  <div className="text-xs text-[var(--buh-foreground-muted)]">
                    95-й перцентиль (мин)
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Filters Section */}
      <div className="mb-6 buh-animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
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
              <span>
                Всего запросов: <strong className="text-[var(--buh-foreground)]">{requestsQuery.data?.total ?? 0}</strong>
              </span>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[var(--buh-border)] grid gap-4 sm:grid-cols-2 buh-animate-fade-in-up">
              <div className="space-y-2">
                <label className="text-[var(--buh-foreground-muted)] text-xs uppercase tracking-wide">
                  SLA Статус
                </label>
                <Select
                  value={statusFilter}
                  onValueChange={(v: 'all' | 'compliant' | 'breached') => setStatusFilter(v)}
                >
                  <SelectTrigger className="bg-[var(--buh-surface)] border-[var(--buh-border)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="compliant">В норме</SelectItem>
                    <SelectItem value="breached">Нарушен</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter('all')}
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

      {/* Requests Table */}
      <div className="buh-animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
        <GlassCard variant="default" padding="none">
          {requestsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--buh-accent)]" />
            </div>
          ) : sortedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-[var(--buh-foreground-subtle)] mb-4" />
              <p className="text-[var(--buh-foreground)]">Запросов не найдено</p>
              <p className="text-sm text-[var(--buh-foreground-muted)]">
                Измените фильтры или период времени
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--buh-border)] bg-[var(--buh-surface-overlay)]">
                    <SortableHeader
                      label="Чат"
                      sortDirection={getSortIcon('chatTitle')}
                      onClick={() => requestSort('chatTitle')}
                    />
                    <SortableHeader
                      label="Клиент"
                      sortDirection={getSortIcon('clientUsername')}
                      onClick={() => requestSort('clientUsername')}
                    />
                    <SortableHeader
                      label="Время получения"
                      sortDirection={getSortIcon('receivedAt')}
                      onClick={() => requestSort('receivedAt')}
                    />
                    <SortableHeader
                      label="Время ответа"
                      sortDirection={getSortIcon('respondedAt')}
                      onClick={() => requestSort('respondedAt')}
                    />
                    <SortableHeader
                      label="SLA статус"
                      sortDirection={getSortIcon('slaBreached')}
                      onClick={() => requestSort('slaBreached')}
                    />
                    <SortableHeader
                      label="Бухгалтер"
                      sortDirection={getSortIcon('accountantName')}
                      onClick={() => requestSort('accountantName')}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--buh-border)]">
                  {sortedData.map((request) => (
                    <tr
                      key={request.id}
                      className="hover:bg-[var(--buh-surface-elevated)] transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="font-medium text-[var(--buh-foreground)]">
                          {request.chatTitle}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-[var(--buh-foreground-muted)]" />
                          <span className="text-[var(--buh-foreground)]">
                            {request.clientUsername}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-[var(--buh-foreground-muted)]">
                          {formatDate(request.receivedAt)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-[var(--buh-foreground-muted)]">
                            {request.respondedAt ? formatDate(request.respondedAt) : '-'}
                          </span>
                          {request.responseMinutes !== null && (
                            <span className="text-xs text-[var(--buh-foreground-subtle)]">
                              ({formatDuration(request.responseMinutes)})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {request.slaBreached ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-error)]/10 px-2.5 py-1 text-xs font-medium text-[var(--buh-error)]">
                            <XCircle className="h-3 w-3" />
                            Нарушен
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-success)]/10 px-2.5 py-1 text-xs font-medium text-[var(--buh-success)]">
                            <CheckCircle className="h-3 w-3" />
                            В норме
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-[var(--buh-foreground)]">
                          {request.accountantName}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {sortedData.length > 0 && (
            <div className="flex items-center justify-between border-t border-[var(--buh-border)] px-4 py-3">
              <p className="text-sm text-[var(--buh-foreground-muted)]">
                Страница {page + 1}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || requestsQuery.isLoading}
                >
                  Назад
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore || requestsQuery.isLoading}
                >
                  Вперед
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </AdminLayout>
  );
}

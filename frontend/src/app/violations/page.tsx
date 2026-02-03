'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/layout/GlassCard';
import { StatCard } from '@/components/layout/StatCard';
import { trpc } from '@/lib/trpc';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  User,
  XCircle,
} from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { HelpButton } from '@/components/ui/HelpButton';

// ============================================
// TYPES
// ============================================

type ViolatedRequest = {
  id: string;
  chatTitle: string;
  clientUsername: string;
  messagePreview: string;
  receivedAt: Date;
  respondedAt: Date | null;
  responseMinutes: number | null;
  slaMinutes: number;
  excessMinutes: number;
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
  violations: {
    label: 'Нарушения',
    color: 'var(--buh-error)',
  },
};

// ============================================
// VIOLATIONS PAGE COMPONENT
// ============================================

export default function ViolationsPage() {
  const [page, setPage] = React.useState(0);

  // Date range (last 30 days) - calculate once at component mount
  const dateRange = React.useMemo(() => {
    const now = new Date();
    return {
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDate: now,
    };
  }, []);

  // Fetch violations (requests where SLA was breached)
  const violationsQuery = trpc.sla.getRequests.useQuery({
    slaBreached: true,
    dateFrom: dateRange.startDate,
    dateTo: dateRange.endDate,
    limit: 20,
    offset: page * 20,
  });

  // Calculate stats from violations
  const stats = React.useMemo(() => {
    const items = violationsQuery.data?.items ?? [];
    const total = violationsQuery.data?.total ?? 0;

    // Use a stable reference date
    const now = dateRange.endDate;

    // Get today's violations
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayViolations = items.filter((v) => new Date(v.receivedAt) >= today).length;

    // Get week violations (last 7 days)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekViolations = items.filter((v) => new Date(v.receivedAt) >= weekAgo).length;

    // Get last week violations for trend calculation
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const lastWeekViolations = items.filter((v) => {
      const date = new Date(v.receivedAt);
      return date >= twoWeeksAgo && date < weekAgo;
    }).length;

    // Calculate trend
    const trend =
      lastWeekViolations > 0
        ? Math.round(((weekViolations - lastWeekViolations) / lastWeekViolations) * 100)
        : weekViolations > 0
          ? 100
          : 0;

    // Calculate average per day (last 7 days)
    const avgPerDay = Math.round(weekViolations / 7);

    return {
      today: todayViolations,
      week: weekViolations,
      avgPerDay,
      trend,
      trendDirection: trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral',
      total,
    };
  }, [violationsQuery.data, dateRange.endDate]);

  // Generate daily violations data for last 30 days
  const chartData = React.useMemo(() => {
    const items = violationsQuery.data?.items ?? [];
    const data: { date: string; violations: number }[] = [];
    const now = dateRange.endDate;

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const count = items.filter((v) => {
        const vDate = new Date(v.receivedAt);
        return vDate >= date && vDate < nextDay;
      }).length;

      data.push({
        date: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date),
        violations: count,
      });
    }

    return data;
  }, [violationsQuery.data, dateRange.endDate]);

  // Transform violations for sorting
  const sortableViolations = React.useMemo<ViolatedRequest[]>(() => {
    const items = violationsQuery.data?.items ?? [];
    return items.map((req) => {
      // Create preview from messageText (max 100 chars)
      const messagePreview =
        req.messageText.length > 100 ? `${req.messageText.substring(0, 100)}...` : req.messageText;

      // Use slaWorkingMinutes from request, default to 60 if not set
      const slaMinutes = req.slaWorkingMinutes || 60;

      // Calculate excess minutes (only positive values)
      const excessMinutes = req.responseTimeMinutes
        ? Math.max(0, req.responseTimeMinutes - slaMinutes)
        : 0;

      return {
        id: req.id,
        chatTitle: req.chatTitle || 'Без названия',
        clientUsername: req.clientUsername || 'Неизвестный',
        messagePreview,
        receivedAt: new Date(req.receivedAt),
        respondedAt: req.responseAt ? new Date(req.responseAt) : null,
        responseMinutes: req.responseTimeMinutes,
        slaMinutes,
        excessMinutes,
        accountantName: req.assignedAccountantName || 'Не назначен',
      };
    });
  }, [violationsQuery.data]);

  const { sortedData, requestSort, getSortIcon } = useTableSort<ViolatedRequest>(
    sortableViolations,
    'receivedAt',
    'desc'
  );

  const TrendIcon =
    stats.trendDirection === 'up'
      ? TrendingUp
      : stats.trendDirection === 'down'
        ? TrendingDown
        : Minus;

  return (
    <AdminLayout>
      {/* Page Header */}
      <PageHeader
        title="Нарушения SLA"
        description="История нарушений и статистика"
        actions={<HelpButton section="violations" />}
        breadcrumbs={[
          { label: 'Панель управления', href: '/dashboard' },
          { label: 'Нарушения SLA' },
        ]}
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6 buh-animate-fade-in-up">
        <StatCard
          title="Сегодня"
          value={stats.today}
          icon={<AlertTriangle className="h-6 w-6" />}
          loading={violationsQuery.isLoading}
        />
        <StatCard
          title="Эта неделя"
          value={stats.week}
          icon={<AlertTriangle className="h-6 w-6" />}
          loading={violationsQuery.isLoading}
        />
        <StatCard
          title="Среднее за день"
          value={stats.avgPerDay}
          icon={<AlertTriangle className="h-6 w-6" />}
          loading={violationsQuery.isLoading}
        />
        <StatCard
          title="Тренд"
          value={`${stats.trend > 0 ? '+' : ''}${stats.trend}%`}
          change={{
            value: Math.abs(stats.trend),
            type:
              stats.trendDirection === 'up'
                ? 'increase'
                : stats.trendDirection === 'down'
                  ? 'decrease'
                  : 'neutral',
            label: 'vs прошлая неделя',
          }}
          icon={<TrendIcon className="h-6 w-6" />}
          loading={violationsQuery.isLoading}
        />
      </div>

      {/* Daily Violations Chart */}
      <div className="mb-6 buh-animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <GlassCard variant="elevated" padding="lg">
          <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)] mb-4">
            Нарушения за последние 30 дней
          </h3>
          {violationsQuery.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--buh-accent)]" />
            </div>
          ) : (
            <div
              className="h-64 overflow-hidden"
              role="img"
              aria-label="График нарушений SLA за последние 30 дней"
            >
              <ChartContainer config={chartConfig} className="h-full w-full">
                <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--buh-border)"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--buh-foreground-muted)', fontSize: 12 }}
                    tickLine={{ stroke: 'var(--buh-border)' }}
                  />
                  <YAxis
                    tick={{ fill: 'var(--buh-foreground-muted)', fontSize: 12 }}
                    tickLine={{ stroke: 'var(--buh-border)' }}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ fill: 'var(--buh-surface-elevated)', opacity: 0.3 }}
                  />
                  <Bar
                    dataKey="violations"
                    fill="var(--buh-error)"
                    radius={[4, 4, 0, 0]}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ChartContainer>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Violations Table */}
      <div className="buh-animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <GlassCard variant="default" padding="none">
          {violationsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--buh-accent)]" />
            </div>
          ) : sortedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle className="h-12 w-12 text-[var(--buh-foreground-subtle)] mb-4" />
              <p className="text-[var(--buh-foreground)]">Нарушений не найдено</p>
              <p className="text-sm text-[var(--buh-foreground-muted)]">
                За последние 30 дней нарушений SLA не было
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
                      label="Сообщение"
                      sortDirection={getSortIcon('messagePreview')}
                      onClick={() => requestSort('messagePreview')}
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
                      label="Превышение SLA"
                      sortDirection={getSortIcon('excessMinutes')}
                      onClick={() => requestSort('excessMinutes')}
                    />
                    <SortableHeader
                      label="Бухгалтер"
                      sortDirection={getSortIcon('accountantName')}
                      onClick={() => requestSort('accountantName')}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--buh-border)]">
                  {sortedData.map((violation) => (
                    <tr
                      key={violation.id}
                      className="hover:bg-[var(--buh-surface-elevated)] transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="font-medium text-[var(--buh-foreground)]">
                          {violation.chatTitle}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-[var(--buh-foreground-muted)]" />
                          <span className="text-[var(--buh-foreground)]">
                            {violation.clientUsername}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div
                          className="truncate max-w-[250px] text-[var(--buh-foreground-muted)]"
                          title={violation.messagePreview}
                        >
                          {violation.messagePreview}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-[var(--buh-foreground-muted)]">
                          {formatDate(violation.receivedAt)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-[var(--buh-foreground-muted)]">
                            {violation.respondedAt ? formatDate(violation.respondedAt) : '-'}
                          </span>
                          {violation.responseMinutes !== null && (
                            <span className="text-xs text-[var(--buh-foreground-subtle)]">
                              ({formatDuration(violation.responseMinutes)})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-error)]/10 px-2.5 py-1 text-xs font-medium text-[var(--buh-error)]">
                          <AlertTriangle className="h-3 w-3" />+
                          {formatDuration(violation.excessMinutes)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {violation.accountantName === 'Не назначен' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-warning)]/10 px-2.5 py-1 text-xs font-medium text-[var(--buh-warning)]">
                            <AlertTriangle className="h-3 w-3" />
                            Не назначен
                          </span>
                        ) : (
                          <span className="text-[var(--buh-foreground)]">
                            {violation.accountantName}
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
          {sortedData.length > 0 && (
            <div className="flex items-center justify-between border-t border-[var(--buh-border)] px-4 py-3">
              <p className="text-sm text-[var(--buh-foreground-muted)]">
                Страница {page + 1} · Всего нарушений: {stats.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || violationsQuery.isLoading}
                >
                  Назад
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!violationsQuery.data?.hasMore || violationsQuery.isLoading}
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

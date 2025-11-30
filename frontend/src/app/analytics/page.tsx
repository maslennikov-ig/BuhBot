'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
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
import { AreaChart, BarChart } from '@tremor/react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  ArrowLeftRight,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type PeriodType = 'today' | 'week' | 'month' | 'custom';

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDate = (date: Date | string) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
};

const getDatesForPeriod = (period: PeriodType): [Date, Date] => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start = new Date(now);

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      // Custom handled separately
      break;
  }

  return [start, end];
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function AnalyticsPage() {
  // ============================================
  // STATE
  // ============================================

  const [period, setPeriod] = React.useState<PeriodType>('week');
  const [selectedChatId, setSelectedChatId] = React.useState<string>('all');
  const [selectedAccountantId, setSelectedAccountantId] = React.useState<string>('all');
  const [customStartDate, setCustomStartDate] = React.useState<string>('');
  const [customEndDate, setCustomEndDate] = React.useState<string>('');

  // Calculate date range
  const [periodStart, periodEnd] = React.useMemo(() => {
    if (period === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return [start, end];
    }
    return getDatesForPeriod(period);
  }, [period, customStartDate, customEndDate]);

  // ============================================
  // API QUERIES
  // ============================================

  // Get chats list
  const chatsQuery = trpc.chats.list.useQuery({
    limit: 100,
    offset: 0,
  });

  // Get users list (accountants)
  const usersQuery = trpc.auth.listUsers.useQuery({});

  // Get analytics data
  const historyQuery = trpc.analytics.getResponseTimeHistory.useQuery({
    periodStart,
    periodEnd,
    chatId: selectedChatId === 'all' ? undefined : selectedChatId,
    accountantId: selectedAccountantId === 'all' ? undefined : selectedAccountantId,
  });

  const distributionQuery = trpc.analytics.getResponseTimeDistribution.useQuery({
    periodStart,
    periodEnd,
    chatId: selectedChatId === 'all' ? undefined : selectedChatId,
    accountantId: selectedAccountantId === 'all' ? undefined : selectedAccountantId,
  });

  const accountantStatsQuery = trpc.analytics.getAccountantStats.useQuery({
    dateFrom: periodStart,
    dateTo: periodEnd,
    sortBy: 'responseTime',
    sortOrder: 'asc',
  });

  // ============================================
  // EXPORT HANDLER
  // ============================================

  const handleExportCSV = () => {
    if (!historyQuery.data) return;

    const csvRows = [
      ['Дата', 'Среднее время (мин)', 'Медиана (мин)', 'P95 (мин)', 'Количество'],
    ];

    historyQuery.data.dataPoints.forEach((point) => {
      csvRows.push([
        formatDate(point.timestamp),
        point.avgResponseMinutes.toString(),
        point.medianResponseMinutes.toString(),
        point.p95ResponseMinutes.toString(),
        point.requestCount.toString(),
      ]);
    });

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${formatDate(periodStart)}-${formatDate(periodEnd)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ============================================
  // RENDER
  // ============================================

  const summary = historyQuery.data?.summary;
  const isLoading = historyQuery.isLoading || distributionQuery.isLoading || accountantStatsQuery.isLoading;

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
            Аналитика времени ответа
          </h1>
          <p className="text-[var(--buh-foreground-muted)] mt-2">
            Детальная статистика по скорости обработки обращений клиентов
          </p>
        </div>

        {/* Filters */}
        <GlassCard variant="elevated" padding="lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Period Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--buh-foreground)]">
                Период
              </label>
              <Select value={period} onValueChange={(v: PeriodType) => setPeriod(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите период" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Сегодня</SelectItem>
                  <SelectItem value="week">Неделя</SelectItem>
                  <SelectItem value="month">Месяц</SelectItem>
                  <SelectItem value="custom">Произвольный</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Chat Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--buh-foreground)]">
                Чат
              </label>
              <Select value={selectedChatId} onValueChange={setSelectedChatId}>
                <SelectTrigger>
                  <SelectValue placeholder="Все чаты" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все чаты</SelectItem>
                  {chatsQuery.data?.chats.map((chat: { id: number; title: string | null }) => (
                    <SelectItem key={chat.id.toString()} value={chat.id.toString()}>
                      {chat.title || `Чат ${chat.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Accountant Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--buh-foreground)]">
                Бухгалтер
              </label>
              <Select value={selectedAccountantId} onValueChange={setSelectedAccountantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {usersQuery.data?.map((user: { id: string; fullName: string }) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range (only visible when period is custom) */}
            {period === 'custom' && (
              <div className="space-y-2 md:col-span-4">
                <label className="text-sm font-medium text-[var(--buh-foreground)]">
                  Произвольный период
                </label>
                <div className="flex gap-4">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Average */}
          <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden group">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)]">
                  Среднее время
                </h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
                <Activity className="h-5 w-5 text-[var(--buh-primary)]" />
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold tracking-tight text-[var(--buh-foreground)]">
                {summary?.avgResponseMinutes ?? 0}
              </span>
              <span className="text-lg text-[var(--buh-foreground-muted)]">мин</span>

              {summary && summary.avgTrendPercent !== 0 && (
                <div
                  className={cn(
                    'ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                    summary.avgTrendPercent < 0
                      ? 'bg-[var(--buh-success-muted)] text-[var(--buh-success)]'
                      : 'bg-[var(--buh-error-muted)] text-[var(--buh-error)]'
                  )}
                >
                  {summary.avgTrendPercent < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5" />
                  )}
                  <span>{Math.abs(summary.avgTrendPercent)}%</span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Median */}
          <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden group">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)]">
                  Медиана
                </h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
                <Activity className="h-5 w-5 text-[var(--buh-primary)]" />
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold tracking-tight text-[var(--buh-foreground)]">
                {summary?.medianResponseMinutes ?? 0}
              </span>
              <span className="text-lg text-[var(--buh-foreground-muted)]">мин</span>

              {summary && summary.medianTrendPercent !== 0 && (
                <div
                  className={cn(
                    'ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                    summary.medianTrendPercent < 0
                      ? 'bg-[var(--buh-success-muted)] text-[var(--buh-success)]'
                      : 'bg-[var(--buh-error-muted)] text-[var(--buh-error)]'
                  )}
                >
                  {summary.medianTrendPercent < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5" />
                  )}
                  <span>{Math.abs(summary.medianTrendPercent)}%</span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* P95 */}
          <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden group">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)]">
                  P95
                </h3>
                <p className="text-xs text-[var(--buh-foreground-subtle)] mt-1">
                  95% обращений быстрее
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold tracking-tight text-[var(--buh-foreground)]">
                {summary?.p95ResponseMinutes ?? 0}
              </span>
              <span className="text-lg text-[var(--buh-foreground-muted)]">мин</span>

              {summary && summary.p95TrendPercent !== 0 && (
                <div
                  className={cn(
                    'ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                    summary.p95TrendPercent < 0
                      ? 'bg-[var(--buh-success-muted)] text-[var(--buh-success)]'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                  )}
                >
                  {summary.p95TrendPercent < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5" />
                  )}
                  <span>{Math.abs(summary.p95TrendPercent)}%</span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Range */}
          <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden group">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)]">
                  Диапазон
                </h3>
                <p className="text-xs text-[var(--buh-foreground-subtle)] mt-1">
                  мин - макс
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
                <ArrowLeftRight className="h-5 w-5 text-[var(--buh-primary)]" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-[var(--buh-foreground)]">
                {summary?.minResponseMinutes ?? 0}
              </span>
              <span className="text-lg text-[var(--buh-foreground-muted)]">-</span>
              <span className="text-2xl font-bold tracking-tight text-[var(--buh-foreground)]">
                {summary?.maxResponseMinutes ?? 0}
              </span>
              <span className="text-lg text-[var(--buh-foreground-muted)]">мин</span>
            </div>
          </GlassCard>
        </div>

        {/* Main Chart */}
        <GlassCard variant="elevated" padding="lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">
              История времени ответа
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportCSV}
              disabled={!historyQuery.data}
            >
              <Download className="h-4 w-4 mr-2" />
              Экспорт CSV
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin h-8 w-8 border-2 border-[var(--buh-primary)] border-t-transparent rounded-full" />
            </div>
          ) : historyQuery.data?.dataPoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Activity className="h-12 w-12 text-[var(--buh-foreground-muted)] mb-4" />
              <p className="text-[var(--buh-foreground-muted)] text-lg">
                Нет данных за выбранный период
              </p>
              <p className="text-[var(--buh-foreground-subtle)] text-sm mt-2">
                Попробуйте изменить фильтры или выбрать другой период
              </p>
            </div>
          ) : (
            <div className="h-80">
              <AreaChart
                data={
                  historyQuery.data?.dataPoints.map((point) => ({
                    Дата: point.label,
                    'Среднее время': point.avgResponseMinutes,
                    'Медиана': point.medianResponseMinutes,
                    'P95': point.p95ResponseMinutes,
                  })) ?? []
                }
                index="Дата"
                categories={['Среднее время', 'Медиана', 'P95']}
                colors={['cyan', 'emerald', 'amber']}
                valueFormatter={(value) => `${value} мин`}
                showLegend={true}
                showYAxis={true}
                showXAxis={true}
                showGridLines={true}
                showAnimation={true}
                curveType="monotone"
                className="h-full"
              />
            </div>
          )}
        </GlassCard>

        {/* Bottom Section: Table + Histogram */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Accountant Performance Table */}
          <GlassCard variant="elevated" padding="lg">
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)] mb-4">
              Топ бухгалтеров по времени ответа
            </h2>

            {accountantStatsQuery.isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin h-8 w-8 border-2 border-[var(--buh-primary)] border-t-transparent rounded-full" />
              </div>
            ) : accountantStatsQuery.data?.items.length === 0 ? (
              <div className="text-center py-12 text-[var(--buh-foreground-muted)]">
                Нет данных за выбранный период
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--buh-glass-border)]">
                    <tr>
                      <th className="text-left py-3 px-2 font-medium text-[var(--buh-foreground-muted)]">
                        Бухгалтер
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-[var(--buh-foreground-muted)]">
                        Обращений
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-[var(--buh-foreground-muted)]">
                        Среднее
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-[var(--buh-foreground-muted)]">
                        Медиана
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-[var(--buh-foreground-muted)]">
                        P95
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountantStatsQuery.data?.items.slice(0, 10).map((acc, idx) => (
                      <tr
                        key={acc.accountantId}
                        className={cn(
                          'border-b border-[var(--buh-glass-border)] transition-colors hover:bg-[var(--buh-surface-elevated)]',
                          idx === 0 && 'bg-green-50/50 dark:bg-green-900/10'
                        )}
                      >
                        <td className="py-3 px-2 font-medium text-[var(--buh-foreground)]">
                          {acc.accountantName}
                        </td>
                        <td className="text-right py-3 px-2 text-[var(--buh-foreground-muted)]">
                          {acc.totalRequests}
                        </td>
                        <td className="text-right py-3 px-2 text-[var(--buh-foreground)]">
                          {acc.avgResponseMinutes} мин
                        </td>
                        <td className="text-right py-3 px-2 text-[var(--buh-foreground)]">
                          {acc.medianResponseMinutes} мин
                        </td>
                        <td className="text-right py-3 px-2 text-[var(--buh-foreground)]">
                          {acc.maxResponseMinutes} мин
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          {/* Distribution Histogram */}
          <GlassCard variant="elevated" padding="lg">
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)] mb-4">
              Распределение времени ответа
            </h2>

            {distributionQuery.isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin h-8 w-8 border-2 border-[var(--buh-primary)] border-t-transparent rounded-full" />
              </div>
            ) : distributionQuery.data?.totalRequests === 0 ? (
              <div className="text-center py-12 text-[var(--buh-foreground-muted)]">
                Нет данных за выбранный период
              </div>
            ) : (
              <div className="h-64">
                <BarChart
                  data={
                    distributionQuery.data?.buckets.map((bucket) => ({
                      Диапазон: bucket.label,
                      Количество: bucket.count,
                      Процент: bucket.percentage,
                    })) ?? []
                  }
                  index="Диапазон"
                  categories={['Количество']}
                  colors={['emerald']}
                  valueFormatter={(value) => `${value} (${distributionQuery.data?.buckets.find((b) => b.count === value)?.percentage ?? 0}%)`}
                  showLegend={false}
                  showYAxis={true}
                  showXAxis={true}
                  showGridLines={true}
                  showAnimation={true}
                  layout="vertical"
                  className="h-full"
                />
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </AdminLayout>
  );
}

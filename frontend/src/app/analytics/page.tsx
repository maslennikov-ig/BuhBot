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
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  ArrowLeftRight,
  Download,
  BarChart3,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { HelpButton } from '@/components/ui/HelpButton';

// ============================================
// TYPES
// ============================================

type PeriodType = 'today' | 'week' | 'month' | 'custom';

// ============================================
// ANIMATION VARIANTS
// ============================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const kpiCardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
  hover: {
    y: -4,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

// ============================================
// CHART CONFIGS
// ============================================

const historyChartConfig = {
  'Среднее время': {
    label: 'Среднее время',
    color: 'hsl(var(--buh-accent))',
  },
  'Медиана': {
    label: 'Медиана',
    color: 'hsl(var(--buh-primary))',
  },
  'P95': {
    label: 'P95',
    color: 'hsl(var(--buh-warning))',
  },
};

const distributionChartConfig = {
  'Количество': {
    label: 'Количество обращений',
    color: 'hsl(var(--buh-accent))',
  },
};

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

  const start = new Date(now);

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
// KPI CARD COMPONENT
// ============================================

interface KPICardProps {
  title: string;
  subtitle?: string;
  value: number;
  unit: string;
  trend?: number;
  icon: React.ReactNode;
  iconColor: string;
  gradientFrom: string;
  gradientTo: string;
  delay?: number;
}

function KPICard({
  title,
  subtitle,
  value,
  unit,
  trend,
  icon,
  iconColor,
  gradientFrom,
  gradientTo,
  delay = 0,
}: KPICardProps) {
  const hasTrend = trend !== undefined && trend !== 0;
  const isPositiveTrend = trend !== undefined && trend < 0;

  return (
    <motion.div
      variants={kpiCardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      transition={{ delay }}
    >
      <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden group">
        {/* Animated gradient accent */}
        <motion.div
          className={cn(
            'absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
            `from-${gradientFrom}`,
            `to-${gradientTo}`
          )}
          style={{
            background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: delay + 0.2, duration: 0.6 }}
        />

        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[var(--buh-foreground-subtle)] mt-1">
                {subtitle}
              </p>
            )}
          </div>
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${gradientFrom}15, ${gradientTo}15)`,
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.3 }}
          >
            <div className={iconColor}>{icon}</div>
          </motion.div>
        </div>

        <div className="flex items-baseline gap-3">
          <motion.span
            className="text-4xl font-bold tracking-tight text-[var(--buh-foreground)]"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.1 }}
          >
            {value}
          </motion.span>
          <span className="text-lg text-[var(--buh-foreground-muted)]">{unit}</span>

          {hasTrend && (
            <motion.div
              className={cn(
                'ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ring-1',
                isPositiveTrend
                  ? 'bg-[var(--buh-success-muted)] text-[var(--buh-success)] ring-[var(--buh-success)]/20'
                  : 'bg-[var(--buh-error-muted)] text-[var(--buh-error)] ring-[var(--buh-error)]/20'
              )}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: delay + 0.4 }}
            >
              {isPositiveTrend ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              <span>{Math.abs(trend)}%</span>
            </motion.div>
          )}
        </div>

        {/* Hover glow effect */}
        <div
          className="absolute -bottom-16 -right-16 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20"
          style={{ background: gradientFrom }}
        />
      </GlassCard>
    </motion.div>
  );
}

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

  const chatsQuery = trpc.chats.list.useQuery({
    limit: 100,
    offset: 0,
  });

  const usersQuery = trpc.auth.listUsers.useQuery({});

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
      <motion.div
        className="space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
              Аналитика времени ответа
            </h1>
            <p className="text-[var(--buh-foreground-muted)] mt-2">
              Детальная статистика по скорости обработки обращений клиентов
            </p>
          </div>
          <HelpButton section="analytics" />
        </motion.div>

        {/* Filters */}
        <motion.div variants={itemVariants}>
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

              {/* Export Button */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--buh-foreground)] opacity-0">
                  Action
                </label>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleExportCSV}
                  disabled={!historyQuery.data}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Экспорт CSV
                </Button>
              </div>

              {/* Custom Date Range */}
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
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
        >
          <KPICard
            title="Среднее время"
            value={summary?.avgResponseMinutes ?? 0}
            unit="мин"
            trend={summary?.avgTrendPercent}
            icon={<Activity className="h-5 w-5" />}
            iconColor="text-[var(--buh-accent)]"
            gradientFrom="var(--buh-accent)"
            gradientTo="var(--buh-primary)"
            delay={0}
          />

          <KPICard
            title="Медиана"
            value={summary?.medianResponseMinutes ?? 0}
            unit="мин"
            trend={summary?.medianTrendPercent}
            icon={<Clock className="h-5 w-5" />}
            iconColor="text-[var(--buh-primary)]"
            gradientFrom="var(--buh-primary)"
            gradientTo="var(--buh-accent-secondary)"
            delay={0.1}
          />

          <KPICard
            title="P95"
            subtitle="95% обращений быстрее"
            value={summary?.p95ResponseMinutes ?? 0}
            unit="мин"
            trend={summary?.p95TrendPercent}
            icon={<AlertCircle className="h-5 w-5" />}
            iconColor="text-amber-600 dark:text-amber-400"
            gradientFrom="#f59e0b"
            gradientTo="#fb923c"
            delay={0.2}
          />

          <KPICard
            title="Диапазон"
            subtitle="мин - макс"
            value={summary?.minResponseMinutes ?? 0}
            unit={`- ${summary?.maxResponseMinutes ?? 0} мин`}
            icon={<ArrowLeftRight className="h-5 w-5" />}
            iconColor="text-[var(--buh-accent-secondary)]"
            gradientFrom="var(--buh-accent-secondary)"
            gradientTo="var(--buh-accent)"
            delay={0.3}
          />
        </motion.div>

        {/* Main Chart */}
        <motion.div variants={itemVariants}>
          <GlassCard variant="elevated" padding="lg">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">
                  История времени ответа
                </h2>
                <p className="text-sm text-[var(--buh-foreground-muted)] mt-1">
                  Динамика показателей за выбранный период
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-80">
                <div className="animate-spin h-8 w-8 border-2 border-[var(--buh-primary)] border-t-transparent rounded-full" />
              </div>
            ) : historyQuery.data?.dataPoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-80 text-center">
                <Activity className="h-12 w-12 text-[var(--buh-foreground-muted)] mb-4" />
                <p className="text-[var(--buh-foreground-muted)] text-lg">
                  Нет данных за выбранный период
                </p>
                <p className="text-[var(--buh-foreground-subtle)] text-sm mt-2">
                  Попробуйте изменить фильтры или выбрать другой период
                </p>
              </div>
            ) : (
              <div className="h-80 overflow-hidden">
                <ChartContainer config={historyChartConfig} className="!aspect-auto h-full">
                  <AreaChart
                    data={
                      historyQuery.data?.dataPoints.map((point) => ({
                        Дата: point.label,
                        'Среднее время': point.avgResponseMinutes,
                        'Медиана': point.medianResponseMinutes,
                        'P95': point.p95ResponseMinutes,
                      })) ?? []
                    }
                    margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--buh-accent)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--buh-accent)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorMedian" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--buh-primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--buh-primary)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorP95" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--buh-border)"
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="Дата"
                      stroke="var(--buh-foreground-subtle)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--buh-foreground-subtle)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value} мин`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                      type="monotone"
                      dataKey="Среднее время"
                      stroke="var(--buh-accent)"
                      strokeWidth={2}
                      fill="url(#colorAvg)"
                      animationDuration={1000}
                    />
                    <Area
                      type="monotone"
                      dataKey="Медиана"
                      stroke="var(--buh-primary)"
                      strokeWidth={2}
                      fill="url(#colorMedian)"
                      animationDuration={1000}
                    />
                    <Area
                      type="monotone"
                      dataKey="P95"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#colorP95)"
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Bottom Section: Table + Histogram */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Accountant Performance Table */}
          <motion.div variants={itemVariants}>
            <GlassCard variant="elevated" padding="lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
                  <Zap className="h-5 w-5 text-[var(--buh-accent)]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">
                    Топ бухгалтеров
                  </h2>
                  <p className="text-sm text-[var(--buh-foreground-muted)]">
                    По времени ответа
                  </p>
                </div>
              </div>

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
                          #
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-[var(--buh-foreground-muted)]">
                          Бухгалтер
                        </th>
                        <th className="text-right py-3 px-2 font-medium text-[var(--buh-foreground-muted)]">
                          Обращений
                        </th>
                        <th className="text-right py-3 px-2 font-medium text-[var(--buh-foreground-muted)]">
                          Среднее
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountantStatsQuery.data?.items.slice(0, 10).map((acc, idx) => (
                        <motion.tr
                          key={acc.accountantId}
                          className={cn(
                            'border-b border-[var(--buh-glass-border)] transition-colors hover:bg-[var(--buh-surface-elevated)]',
                            idx === 0 && 'bg-gradient-to-r from-[var(--buh-success-muted)] to-transparent'
                          )}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <td className="py-3 px-2 text-[var(--buh-foreground-muted)]">
                            {idx === 0 && (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[var(--buh-success)] text-white text-xs font-bold">
                                {idx + 1}
                              </span>
                            )}
                            {idx !== 0 && idx + 1}
                          </td>
                          <td className="py-3 px-2 font-medium text-[var(--buh-foreground)]">
                            {acc.accountantName}
                          </td>
                          <td className="text-right py-3 px-2 text-[var(--buh-foreground-muted)]">
                            {acc.totalRequests}
                          </td>
                          <td className="text-right py-3 px-2 font-semibold text-[var(--buh-foreground)]">
                            {acc.avgResponseMinutes} мин
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* Distribution Histogram */}
          <motion.div variants={itemVariants}>
            <GlassCard variant="elevated" padding="lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-primary)]/10 to-[var(--buh-accent)]/10">
                  <BarChart3 className="h-5 w-5 text-[var(--buh-primary)]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">
                    Распределение
                  </h2>
                  <p className="text-sm text-[var(--buh-foreground-muted)]">
                    По времени ответа
                  </p>
                </div>
              </div>

              {distributionQuery.isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin h-8 w-8 border-2 border-[var(--buh-primary)] border-t-transparent rounded-full" />
                </div>
              ) : distributionQuery.data?.totalRequests === 0 ? (
                <div className="text-center py-12 text-[var(--buh-foreground-muted)]">
                  Нет данных за выбранный период
                </div>
              ) : (
                <div className="h-80">
                  <ChartContainer config={distributionChartConfig}>
                    <BarChart
                      data={
                        distributionQuery.data?.buckets.map((bucket) => ({
                          Диапазон: bucket.label,
                          Количество: bucket.count,
                        })) ?? []
                      }
                      layout="vertical"
                      margin={{ top: 10, right: 10, bottom: 0, left: 80 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="var(--buh-border)"
                        opacity={0.3}
                      />
                      <XAxis
                        type="number"
                        stroke="var(--buh-foreground-subtle)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="Диапазон"
                        stroke="var(--buh-foreground-subtle)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="Количество"
                        fill="var(--buh-accent)"
                        radius={[0, 4, 4, 0]}
                        animationDuration={1000}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>
      </motion.div>
    </AdminLayout>
  );
}

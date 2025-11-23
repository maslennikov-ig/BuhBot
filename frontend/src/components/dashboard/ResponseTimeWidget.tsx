'use client';

import * as React from 'react';
import { AreaChart } from '@tremor/react';
import { GlassCard } from '@/components/layout/GlassCard';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type ResponseTimeDataPoint = {
  time: string;
  'Время ответа': number;
};

type ResponseTimeWidgetProps = {
  averageTime: number; // in minutes
  trend: {
    value: number;
    direction: 'up' | 'down';
  };
  chartData: ResponseTimeDataPoint[];
  className?: string;
};

// ============================================
// COMPONENT
// ============================================

export function ResponseTimeWidget({
  averageTime,
  trend,
  chartData,
  className,
}: ResponseTimeWidgetProps) {
  // Trend is good when response time decreases
  const isPositiveTrend = trend.direction === 'down';
  const TrendIcon = trend.direction === 'up' ? TrendingUp : TrendingDown;

  return (
    <GlassCard
      variant="elevated"
      padding="lg"
      className={cn('relative overflow-hidden group', className)}
    >
      {/* Gradient accent on hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header with icon */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)]">
            Среднее время ответа
          </h3>
          <p className="mt-1 text-xs text-[var(--buh-foreground-subtle)]">
            За последние 7 дней
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
          <Clock className="h-5 w-5 text-[var(--buh-primary)]" />
        </div>
      </div>

      {/* Main metric */}
      <div className="mb-4 flex items-baseline gap-3">
        <span className="buh-animate-count text-4xl font-bold tracking-tight text-[var(--buh-foreground)]">
          {averageTime}
        </span>
        <span className="text-lg text-[var(--buh-foreground-muted)]">мин</span>

        {/* Trend indicator */}
        <div
          className={cn(
            'ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
            isPositiveTrend
              ? 'bg-[var(--buh-success-muted)] text-[var(--buh-success)]'
              : 'bg-[var(--buh-error-muted)] text-[var(--buh-error)]'
          )}
        >
          <TrendIcon className="h-3.5 w-3.5" />
          <span>{trend.value}%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-24">
        <AreaChart
          data={chartData}
          index="time"
          categories={['Время ответа']}
          colors={['cyan']}
          showLegend={false}
          showYAxis={false}
          showXAxis={false}
          showGridLines={false}
          showAnimation={true}
          curveType="monotone"
          className="h-full"
        />
      </div>

      {/* Decorative glow */}
      <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-[var(--buh-primary)] opacity-10 blur-3xl transition-opacity duration-500 group-hover:opacity-20" />
    </GlassCard>
  );
}

export default ResponseTimeWidget;

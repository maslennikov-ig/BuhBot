'use client';

import * as React from 'react';
import { GlassCard } from '@/components/layout/GlassCard';
import { Clock, TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

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
  onClick?: () => void;
  className?: string;
};

// ============================================
// CHART CONFIG
// ============================================

const chartConfig = {
  'Время ответа': {
    label: 'Время ответа',
    color: 'hsl(var(--buh-accent))',
  },
};

// ============================================
// ANIMATION VARIANTS
// ============================================

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const,
    }
  },
  hover: {
    y: -4,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1] as const,
    }
  },
};

const iconVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      delay: 0.2,
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as const,
    }
  },
};

const metricVariants = {
  initial: { opacity: 0, x: -20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.1,
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const,
    }
  },
};

const chartVariants = {
  initial: { opacity: 0, scaleY: 0.8 },
  animate: {
    opacity: 1,
    scaleY: 1,
    transition: {
      delay: 0.3,
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as const,
    }
  },
};

// ============================================
// COMPONENT
// ============================================

export function ResponseTimeWidget({
  averageTime,
  trend,
  chartData,
  onClick,
  className,
}: ResponseTimeWidgetProps) {
  // Trend is good when response time decreases
  const isPositiveTrend = trend.direction === 'down';
  const TrendIcon = trend.direction === 'up' ? TrendingUp : TrendingDown;

  // Calculate min/max for better chart visualization
  const values = chartData.map(d => d['Время ответа']).filter(v => v > 0);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const chartPadding = maxValue > minValue ? (maxValue - minValue) * 0.2 : 5;

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={onClick ? "hover" : undefined}
      className={cn('h-full', className)}
    >
      <GlassCard
        variant="elevated"
        padding="lg"
        className={cn(
          'relative overflow-hidden group h-full flex flex-col',
          onClick && 'cursor-pointer'
        )}
        onClick={onClick}
      >
        {/* Animated gradient accent on top */}
        <motion.div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] via-[var(--buh-primary)] to-[var(--buh-accent-secondary)]"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        />

        {/* Header with icon and stats */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)] mb-1">
              Среднее время ответа
            </h3>
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-[var(--buh-accent)]" />
              <p className="text-xs text-[var(--buh-foreground-subtle)]">
                За последние 7 дней
              </p>
            </div>
          </div>
          <motion.div
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 via-[var(--buh-primary)]/10 to-[var(--buh-accent-secondary)]/10 ring-1 ring-[var(--buh-accent)]/20"
            variants={iconVariants}
          >
            <Clock className="h-6 w-6 text-[var(--buh-accent)]" />
          </motion.div>
        </div>

        {/* Main metric with enhanced styling */}
        <motion.div
          className="mb-6 flex items-end gap-3"
          variants={metricVariants}
        >
          <div className="flex items-baseline gap-2">
            <span className="buh-animate-count text-5xl font-bold tracking-tight text-[var(--buh-foreground)]">
              {averageTime}
            </span>
            <span className="text-xl font-medium text-[var(--buh-foreground-muted)]">
              мин
            </span>
          </div>

          {/* Enhanced trend indicator */}
          <motion.div
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ring-1',
              isPositiveTrend
                ? 'bg-[var(--buh-success-muted)] text-[var(--buh-success)] ring-[var(--buh-success)]/20'
                : 'bg-[var(--buh-error-muted)] text-[var(--buh-error)] ring-[var(--buh-error)]/20'
            )}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            <span>{trend.value}%</span>
          </motion.div>
        </motion.div>

        {/* Enhanced Chart with recharts */}
        <motion.div
          className="h-32 -mx-2 flex-1 min-h-[8rem]"
          variants={chartVariants}
        >
          <ChartContainer config={chartConfig}>
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
            >
              <defs>
                <linearGradient id="colorResponseTime" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--buh-accent)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--buh-accent)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--buh-border)"
                opacity={0.3}
              />
              <XAxis
                dataKey="time"
                hide
              />
              <YAxis
                hide
                domain={[minValue - chartPadding, maxValue + chartPadding]}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                cursor={{ stroke: 'var(--buh-accent)', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="Время ответа"
                stroke="var(--buh-accent)"
                strokeWidth={2}
                fill="url(#colorResponseTime)"
                animationDuration={1000}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ChartContainer>
        </motion.div>

        {/* Stats row at bottom */}
        {values.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--buh-border)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[var(--buh-foreground-subtle)]">
              <Zap className="h-3.5 w-3.5" />
              <span>Лучший: {minValue} мин</span>
            </div>
            <div className="text-[var(--buh-foreground-subtle)]">
              Худший: {maxValue} мин
            </div>
          </div>
        )}

        {/* Decorative animated glow */}
        <motion.div
          className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-[var(--buh-accent)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-20"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </GlassCard>
    </motion.div>
  );
}

export default ResponseTimeWidget;

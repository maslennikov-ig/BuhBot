'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/layout/GlassCard';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';

// ============================================
// TYPES
// ============================================

type ViolationsWidgetProps = {
  count: number;
  yesterdayCount: number;
  last7Days?: number[]; // Violations count for last 7 days
  className?: string;
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
  initial: { scale: 0.8, opacity: 0, rotate: -10 },
  animate: {
    scale: 1,
    opacity: 1,
    rotate: 0,
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
  initial: { opacity: 0, scaleY: 0.5 },
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
// ANIMATED COUNTER HOOK
// ============================================

function useAnimatedCounter(target: number, duration: number = 1200) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(target * easeOutQuart));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration]);

  return count;
}

// ============================================
// COMPONENT
// ============================================

export function ViolationsWidget({
  count,
  yesterdayCount,
  last7Days = [0, 0, 0, 0, 0, 0, 0],
  className,
}: ViolationsWidgetProps) {
  const router = useRouter();
  const animatedCount = useAnimatedCounter(count);

  // Calculate change from yesterday
  const change = React.useMemo(
    () =>
      yesterdayCount > 0
        ? Math.round(((count - yesterdayCount) / yesterdayCount) * 100)
        : count > 0
          ? 100
          : 0,
    [count, yesterdayCount]
  );

  const changeDirection = React.useMemo(
    () => (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'),
    [change]
  );

  // Fewer violations is good
  const isPositive = changeDirection === 'down';

  const TrendIcon =
    changeDirection === 'up'
      ? TrendingUp
      : changeDirection === 'down'
        ? TrendingDown
        : Minus;

  // Determine severity
  const getSeverity = React.useCallback((value: number) => {
    if (value === 0) return 'success';
    if (value <= 2) return 'warning';
    return 'error';
  }, []);

  const severity = React.useMemo(() => getSeverity(count), [count, getSeverity]);

  // Prepare sparkline data
  const sparklineData = React.useMemo(
    () =>
      last7Days.map((violations, index) => ({
        day: `День ${index + 1}`,
        violations,
      })),
    [last7Days]
  );

  const handleWidgetClick = React.useCallback(() => {
    router.push('/violations');
  }, [router]);

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
    >
      <GlassCard
        variant="elevated"
        padding="lg"
        className={cn(
          'relative overflow-hidden group cursor-pointer',
          className
        )}
        onClick={handleWidgetClick}
      >
        {/* Gradient accent - colored based on severity */}
        <motion.div
          className={cn(
            'absolute inset-x-0 top-0 h-1 transition-opacity duration-300',
            severity === 'success' && 'bg-gradient-to-r from-[var(--buh-success)] to-[var(--buh-success)]',
            severity === 'warning' && 'bg-gradient-to-r from-[var(--buh-warning)] to-[var(--buh-error)]',
            severity === 'error' && 'bg-gradient-to-r from-[var(--buh-error)] to-[var(--buh-error)]',
          )}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        />

        {/* Header with icon */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)] mb-1">
              Нарушения сегодня
            </h3>
            <p className="text-xs text-[var(--buh-foreground-subtle)]">
              Превышение SLA
            </p>
          </div>
          <motion.div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300',
              severity === 'success' && 'bg-[var(--buh-success-muted)]',
              severity === 'warning' && 'bg-[var(--buh-warning-muted)]',
              severity === 'error' && 'bg-[var(--buh-error-muted)]'
            )}
            variants={iconVariants}
          >
            <AlertTriangle
              className={cn(
                'h-6 w-6 transition-colors duration-300',
                severity === 'success' && 'text-[var(--buh-success)]',
                severity === 'warning' && 'text-[var(--buh-warning)]',
                severity === 'error' && 'text-[var(--buh-error)]'
              )}
            />
          </motion.div>
        </div>

        {/* Main metric */}
        <motion.div
          className="flex items-baseline gap-3 mb-4"
          variants={metricVariants}
        >
          <span
            className={cn(
              'text-5xl font-bold tracking-tight transition-colors duration-300',
              severity === 'success' && 'text-[var(--buh-success)]',
              severity === 'warning' && 'text-[var(--buh-warning)]',
              severity === 'error' && 'text-[var(--buh-error)]'
            )}
          >
            {animatedCount}
          </span>

          {/* Trend indicator */}
          <motion.div
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
              isPositive
                ? 'bg-[var(--buh-success-muted)] text-[var(--buh-success)]'
                : changeDirection === 'up'
                  ? 'bg-[var(--buh-error-muted)] text-[var(--buh-error)]'
                  : 'bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground-muted)]'
            )}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <TrendIcon className="h-3 w-3" />
            <span>{Math.abs(change)}%</span>
          </motion.div>
        </motion.div>

        {/* Comparison with yesterday */}
        <div className="mb-4 text-xs text-[var(--buh-foreground-subtle)]">
          vs вчера ({yesterdayCount})
        </div>

        {/* Sparkline Chart */}
        {last7Days.length > 0 && (
          <motion.div
            className="h-16 -mx-2 mb-2"
            variants={chartVariants}
            role="img"
            aria-label="График нарушений за последние 7 дней"
          >
            <ChartContainer config={chartConfig}>
              <BarChart
                data={sparklineData}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <XAxis dataKey="day" hide />
                <YAxis hide />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: 'var(--buh-surface-elevated)', opacity: 0.3 }}
                />
                <Bar
                  dataKey="violations"
                  fill="var(--buh-error)"
                  radius={[4, 4, 0, 0]}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ChartContainer>
          </motion.div>
        )}

        {/* View details link */}
        <div className="flex items-center justify-center gap-1 text-sm font-medium text-[var(--buh-primary)]">
          <span>Подробнее</span>
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>

        {/* Decorative glow based on severity */}
        <motion.div
          className={cn(
            'absolute -bottom-16 -right-16 h-32 w-32 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-30',
            severity === 'success' && 'bg-[var(--buh-success)]',
            severity === 'warning' && 'bg-[var(--buh-warning)]',
            severity === 'error' && 'bg-[var(--buh-error)]'
          )}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.15, 0.25, 0.15],
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

export default ViolationsWidget;

'use client';

import * as React from 'react';
import { GlassCard } from '@/components/layout/GlassCard';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type ViolationsWidgetProps = {
  count: number;
  yesterdayCount: number;
  className?: string;
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
  className,
}: ViolationsWidgetProps) {
  const animatedCount = useAnimatedCounter(count);

  // Calculate change from yesterday
  const change = yesterdayCount > 0
    ? Math.round(((count - yesterdayCount) / yesterdayCount) * 100)
    : count > 0 ? 100 : 0;

  const changeDirection = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  // Fewer violations is good
  const isPositive = changeDirection === 'down';

  const TrendIcon = changeDirection === 'up'
    ? TrendingUp
    : changeDirection === 'down'
      ? TrendingDown
      : Minus;

  // Determine severity
  const getSeverity = (value: number) => {
    if (value === 0) return 'success';
    if (value <= 2) return 'warning';
    return 'error';
  };

  const severity = getSeverity(count);
  const hasPulse = count > 0;

  return (
    <GlassCard
      variant="elevated"
      padding="lg"
      className={cn(
        'relative overflow-hidden group',
        hasPulse && 'buh-animate-pulse-glow',
        className
      )}
    >
      {/* Gradient accent - colored based on severity */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-1 transition-opacity duration-300',
          severity === 'success' && 'bg-[var(--buh-success)]',
          severity === 'warning' && 'bg-[var(--buh-warning)]',
          severity === 'error' && 'bg-[var(--buh-error)]',
          count > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      />

      {/* Header with icon */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)]">
            Нарушения сегодня
          </h3>
          <p className="mt-1 text-xs text-[var(--buh-foreground-subtle)]">
            Превышение SLA
          </p>
        </div>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300',
            severity === 'success' && 'bg-[var(--buh-success-muted)]',
            severity === 'warning' && 'bg-[var(--buh-warning-muted)]',
            severity === 'error' && 'bg-[var(--buh-error-muted)]'
          )}
        >
          <AlertTriangle
            className={cn(
              'h-5 w-5 transition-colors duration-300',
              severity === 'success' && 'text-[var(--buh-success)]',
              severity === 'warning' && 'text-[var(--buh-warning)]',
              severity === 'error' && 'text-[var(--buh-error)]'
            )}
          />
        </div>
      </div>

      {/* Main metric */}
      <div className="flex items-baseline gap-3">
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
      </div>

      {/* Comparison with yesterday */}
      <div className="mt-4 flex items-center gap-2">
        <div
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            isPositive
              ? 'bg-[var(--buh-success-muted)] text-[var(--buh-success)]'
              : changeDirection === 'up'
                ? 'bg-[var(--buh-error-muted)] text-[var(--buh-error)]'
                : 'bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground-muted)]'
          )}
        >
          <TrendIcon className="h-3 w-3" />
          <span>{Math.abs(change)}%</span>
        </div>
        <span className="text-xs text-[var(--buh-foreground-subtle)]">
          vs вчера ({yesterdayCount})
        </span>
      </div>

      {/* Decorative glow based on severity */}
      <div
        className={cn(
          'absolute -bottom-16 -right-16 h-32 w-32 rounded-full opacity-20 blur-3xl transition-opacity duration-500',
          hasPulse && 'animate-pulse',
          severity === 'success' && 'bg-[var(--buh-success)]',
          severity === 'warning' && 'bg-[var(--buh-warning)]',
          severity === 'error' && 'bg-[var(--buh-error)]'
        )}
      />
    </GlassCard>
  );
}

export default ViolationsWidget;

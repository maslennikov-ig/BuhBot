'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ============================================
// TYPES
// ============================================

type StatCardProps = {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    label?: string;
  };
  icon?: React.ReactNode;
  className?: string;
  loading?: boolean;
};

// ============================================
// STAT CARD COMPONENT
// ============================================

export function StatCard({
  title,
  value,
  change,
  icon,
  className,
  loading = false,
}: StatCardProps) {
  const ChangeIcon = React.useMemo(() => {
    if (!change) return null;
    switch (change.type) {
      case 'increase':
        return TrendingUp;
      case 'decrease':
        return TrendingDown;
      default:
        return Minus;
    }
  }, [change]);

  if (loading) {
    return (
      <div
        className={cn(
          'buh-card p-6',
          className
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-4 w-24 buh-shimmer rounded" />
            <div className="h-8 w-32 buh-shimmer rounded" />
            <div className="h-5 w-20 buh-shimmer rounded-full" />
          </div>
          <div className="h-10 w-10 buh-shimmer rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'buh-card buh-card-interactive group relative overflow-hidden p-6',
        className
      )}
    >
      {/* Gradient top border on hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          {/* Title */}
          <p className="text-sm font-medium text-[var(--buh-foreground-muted)]">
            {title}
          </p>

          {/* Value */}
          <p className="buh-animate-count text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
            {value}
          </p>

          {/* Change indicator */}
          {change && (
            <div
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                change.type === 'increase' && 'bg-[var(--buh-success-muted)] text-[var(--buh-success)]',
                change.type === 'decrease' && 'bg-[var(--buh-error-muted)] text-[var(--buh-error)]',
                change.type === 'neutral' && 'bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground-muted)]'
              )}
            >
              {ChangeIcon && <ChangeIcon className="h-3 w-3" />}
              <span>
                {change.type === 'increase' && '+'}
                {change.value}%
              </span>
              {change.label && (
                <span className="text-[var(--buh-foreground-subtle)]">{change.label}</span>
              )}
            </div>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10 text-[var(--buh-primary)] transition-transform duration-300 group-hover:scale-110">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;

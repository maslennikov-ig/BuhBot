'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/layout/GlassCard';
import { Bell, AlertCircle, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type AlertSeverity = 'critical' | 'warning' | 'info';

type Alert = {
  id: string;
  title: string;
  severity: AlertSeverity;
  time: string;
};

type ActiveAlertsWidgetProps = {
  totalCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  recentAlerts: Alert[];
  className?: string;
};

// ============================================
// SEVERITY CONFIG
// ============================================

const severityConfig = {
  critical: {
    icon: AlertCircle,
    color: 'var(--buh-error)',
    bgColor: 'var(--buh-error-muted)',
    label: 'Критический',
  },
  warning: {
    icon: AlertTriangle,
    color: 'var(--buh-warning)',
    bgColor: 'var(--buh-warning-muted)',
    label: 'Предупреждение',
  },
  info: {
    icon: Info,
    color: 'var(--buh-info)',
    bgColor: 'var(--buh-info-muted)',
    label: 'Информация',
  },
};

// ============================================
// COMPONENT
// ============================================

export function ActiveAlertsWidget({
  totalCount,
  criticalCount,
  warningCount,
  infoCount,
  recentAlerts,
  className,
}: ActiveAlertsWidgetProps) {
  const router = useRouter();
  const hasUrgent = criticalCount > 0;

  const handleWidgetClick = () => {
    router.push('/alerts');
  };

  const handleAlertClick = (e: React.MouseEvent, alertId: string) => {
    e.stopPropagation(); // Prevent widget click
    router.push(`/alerts?id=${alertId}`);
  };

  return (
    <GlassCard
      variant="elevated"
      padding="lg"
      className={cn(
        'relative overflow-hidden group cursor-pointer transition-transform duration-200 hover:-translate-y-1 h-full flex flex-col',
        className
      )}
      onClick={handleWidgetClick}
    >
      {/* Gradient accent on hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header with total count */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)]">
            Активные алерты
          </h3>
          <p className="mt-1 text-xs text-[var(--buh-foreground-subtle)]">Требуют внимания</p>
        </div>
        <div className="relative">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300',
              hasUrgent
                ? 'bg-[var(--buh-error-muted)]'
                : 'bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10'
            )}
          >
            <Bell
              className={cn(
                'h-5 w-5',
                hasUrgent ? 'text-[var(--buh-error)]' : 'text-[var(--buh-primary)]'
              )}
            />
          </div>
          {/* Animated badge for urgent */}
          {hasUrgent && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--buh-error)] px-1.5 text-xs font-bold text-white animate-pulse">
              {criticalCount}
            </span>
          )}
        </div>
      </div>

      {/* Total count */}
      <div className="mb-4">
        <span className="buh-animate-count text-4xl font-bold tracking-tight text-[var(--buh-foreground)]">
          {totalCount}
        </span>
      </div>

      {/* Severity breakdown */}
      <div className="mb-4 flex gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--buh-error)]" />
          <span className="text-sm text-[var(--buh-foreground-muted)]">
            <span className="font-semibold text-[var(--buh-foreground)]">{criticalCount}</span>{' '}
            крит.
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--buh-warning)]" />
          <span className="text-sm text-[var(--buh-foreground-muted)]">
            <span className="font-semibold text-[var(--buh-foreground)]">{warningCount}</span> пред.
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--buh-info)]" />
          <span className="text-sm text-[var(--buh-foreground-muted)]">
            <span className="font-semibold text-[var(--buh-foreground)]">{infoCount}</span> инфо
          </span>
        </div>
      </div>

      {/* Recent alerts list */}
      {recentAlerts.length > 0 && (
        <div className="space-y-2 border-t border-[var(--buh-border)] pt-4">
          {recentAlerts.slice(0, 3).map((alert) => {
            const config = severityConfig[alert.severity];
            const Icon = config.icon;

            return (
              <button
                key={alert.id}
                onClick={(e) => handleAlertClick(e, alert.id)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-all duration-200 hover:bg-[var(--buh-surface-elevated)] hover:scale-[1.02] active:scale-[0.98]"
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: config.bgColor }}
                >
                  <Icon className="h-4 w-4" style={{ color: config.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--buh-foreground)]">
                    {alert.title}
                  </p>
                  <p className="text-xs text-[var(--buh-foreground-subtle)]">{alert.time}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--buh-foreground-subtle)] opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      )}

      {/* Spacer to push link to bottom */}
      <div className="flex-1" />

      {/* View all indicator */}
      <div className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-[var(--buh-primary)]">
        <span>Все алерты</span>
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>

      {/* Decorative glow */}
      <div
        className={cn(
          'absolute -bottom-16 -left-16 h-32 w-32 rounded-full opacity-15 blur-3xl transition-opacity duration-500 group-hover:opacity-25',
          hasUrgent ? 'bg-[var(--buh-error)]' : 'bg-[var(--buh-primary)]'
        )}
      />
    </GlassCard>
  );
}

'use client';

import * as React from 'react';
import { DonutChart } from '@tremor/react';
import { GlassCard } from '@/components/layout/GlassCard';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type SlaComplianceWidgetProps = {
  compliance: number; // 0-100 percentage
  compliantCount: number;
  violatedCount: number;
  className?: string;
};

// ============================================
// ANIMATED COUNTER HOOK
// ============================================

function useAnimatedCounter(target: number, duration: number = 1500) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(target * easeOutQuart * 10) / 10);

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

export function SlaComplianceWidget({
  compliance,
  compliantCount,
  violatedCount,
  className,
}: SlaComplianceWidgetProps) {
  const animatedCompliance = useAnimatedCounter(compliance);

  // Chart data
  const chartData = [
    {
      name: 'В норме',
      value: compliantCount,
    },
    {
      name: 'Нарушения',
      value: violatedCount,
    },
  ];

  // Determine color based on compliance level
  const getComplianceColor = (value: number) => {
    if (value >= 90) return 'var(--buh-success)';
    if (value >= 70) return 'var(--buh-warning)';
    return 'var(--buh-error)';
  };

  const complianceColor = getComplianceColor(compliance);

  return (
    <GlassCard
      variant="elevated"
      padding="lg"
      className={cn('relative overflow-hidden group', className)}
    >
      {/* Gradient accent on hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)]">
          Соответствие SLA
        </h3>
        <p className="mt-1 text-xs text-[var(--buh-foreground-subtle)]">
          За последние 24 часа
        </p>
      </div>

      {/* Chart with center metric */}
      <div className="relative flex items-center justify-center">
        <DonutChart
          data={chartData}
          category="value"
          index="name"
          colors={['emerald', 'rose']}
          showLabel={false}
          showAnimation={true}
          className="h-40 w-40"
          variant="donut"
        />

        {/* Center percentage display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-4xl font-bold tracking-tight transition-colors duration-300"
            style={{ color: complianceColor }}
          >
            {animatedCompliance.toFixed(1)}%
          </span>
          <span className="text-xs text-[var(--buh-foreground-subtle)]">
            соответствие
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[var(--buh-success)]" />
          <span className="text-sm text-[var(--buh-foreground-muted)]">
            В норме: <span className="font-semibold text-[var(--buh-foreground)]">{compliantCount}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[var(--buh-error)]" />
          <span className="text-sm text-[var(--buh-foreground-muted)]">
            Нарушения: <span className="font-semibold text-[var(--buh-foreground)]">{violatedCount}</span>
          </span>
        </div>
      </div>

      {/* Decorative glow */}
      <div
        className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ background: complianceColor }}
      />
    </GlassCard>
  );
}

export default SlaComplianceWidget;

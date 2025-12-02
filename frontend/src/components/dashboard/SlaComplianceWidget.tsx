'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/layout/GlassCard';
import { CheckCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Pie, PieChart, Cell } from 'recharts';

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
// CHART CONFIG
// ============================================

const chartConfig = {
  compliant: {
    label: 'В норме',
    color: 'var(--buh-success)',
  },
  violated: {
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
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
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
  const router = useRouter();
  const animatedCompliance = useAnimatedCounter(compliance);

  // Determine color based on compliance level
  const getComplianceColor = React.useCallback((value: number) => {
    if (value >= 90) return 'var(--buh-success)';
    if (value >= 70) return 'var(--buh-warning)';
    return 'var(--buh-error)';
  }, []);

  const complianceColor = React.useMemo(
    () => getComplianceColor(compliance),
    [compliance, getComplianceColor]
  );

  // Chart data
  const chartData = React.useMemo(
    () => [
      { name: 'В норме', value: compliantCount },
      { name: 'Нарушения', value: violatedCount },
    ],
    [compliantCount, violatedCount]
  );

  const handleWidgetClick = React.useCallback(() => {
    router.push('/sla');
  }, [router]);

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      className={cn('h-full', className)}
    >
      <GlassCard
        variant="elevated"
        padding="lg"
        className="relative overflow-hidden group cursor-pointer h-full flex flex-col"
        onClick={handleWidgetClick}
      >
        {/* Gradient accent on hover */}
        <motion.div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] via-[var(--buh-primary)] to-[var(--buh-success)]"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        />

        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)] mb-1">
              Соответствие SLA
            </h3>
            <p className="text-xs text-[var(--buh-foreground-subtle)]">
              За последние 24 часа
            </p>
          </div>
          <motion.div
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-success)]/10 via-[var(--buh-primary)]/10 to-[var(--buh-accent)]/10 ring-1 ring-[var(--buh-success)]/20"
            variants={iconVariants}
          >
            <CheckCircle className="h-6 w-6 text-[var(--buh-success)]" />
          </motion.div>
        </div>

        {/* Chart with center metric */}
        <motion.div
          className="relative flex items-center justify-center h-40 mb-4"
          variants={chartVariants}
          role="img"
          aria-label={`SLA соответствие ${compliance.toFixed(1)}%`}
        >
          <ChartContainer config={chartConfig} className="h-40 w-40">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                animationDuration={1000}
                animationEasing="ease-out"
              >
                <Cell fill="var(--buh-success)" />
                <Cell fill="var(--buh-error)" />
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>

          {/* Center percentage display */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            variants={metricVariants}
          >
            <span
              className="text-4xl font-bold tracking-tight transition-colors duration-300"
              style={{ color: complianceColor }}
            >
              {animatedCompliance.toFixed(1)}%
            </span>
            <span className="text-xs text-[var(--buh-foreground-subtle)]">
              соответствие
            </span>
          </motion.div>
        </motion.div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mb-4">
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

        {/* Spacer to push link to bottom */}
        <div className="flex-1" />

        {/* View details link */}
        <div className="flex items-center justify-center gap-1 text-sm font-medium text-[var(--buh-primary)] mt-auto">
          <span>Подробнее</span>
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>

        {/* Decorative glow */}
        <motion.div
          className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
          style={{ background: complianceColor }}
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

export default SlaComplianceWidget;

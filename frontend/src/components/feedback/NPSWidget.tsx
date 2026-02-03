'use client';

import * as React from 'react';
import { GlassCard } from '@/components/layout/GlassCard';
import { Star, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export type RatingDistribution = {
  rating: number;
  count: number;
  percentage: number;
};

export type TrendDataPoint = {
  period: string;
  averageRating: number;
  responseCount: number;
  npsScore: number;
};

type NPSWidgetProps = {
  npsScore: number; // -100 to +100
  totalResponses: number;
  averageRating: number;
  ratingDistribution: RatingDistribution[];
  trendData?: TrendDataPoint[];
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
// NPS SCORE DISPLAY COMPONENT
// ============================================

function NPSScoreDisplay({ score }: { score: number }) {
  const animatedScore = useAnimatedCounter(score);

  // Determine color based on NPS score
  const getScoreColor = (value: number) => {
    if (value < 0) return 'var(--buh-error)';
    if (value < 50) return 'var(--buh-warning)';
    return 'var(--buh-success)';
  };

  const scoreColor = getScoreColor(score);

  // Determine category label
  const getCategory = (value: number) => {
    if (value < 0) return 'Критический';
    if (value < 30) return 'Удовлетворительный';
    if (value < 70) return 'Хороший';
    return 'Отличный';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <span
          className="text-6xl font-bold tracking-tight transition-colors duration-300"
          style={{ color: scoreColor }}
        >
          {animatedScore > 0 ? '+' : ''}
          {animatedScore}
        </span>
        {/* Glow effect */}
        <div
          className="absolute -inset-4 rounded-full opacity-20 blur-2xl"
          style={{ background: scoreColor }}
        />
      </div>
      <span className="mt-2 text-sm font-medium text-[var(--buh-foreground-muted)]">NPS Score</span>
      <span
        className="mt-1 text-xs font-semibold uppercase tracking-wider"
        style={{ color: scoreColor }}
      >
        {getCategory(score)}
      </span>
    </div>
  );
}

// ============================================
// STAR RATING DISPLAY
// ============================================

function AverageRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-4 w-4',
              star <= Math.round(rating)
                ? 'fill-[var(--buh-warning)] text-[var(--buh-warning)]'
                : star - 0.5 <= rating
                  ? 'fill-[var(--buh-warning)]/50 text-[var(--buh-warning)]'
                  : 'fill-transparent text-[var(--buh-foreground-subtle)]'
            )}
          />
        ))}
      </div>
      <span className="text-lg font-semibold text-[var(--buh-foreground)]">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

// ============================================
// RATING DISTRIBUTION BAR
// ============================================

function RatingDistributionBar({ distribution }: { distribution: RatingDistribution[] }) {
  // Sort by rating (5 to 1)
  const sortedDistribution = [...distribution].sort((a, b) => b.rating - a.rating);

  const getBarColor = (rating: number) => {
    if (rating >= 4) return 'var(--buh-success)';
    if (rating === 3) return 'var(--buh-warning)';
    return 'var(--buh-error)';
  };

  return (
    <div className="flex flex-col gap-2">
      {sortedDistribution.map((item) => (
        <div key={item.rating} className="flex items-center gap-3">
          <div className="flex w-12 items-center justify-end gap-0.5">
            <span className="text-xs font-medium text-[var(--buh-foreground-muted)]">
              {item.rating}
            </span>
            <Star className="h-3 w-3 fill-[var(--buh-warning)] text-[var(--buh-warning)]" />
          </div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--buh-surface-elevated)]">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: getBarColor(item.rating),
              }}
            />
          </div>
          <span className="w-12 text-right text-xs font-medium text-[var(--buh-foreground-muted)]">
            {item.percentage.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// TREND CHART (SIMPLE BAR)
// ============================================

function TrendChart({ data }: { data: TrendDataPoint[] }) {
  if (!data || data.length === 0) return null;

  const maxNps = Math.max(...data.map((d) => Math.abs(d.npsScore)), 100);

  // Calculate trend direction
  const lastTwo = data.slice(-2);
  const isImproving = lastTwo.length === 2 && lastTwo[1].npsScore > lastTwo[0].npsScore;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--buh-foreground-muted)]">
          Тренд NPS по кварталам
        </span>
        <div className="flex items-center gap-1">
          {isImproving ? (
            <TrendingUp className="h-4 w-4 text-[var(--buh-success)]" />
          ) : (
            <TrendingDown className="h-4 w-4 text-[var(--buh-error)]" />
          )}
          <span
            className={cn(
              'text-xs font-semibold',
              isImproving ? 'text-[var(--buh-success)]' : 'text-[var(--buh-error)]'
            )}
          >
            {isImproving ? 'Рост' : 'Снижение'}
          </span>
        </div>
      </div>
      <div className="flex items-end gap-2">
        {data.map((point, index) => {
          const isPositive = point.npsScore >= 0;
          const barHeight = Math.max(8, (Math.abs(point.npsScore) / maxNps) * 60);

          return (
            <div
              key={point.period}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${point.period}: NPS ${point.npsScore}`}
            >
              <div className="relative flex h-16 items-end">
                <div
                  className="w-full min-w-6 rounded-t transition-all duration-500"
                  style={{
                    height: `${barHeight}px`,
                    backgroundColor: isPositive ? 'var(--buh-success)' : 'var(--buh-error)',
                    opacity: index === data.length - 1 ? 1 : 0.6,
                  }}
                />
              </div>
              <span className="text-[10px] font-medium text-[var(--buh-foreground-subtle)]">
                {point.period.replace(/^\d{4}-/, '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// STAT CARD COMPONENT
// ============================================

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[var(--buh-surface-elevated)]/50 p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--buh-primary-muted)]">
        <Icon className="h-5 w-5 text-[var(--buh-primary)]" />
      </div>
      <div>
        <p className="text-xs text-[var(--buh-foreground-muted)]">{label}</p>
        <div className="text-sm font-semibold text-[var(--buh-foreground)]">{value}</div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function NPSWidget({
  npsScore,
  totalResponses,
  averageRating,
  ratingDistribution,
  trendData,
  className,
}: NPSWidgetProps) {
  return (
    <GlassCard
      variant="elevated"
      padding="lg"
      className={cn('relative overflow-hidden group', className)}
    >
      {/* Gradient accent on hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-base font-semibold text-[var(--buh-foreground)]">
          Индекс лояльности (NPS)
        </h3>
        <p className="mt-1 text-xs text-[var(--buh-foreground-subtle)]">
          Показатели удовлетворенности клиентов
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: NPS Score + Stats */}
        <div className="flex flex-col gap-6">
          {/* NPS Score */}
          <div className="flex justify-center py-4">
            <NPSScoreDisplay score={npsScore} />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Users}
              label="Всего ответов"
              value={totalResponses.toLocaleString('ru-RU')}
            />
            <StatCard
              icon={Star}
              label="Средняя оценка"
              value={<AverageRating rating={averageRating} />}
            />
          </div>
        </div>

        {/* Right Column: Distribution + Trend */}
        <div className="flex flex-col gap-6">
          {/* Rating Distribution */}
          <div>
            <p className="mb-3 text-xs font-medium text-[var(--buh-foreground-muted)]">
              Распределение оценок
            </p>
            <RatingDistributionBar distribution={ratingDistribution} />
          </div>

          {/* Trend Chart */}
          {trendData && trendData.length > 0 && (
            <div className="mt-2">
              <TrendChart data={trendData} />
            </div>
          )}
        </div>
      </div>

      {/* Decorative glow */}
      <div
        className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{
          background:
            npsScore < 0
              ? 'var(--buh-error)'
              : npsScore < 50
                ? 'var(--buh-warning)'
                : 'var(--buh-success)',
        }}
      />
    </GlassCard>
  );
}

export default NPSWidget;

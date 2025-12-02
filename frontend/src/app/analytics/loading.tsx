export default function AnalyticsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div>
        <div className="h-9 bg-[var(--buh-surface-elevated)] rounded w-1/3 mb-2" />
        <div className="h-5 bg-[var(--buh-surface-elevated)] rounded w-1/2" />
      </div>

      {/* Filters Skeleton */}
      <div className="rounded-xl border border-[var(--buh-glass-border)] buh-glass-elevated p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-10 bg-[var(--buh-surface-elevated)] rounded" />
          <div className="h-10 bg-[var(--buh-surface-elevated)] rounded" />
          <div className="h-10 bg-[var(--buh-surface-elevated)] rounded" />
          <div className="h-10 bg-[var(--buh-surface-elevated)] rounded" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--buh-glass-border)] buh-glass-elevated p-6">
            <div className="h-5 bg-[var(--buh-surface-elevated)] rounded w-2/3 mb-4" />
            <div className="h-10 bg-[var(--buh-surface-elevated)] rounded w-1/2 mb-2" />
            <div className="h-4 bg-[var(--buh-surface-elevated)] rounded w-1/3" />
          </div>
        ))}
      </div>

      {/* Main Chart Skeleton */}
      <div className="rounded-xl border border-[var(--buh-glass-border)] buh-glass-elevated p-6">
        <div className="h-6 bg-[var(--buh-surface-elevated)] rounded w-1/4 mb-6" />
        <div className="h-64 bg-[var(--buh-surface-elevated)] rounded" />
      </div>

      {/* Bottom Section Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--buh-glass-border)] buh-glass-elevated p-6">
          <div className="h-6 bg-[var(--buh-surface-elevated)] rounded w-1/3 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-[var(--buh-surface-elevated)] rounded" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--buh-glass-border)] buh-glass-elevated p-6">
          <div className="h-6 bg-[var(--buh-surface-elevated)] rounded w-1/3 mb-4" />
          <div className="h-64 bg-[var(--buh-surface-elevated)] rounded" />
        </div>
      </div>
    </div>
  );
}

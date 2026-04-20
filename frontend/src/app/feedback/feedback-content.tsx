'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { NPSWidget, FeedbackTable } from '@/components/feedback';
import type { FeedbackFilters } from '@/components/feedback';
import { trpc } from '@/lib/trpc';
import { HelpButton } from '@/components/ui/HelpButton';
import { useRoleGuard } from '@/hooks/useRoleGuard';

// ============================================
// CONSTANTS
// ============================================

const POLLING_INTERVAL_MS = 60 * 1000; // 1 minute refresh

// ============================================
// LOADING SKELETON COMPONENT
// ============================================

function LoadingSkeleton() {
  return (
    <>
      {/* Page Header Skeleton */}
      <div className="mb-8">
        <div className="h-9 w-64 animate-pulse rounded bg-[var(--buh-card-bg)]" />
        <div className="mt-2 h-5 w-96 animate-pulse rounded bg-[var(--buh-card-bg)]" />
      </div>

      {/* NPS Widget Skeleton */}
      <div className="mb-8">
        <div className="h-80 animate-pulse rounded-lg border border-[var(--buh-border)] bg-[var(--buh-card-bg)]" />
      </div>

      {/* Table Skeleton */}
      <div className="h-96 animate-pulse rounded-lg border border-[var(--buh-border)] bg-[var(--buh-card-bg)]" />
    </>
  );
}

// ============================================
// FEEDBACK CONTENT COMPONENT
// ============================================

export function FeedbackContent() {
  const { isAllowed, isLoading: isRoleLoading } = useRoleGuard(['accountant']);
  // Local state for filters and pagination
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [filters, setFilters] = React.useState<FeedbackFilters>({});

  // Fetch aggregates data (available to all authenticated users)
  const {
    data: aggregatesData,
    isLoading: aggregatesLoading,
    error: aggregatesError,
  } = trpc.feedback.getAggregates.useQuery(
    {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    },
    {
      refetchInterval: POLLING_INTERVAL_MS,
      refetchIntervalInBackground: false,
    }
  );

  // Fetch feedback list (manager only - will fail gracefully for other roles)
  const {
    data: feedbackData,
    isLoading: feedbackLoading,
    error: feedbackError,
  } = trpc.feedback.getAll.useQuery(
    {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      minRating: filters.minRating,
      maxRating: filters.maxRating,
      page,
      pageSize,
    },
    {
      refetchInterval: POLLING_INTERVAL_MS,
      refetchIntervalInBackground: false,
    }
  );

  // Export CSV mutation
  const exportCsvMutation = trpc.feedback.exportCsv.useQuery(
    {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    },
    {
      enabled: false, // Only run when explicitly triggered
    }
  );

  // Handle export CSV
  const handleExportCsv = React.useCallback(async () => {
    try {
      const result = await exportCsvMutation.refetch();
      if (result.data) {
        // Create blob and download
        const blob = new Blob([result.data.content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [exportCsvMutation]);

  // Log errors but don't break the UI
  React.useEffect(() => {
    if (aggregatesError) {
      console.error('Aggregates fetch error:', aggregatesError);
    }
    if (feedbackError) {
      console.error('Feedback fetch error:', feedbackError);
    }
  }, [aggregatesError, feedbackError]);

  // gh-324 / ADR-007: no mock fallback — render empty state instead when the
  // APIs legitimately return nothing. Hiding the "no data" case behind demo
  // numbers is exactly what masked the original read/write mismatch bug.
  const npsWidgetData = React.useMemo(() => {
    if (!aggregatesData) return null;
    return {
      npsScore: aggregatesData.npsScore,
      totalResponses: aggregatesData.totalResponses,
      averageRating: aggregatesData.averageRating,
      ratingDistribution: aggregatesData.ratingDistribution,
      trendData: aggregatesData.trendData,
    };
  }, [aggregatesData]);

  const feedbackTableData = React.useMemo(() => {
    if (!feedbackData) {
      return {
        entries: [],
        pagination: { page: 1, pageSize, totalItems: 0, totalPages: 0 },
      };
    }
    return {
      entries: feedbackData.items.map((item) => ({
        ...item,
        submittedAt: new Date(item.submittedAt),
      })),
      pagination: feedbackData.pagination,
    };
  }, [feedbackData, pageSize]);

  // Check if user is manager (has access to feedback list)
  const isManager = !feedbackError || feedbackError.data?.code !== 'FORBIDDEN';

  if (isRoleLoading || isAllowed === false) return null;

  // Loading state
  if (aggregatesLoading && feedbackLoading) {
    return (
      <AdminLayout>
        <LoadingSkeleton />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
            Обратная связь
          </h1>
          <p className="mt-2 text-[var(--buh-foreground-muted)]">
            Анализ отзывов клиентов и индекс лояльности NPS
            {(aggregatesError || feedbackError) && (
              <span className="ml-2 text-sm text-[var(--buh-status-critical)]">
                (данные из кэша)
              </span>
            )}
          </p>
        </div>
        <HelpButton section="feedback" />
      </div>

      {/* NPS Widget - Visible to all authenticated users */}
      <div className="mb-8">
        {npsWidgetData ? (
          <NPSWidget
            npsScore={npsWidgetData.npsScore}
            totalResponses={npsWidgetData.totalResponses}
            averageRating={npsWidgetData.averageRating}
            ratingDistribution={npsWidgetData.ratingDistribution}
            trendData={npsWidgetData.trendData}
          />
        ) : (
          <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] p-8 text-center">
            <p className="text-[var(--buh-foreground-muted)]">
              Ещё нет отзывов — аналитика NPS появится после первых ответов клиентов.
            </p>
          </div>
        )}
      </div>

      {/* Feedback Table - Manager only */}
      {isManager && (
        <FeedbackTable
          entries={feedbackTableData.entries}
          pagination={feedbackTableData.pagination}
          filters={filters}
          isLoading={feedbackLoading}
          onPageChange={setPage}
          onFiltersChange={(newFilters) => {
            setFilters(newFilters);
            setPage(1); // Reset to first page on filter change
          }}
          onExportCsv={handleExportCsv}
        />
      )}

      {/* Non-manager message */}
      {!isManager && feedbackError?.data?.code === 'FORBIDDEN' && (
        <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] p-8 text-center">
          <p className="text-[var(--buh-foreground-muted)]">
            Детальная информация о отзывах доступна только менеджерам.
          </p>
        </div>
      )}
    </AdminLayout>
  );
}

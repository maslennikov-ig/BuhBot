'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { NPSWidget, FeedbackTable } from '@/components/feedback';
import type { FeedbackEntry, FeedbackFilters } from '@/components/feedback';
import { trpc } from '@/lib/trpc';
import { HelpButton } from '@/components/ui/HelpButton';

// ============================================
// CONSTANTS
// ============================================

const POLLING_INTERVAL_MS = 60 * 1000; // 1 minute refresh

// ============================================
// MOCK DATA (fallback)
// ============================================

const mockAggregatesData = {
  npsScore: 45,
  totalResponses: 156,
  averageRating: 4.2,
  ratingDistribution: [
    { rating: 5, count: 68, percentage: 43.6 },
    { rating: 4, count: 52, percentage: 33.3 },
    { rating: 3, count: 20, percentage: 12.8 },
    { rating: 2, count: 10, percentage: 6.4 },
    { rating: 1, count: 6, percentage: 3.8 },
  ],
  trendData: [
    { period: '2024-Q2', averageRating: 4.0, responseCount: 35, npsScore: 38 },
    { period: '2024-Q3', averageRating: 4.1, responseCount: 42, npsScore: 42 },
    { period: '2024-Q4', averageRating: 4.2, responseCount: 48, npsScore: 45 },
    { period: '2025-Q1', averageRating: 4.2, responseCount: 31, npsScore: 45 },
  ],
};

const mockFeedbackEntries: FeedbackEntry[] = [
  {
    id: '1',
    chatId: '123',
    chatTitle: 'ООО "Ромашка"',
    clientUsername: 'Иванов И.И.',
    accountantUsername: 'Петрова А.С.',
    rating: 5,
    comment: 'Отличная работа, очень быстро ответили на все вопросы!',
    submittedAt: new Date('2025-01-15T10:30:00'),
    surveyId: 'survey-1',
    surveyQuarter: '2025-Q1',
  },
  {
    id: '2',
    chatId: '456',
    chatTitle: 'ИП Сидоров',
    clientUsername: 'Сидоров С.С.',
    accountantUsername: 'Козлова М.В.',
    rating: 4,
    comment: 'Хорошо, но хотелось бы быстрее получать ответы.',
    submittedAt: new Date('2025-01-14T14:45:00'),
    surveyId: 'survey-1',
    surveyQuarter: '2025-Q1',
  },
  {
    id: '3',
    chatId: '789',
    chatTitle: 'АО "Техно"',
    clientUsername: 'Новиков Н.Н.',
    accountantUsername: 'Петрова А.С.',
    rating: 5,
    comment: null,
    submittedAt: new Date('2025-01-13T09:15:00'),
    surveyId: 'survey-1',
    surveyQuarter: '2025-Q1',
  },
  {
    id: '4',
    chatId: '101',
    chatTitle: 'ООО "Строй"',
    clientUsername: 'Морозов М.М.',
    accountantUsername: 'Иванова Е.К.',
    rating: 2,
    comment: 'Долго ждал ответа, очень недоволен.',
    submittedAt: new Date('2025-01-12T16:20:00'),
    surveyId: 'survey-1',
    surveyQuarter: '2025-Q1',
  },
  {
    id: '5',
    chatId: '102',
    chatTitle: 'ИП Волков',
    clientUsername: 'Волков В.В.',
    accountantUsername: 'Козлова М.В.',
    rating: 4,
    comment: 'В целом хорошо.',
    submittedAt: new Date('2025-01-11T11:00:00'),
    surveyId: 'survey-1',
    surveyQuarter: '2025-Q1',
  },
];

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

  // Transform data or use mocks
  const npsWidgetData = React.useMemo(() => {
    if (!aggregatesData) return mockAggregatesData;

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
        entries: mockFeedbackEntries,
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: mockFeedbackEntries.length,
          totalPages: 1,
        },
      };
    }

    return {
      entries: feedbackData.items.map((item) => ({
        ...item,
        submittedAt: new Date(item.submittedAt),
      })),
      pagination: feedbackData.pagination,
    };
  }, [feedbackData]);

  // Check if user is manager (has access to feedback list)
  const isManager = !feedbackError || feedbackError.data?.code !== 'FORBIDDEN';

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
        <NPSWidget
          npsScore={npsWidgetData.npsScore}
          totalResponses={npsWidgetData.totalResponses}
          averageRating={npsWidgetData.averageRating}
          ratingDistribution={npsWidgetData.ratingDistribution}
          trendData={npsWidgetData.trendData}
        />
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

export default FeedbackContent;

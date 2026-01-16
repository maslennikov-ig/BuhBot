'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { LogsHeader } from '@/components/logs/LogsHeader';
import { LogsFilters } from '@/components/logs/LogsFilters';
import { LogsTable } from '@/components/logs/LogsTable';
import { trpc } from '@/lib/trpc';

// ============================================
// TYPES
// ============================================

type ViewMode = 'grouped' | 'flat';

type ErrorLevel = 'error' | 'warn' | 'info';
type ErrorStatus = 'new' | 'in_progress' | 'resolved' | 'ignored';

// ============================================
// COMPONENT
// ============================================

export default function LogsPage() {
  const [viewMode, setViewMode] = React.useState<ViewMode>('grouped');
  const [filters, setFilters] = React.useState<{
    level?: ErrorLevel;
    status?: ErrorStatus;
    search?: string;
    service?: string;
  }>({});

  // Query based on view mode
  const { data: groupedData, refetch: refetchGrouped } =
    trpc.logs.listGrouped.useQuery(
      { ...filters, limit: 50, offset: 0 },
      { enabled: viewMode === 'grouped' }
    );

  const { data: flatData, refetch: refetchFlat } = trpc.logs.list.useQuery(
    { ...filters, limit: 50 },
    { enabled: viewMode === 'flat' }
  );

  const handleRefresh = () => {
    if (viewMode === 'grouped') {
      refetchGrouped();
    } else {
      refetchFlat();
    }
  };

  // Transform data for LogsTable
  const errors =
    viewMode === 'grouped'
      ? groupedData?.groups.map((g) => ({
          ...g.latestError,
          level: g.latestError.level as ErrorLevel,
          status: g.latestError.status as ErrorStatus,
          // Add group metadata
          totalOccurrences: g.totalOccurrences,
        })) || []
      : (flatData?.errors.map((err) => ({
          ...err,
          level: err.level as ErrorLevel,
          status: err.status as ErrorStatus,
        })) || []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <LogsHeader viewMode={viewMode} onViewModeChange={setViewMode} />
        <LogsFilters onFiltersChange={setFilters} />
        <LogsTable
          errors={errors}
          viewMode={viewMode}
          onRefresh={handleRefresh}
        />
      </div>
    </AdminLayout>
  );
}

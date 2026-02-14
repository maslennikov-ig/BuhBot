'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layout/AdminLayout';
import {
  SlaComplianceWidget,
  ResponseTimeWidget,
  ViolationsWidget,
  ActiveAlertsWidget,
  RecentRequestsTable,
} from '@/components/dashboard';
import { trpc } from '@/lib/trpc';
import { HelpButton } from '@/components/ui/HelpButton';

// ============================================
// EMPTY STATE DATA (when no real data available)
// ============================================

const emptySlaData = {
  compliance: 0,
  compliantCount: 0,
  violatedCount: 0,
};

const emptyResponseTimeData = {
  averageTime: 0,
  trend: {
    value: 0,
    direction: 'down' as const,
  },
  chartData: [] as Array<{ time: string; 'Время ответа': number }>,
};

const emptyViolationsData = {
  count: 0,
  yesterdayCount: 0,
  last7Days: [0, 0, 0, 0, 0, 0, 0],
};

const emptyAlertsData = {
  totalCount: 0,
  criticalCount: 0,
  warningCount: 0,
  infoCount: 0,
  recentAlerts: [] as Array<{
    id: string;
    title: string;
    severity: 'critical' | 'warning' | 'info';
    time: string;
  }>,
};

const emptyRequestsData: Array<{
  id: string;
  chatName: string;
  clientName: string;
  message: string;
  status: 'pending' | 'in_progress' | 'answered' | 'escalated';
  time: string;
  slaRemaining?: string;
}> = [];

// ============================================
// CONSTANTS
// ============================================

const SLA_THRESHOLD_MINUTES = 60; // Default SLA threshold
const POLLING_INTERVAL_MS = 30 * 1000; // 30 seconds

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format time from Date to HH:MM string
 */
function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate SLA remaining time in minutes
 */
function calculateSlaRemaining(
  receivedAt: Date | string,
  thresholdMinutes: number = SLA_THRESHOLD_MINUTES
): string | undefined {
  const received = new Date(receivedAt);
  const now = new Date();
  const elapsedMinutes = Math.floor((now.getTime() - received.getTime()) / (1000 * 60));
  const remaining = thresholdMinutes - elapsedMinutes;

  if (remaining <= 0) {
    return undefined; // SLA breached, no remaining time
  }

  return `${remaining} мин`;
}

/**
 * Map backend status to widget status
 * Uses actual Prisma RequestStatus values for consistency
 */
function mapRequestStatus(
  status: 'pending' | 'in_progress' | 'answered' | 'escalated',
  breached: boolean
): 'pending' | 'in_progress' | 'answered' | 'escalated' {
  if (breached && status === 'pending') {
    return 'escalated';
  }
  return status;
}

/**
 * Format relative time for alerts
 */
function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));

  if (diffMinutes < 1) {
    return 'только что';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} мин назад`;
  }
  if (diffMinutes < 1440) {
    const hours = Math.floor(diffMinutes / 60);
    return `${hours} час${hours === 1 ? '' : hours < 5 ? 'а' : 'ов'} назад`;
  }
  const days = Math.floor(diffMinutes / 1440);
  return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} назад`;
}

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

      {/* Stats Grid Skeleton - 2x2 layout */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-lg border border-[var(--buh-border)] bg-[var(--buh-card-bg)]"
          />
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="mt-8">
        <div className="h-96 animate-pulse rounded-lg border border-[var(--buh-border)] bg-[var(--buh-card-bg)]" />
      </div>
    </>
  );
}

// ============================================
// DASHBOARD CONTENT COMPONENT
// ============================================

export function DashboardContent() {
  const router = useRouter();

  // Fetch dashboard data with real-time polling
  const { data, isLoading, error } = trpc.analytics.getDashboard.useQuery(
    { timezone: 'Europe/Moscow' },
    {
      refetchInterval: POLLING_INTERVAL_MS,
      refetchIntervalInBackground: true,
    }
  );

  // Log errors but don't break the UI
  React.useEffect(() => {
    if (error) {
      console.error('Dashboard fetch error:', error);
    }
  }, [error]);

  // Transform API data to widget props or use mock data as fallback
  const slaData = React.useMemo(() => {
    if (!data) return emptySlaData;

    // Calculate compliant count from total requests and violations
    const totalRequests = data.recentRequests?.length ?? 0;
    const violatedCount = data.totalViolationsToday ?? 0;
    const compliantCount = Math.max(0, totalRequests - violatedCount);

    return {
      compliance: data.slaCompliancePercent ?? emptySlaData.compliance,
      compliantCount: compliantCount > 0 ? compliantCount : emptySlaData.compliantCount,
      violatedCount: violatedCount > 0 ? violatedCount : emptySlaData.violatedCount,
    };
  }, [data]);

  const responseTimeData = React.useMemo(() => {
    if (!data) return emptyResponseTimeData;

    // Determine trend direction based on responseTimeTrend
    // Positive trend = time increased (bad), negative = decreased (good)
    const trendValue = Math.abs(data.responseTimeTrend ?? 0);
    const trendDirection: 'up' | 'down' = (data.responseTimeTrend ?? 0) > 0 ? 'up' : 'down';

    // Transform API chart data to widget format
    const chartData =
      data.responseTimeChartData?.map((point) => ({
        time: point.dayLabel,
        'Время ответа': point.avgResponseMinutes,
      })) ?? emptyResponseTimeData.chartData;

    return {
      averageTime: Math.round(data.avgResponseTimeMinutes ?? emptyResponseTimeData.averageTime),
      trend: {
        value: Math.round(trendValue),
        direction: trendDirection,
      },
      chartData,
    };
  }, [data]);

  const violationsData = React.useMemo(() => {
    if (!data) return emptyViolationsData;

    // Use today's violations as count
    const todayCount = data.totalViolationsToday ?? 0;

    // Get yesterday's count from last7Days (index 5 is yesterday, index 6 is today)
    const last7Days = data.violationsLast7Days ?? [0, 0, 0, 0, 0, 0, 0];
    const yesterdayCount = last7Days[5] ?? 0;

    return {
      count: todayCount,
      yesterdayCount,
      last7Days,
    };
  }, [data]);

  const alertsData = React.useMemo(() => {
    if (!data) return emptyAlertsData;

    // Use only activeAlertsCount from SlaAlert table for consistency with Alerts page.
    // Previously this fabricated alerts from breachedRequests via Math.max, causing
    // dashboard to show alerts that don't exist on the Alerts page (gh-48).
    const totalAlerts = data.activeAlertsCount ?? 0;

    if (totalAlerts === 0) return emptyAlertsData;

    // Approximate severity breakdown from total count
    const criticalCount = Math.ceil(totalAlerts * 0.4);
    const remainingAlerts = totalAlerts - criticalCount;
    const warningCount = Math.ceil(remainingAlerts * 0.6);
    const infoCount = remainingAlerts - warningCount;

    // Show breached requests as recent alert items (informational only)
    const breachedRequests = data.recentRequests?.filter((r) => r.breached) ?? [];
    const recentAlerts: Array<{
      id: string;
      title: string;
      severity: 'critical' | 'warning' | 'info';
      time: string;
    }> = breachedRequests.slice(0, 3).map((r) => ({
      id: r.id,
      title: `SLA нарушение: ${r.chatTitle ?? 'Неизвестный чат'}`,
      severity: 'critical' as const,
      time: formatRelativeTime(r.receivedAt),
    }));

    return {
      totalCount: totalAlerts,
      criticalCount,
      warningCount,
      infoCount,
      recentAlerts,
    };
  }, [data]);

  const requestsData = React.useMemo(() => {
    if (!data?.recentRequests || data.recentRequests.length === 0) {
      return emptyRequestsData;
    }

    return data.recentRequests.map((r) => ({
      id: r.id,
      chatName: r.chatTitle ?? 'Неизвестный чат',
      clientName: r.clientUsername ?? 'Неизвестный клиент',
      message: r.messagePreview,
      status: mapRequestStatus(r.status, r.breached),
      time: formatTime(r.receivedAt),
      slaRemaining:
        r.status === 'pending' || r.status === 'in_progress'
          ? calculateSlaRemaining(r.receivedAt)
          : undefined,
    }));
  }, [data]);

  // Loading state
  if (isLoading) {
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
            Панель управления
          </h1>
          <p className="mt-2 text-[var(--buh-foreground-muted)]">
            Обзор показателей SLA и активности за сегодня
            {error && (
              <span className="ml-2 text-sm text-[var(--buh-status-critical)]">
                (данные из кэша)
              </span>
            )}
          </p>
        </div>
        <HelpButton section="dashboard" />
      </div>

      {/* Stats Grid - 2x2 layout, grouped by similar height */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 items-stretch">
        {/* Row 1: Tall widgets - SLA Compliance + Active Alerts */}
        <SlaComplianceWidget
          compliance={slaData.compliance}
          compliantCount={slaData.compliantCount}
          violatedCount={slaData.violatedCount}
          className="h-full"
        />

        <ActiveAlertsWidget
          totalCount={alertsData.totalCount}
          criticalCount={alertsData.criticalCount}
          warningCount={alertsData.warningCount}
          infoCount={alertsData.infoCount}
          recentAlerts={alertsData.recentAlerts}
          className="h-full"
        />

        {/* Row 2: Medium widgets - Response Time + Violations */}
        <ResponseTimeWidget
          averageTime={responseTimeData.averageTime}
          trend={responseTimeData.trend}
          chartData={responseTimeData.chartData}
          onClick={() => router.push('/analytics')}
          className="h-full"
        />

        <ViolationsWidget
          count={violationsData.count}
          yesterdayCount={violationsData.yesterdayCount}
          last7Days={violationsData.last7Days}
          className="h-full"
        />
      </div>

      {/* Recent Requests Table */}
      <div className="mt-8">
        <RecentRequestsTable requests={requestsData} />
      </div>
    </AdminLayout>
  );
}

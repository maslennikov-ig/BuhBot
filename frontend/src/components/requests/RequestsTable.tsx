'use client';

import * as React from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/layout/GlassCard';
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/ui/SortableHeader';

// ============================================
// TYPES
// ============================================

type RequestStatus = 'pending' | 'in_progress' | 'resolved' | 'violated';

type Request = {
  id: string;
  chatName: string;
  clientName: string;
  message: string;
  status: RequestStatus;
  time: string;
  slaRemaining?: string; // for pending/in_progress
};

type RequestsTableProps = {
  requests: Request[];
  className?: string;
};

// ============================================
// STATUS CONFIG
// ============================================

const statusConfig = {
  pending: {
    label: 'Ожидает',
    icon: Clock,
    color: 'var(--buh-warning)',
    bgColor: 'var(--buh-warning-muted)',
  },
  in_progress: {
    label: 'В работе',
    icon: MessageSquare,
    color: 'var(--buh-info)',
    bgColor: 'var(--buh-info-muted)',
  },
  resolved: {
    label: 'Решено',
    icon: CheckCircle2,
    color: 'var(--buh-success)',
    bgColor: 'var(--buh-success-muted)',
  },
  violated: {
    label: 'Нарушение',
    icon: XCircle,
    color: 'var(--buh-error)',
    bgColor: 'var(--buh-error-muted)',
  },
};

// ============================================
// STATUS BADGE COMPONENT
// ============================================

function StatusBadge({ status }: { status: RequestStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function RequestsTable({
  requests,
  className,
}: RequestsTableProps) {
  // Initialize table sorting (default: sort by time descending)
  const { sortedData, requestSort, getSortIcon } = useTableSort(
    requests,
    'time',
    'desc'
  );

  return (
    <GlassCard
      variant="elevated"
      padding="none"
      className={cn('relative overflow-hidden group', className)}
    >
      {/* Gradient accent on hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--buh-border)] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
            <MessageSquare className="h-5 w-5 text-[var(--buh-primary)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--buh-foreground)]">
              Список запросов
            </h3>
            <p className="text-xs text-[var(--buh-foreground-subtle)]">
              Все обращения клиентов
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--buh-border)] bg-[var(--buh-surface-elevated)]/50">
              <SortableHeader
                label="Чат"
                sortDirection={getSortIcon('chatName')}
                onClick={() => requestSort('chatName')}
                className="px-6 py-3"
              />
              <SortableHeader
                label="Клиент"
                sortDirection={getSortIcon('clientName')}
                onClick={() => requestSort('clientName')}
                className="px-6 py-3"
              />
              <SortableHeader
                label="Сообщение"
                sortDirection={getSortIcon('message')}
                onClick={() => requestSort('message')}
                className="px-6 py-3"
              />
              <SortableHeader
                label="Статус"
                sortDirection={getSortIcon('status')}
                onClick={() => requestSort('status')}
                className="px-6 py-3"
              />
              <SortableHeader
                label="Время"
                sortDirection={getSortIcon('time')}
                onClick={() => requestSort('time')}
                className="px-6 py-3"
              />
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--buh-border)]">
            {sortedData.map((request, index) => (
              <tr
                key={request.id}
                className={cn(
                  'transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)]/50',
                  'buh-animate-fade-in-up'
                )}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Chat name */}
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="font-medium text-[var(--buh-foreground)]">
                    {request.chatName}
                  </span>
                </td>

                {/* Client name */}
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="text-sm text-[var(--buh-foreground-muted)]">
                    {request.clientName}
                  </span>
                </td>

                {/* Message (truncated) */}
                <td className="max-w-[200px] px-6 py-4">
                  <p className="truncate text-sm text-[var(--buh-foreground-muted)]">
                    {request.message}
                  </p>
                </td>

                {/* Status */}
                <td className="whitespace-nowrap px-6 py-4">
                  <StatusBadge status={request.status} />
                </td>

                {/* Time */}
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-[var(--buh-foreground)]">
                      {request.time}
                    </span>
                    {request.slaRemaining && (
                      <span
                        className={cn(
                          'text-xs',
                          request.status === 'violated'
                            ? 'text-[var(--buh-error)]'
                            : 'text-[var(--buh-foreground-subtle)]'
                        )}
                      >
                        SLA: {request.slaRemaining}
                      </span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <Link
                    href={`/requests/${request.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--buh-foreground-muted)] transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]"
                    title="Открыть запрос"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {requests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)]">
            <MessageSquare className="h-8 w-8 text-[var(--buh-foreground-subtle)]" />
          </div>
          <p className="mt-4 text-sm font-medium text-[var(--buh-foreground)]">
            Нет запросов
          </p>
          <p className="mt-1 text-sm text-[var(--buh-foreground-subtle)]">
            Запросы от клиентов появятся здесь
          </p>
        </div>
      )}
    </GlassCard>
  );
}

export default RequestsTable;

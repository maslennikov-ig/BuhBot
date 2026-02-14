'use client';

import * as React from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/layout/GlassCard';
import {
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  PauseCircle,
  ArrowRightLeft,
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type RequestStatus =
  | 'pending'
  | 'in_progress'
  | 'waiting_client'
  | 'transferred'
  | 'answered'
  | 'escalated'
  | 'closed';

type Request = {
  id: string;
  chatName: string;
  clientName: string;
  message: string;
  status: RequestStatus;
  time: string;
  slaRemaining?: string; // for pending/in_progress
};

type RecentRequestsTableProps = {
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
  answered: {
    label: 'Отвечено',
    icon: CheckCircle2,
    color: 'var(--buh-success)',
    bgColor: 'var(--buh-success-muted)',
  },
  waiting_client: {
    label: 'Ждём клиента',
    icon: PauseCircle,
    color: 'var(--buh-warning)',
    bgColor: 'var(--buh-warning-muted)',
  },
  transferred: {
    label: 'Передано',
    icon: ArrowRightLeft,
    color: 'var(--buh-info)',
    bgColor: 'var(--buh-info-muted)',
  },
  escalated: {
    label: 'Эскалация',
    icon: XCircle,
    color: 'var(--buh-error)',
    bgColor: 'var(--buh-error-muted)',
  },
  closed: {
    label: 'Закрыто',
    icon: Ban,
    color: 'var(--buh-foreground-muted)',
    bgColor: 'var(--buh-card-bg)',
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

export function RecentRequestsTable({ requests, className }: RecentRequestsTableProps) {
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
              Последние запросы
            </h3>
            <p className="text-xs text-[var(--buh-foreground-subtle)]">Последние 10 обращений</p>
          </div>
        </div>
        <Link
          href="/requests"
          className="flex items-center gap-1 text-sm font-medium text-[var(--buh-primary)] transition-colors duration-200 hover:text-[var(--buh-primary-hover)]"
        >
          <span>Все запросы</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--buh-border)] bg-[var(--buh-surface-elevated)]/50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Чат
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Клиент
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Сообщение
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Статус
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Время
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--buh-border)]">
            {requests.map((request, index) => (
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
                  <span className="block truncate text-sm text-[var(--buh-foreground-muted)]">
                    {request.message}
                  </span>
                </td>

                {/* Status */}
                <td className="whitespace-nowrap px-6 py-4">
                  <StatusBadge status={request.status} />
                </td>

                {/* Time */}
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-[var(--buh-foreground)]">{request.time}</span>
                    {request.slaRemaining && (
                      <span
                        className={cn(
                          'text-xs',
                          request.status === 'escalated'
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
          <p className="mt-4 text-sm font-medium text-[var(--buh-foreground)]">Нет запросов</p>
          <p className="mt-1 text-sm text-[var(--buh-foreground-subtle)]">
            Запросы от клиентов появятся здесь
          </p>
        </div>
      )}

      {/* Decorative glow */}
      <div className="absolute -bottom-20 right-1/4 h-40 w-40 rounded-full bg-[var(--buh-primary)] opacity-5 blur-3xl transition-opacity duration-500 group-hover:opacity-10" />
    </GlassCard>
  );
}

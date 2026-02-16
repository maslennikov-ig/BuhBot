'use client';

/**
 * ThreadTimeline - Thread Visualization Component
 *
 * Displays a vertical timeline of all requests in a conversation thread.
 * Shows thread members chronologically with status badges and message previews.
 *
 * @module components/requests/ThreadTimeline
 */

import * as React from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { GlassCard } from '@/components/layout/GlassCard';
import { MessageSquareMore, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  PauseCircle,
  ArrowRightLeft,
  Ban,
} from 'lucide-react';

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

type ThreadTimelineProps = {
  threadId: string;
  currentRequestId: string;
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
    icon: AlertCircle,
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
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </div>
  );
}

// ============================================
// THREAD TIMELINE COMPONENT
// ============================================

export function ThreadTimeline({ threadId, currentRequestId, className }: ThreadTimelineProps) {
  const { data: threadRequests, isLoading, error } = trpc.requests.getThread.useQuery({ threadId });

  if (isLoading) {
    return (
      <GlassCard variant="default" padding="lg" className={cn('buh-hover-lift', className)}>
        <div className="flex items-center gap-3 mb-4">
          <MessageSquareMore className="h-5 w-5 text-[var(--buh-info)]" />
          <h3 className="text-lg font-semibold text-[var(--buh-foreground)]">
            Цепочка обращений
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--buh-accent)]" />
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard variant="default" padding="lg" className={cn('buh-hover-lift', className)}>
        <div className="flex items-center gap-3 mb-4">
          <MessageSquareMore className="h-5 w-5 text-[var(--buh-info)]" />
          <h3 className="text-lg font-semibold text-[var(--buh-foreground)]">
            Цепочка обращений
          </h3>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-[var(--buh-foreground-muted)]">
            Не удалось загрузить цепочку обращений
          </p>
        </div>
      </GlassCard>
    );
  }

  if (!threadRequests || threadRequests.length === 0) {
    return null;
  }

  // If only one request in thread, don't show timeline
  if (threadRequests.length === 1) {
    return null;
  }

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateMessage = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <GlassCard variant="default" padding="lg" className={cn('buh-hover-lift', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-info)]/10 to-[var(--buh-accent)]/10">
          <MessageSquareMore className="h-5 w-5 text-[var(--buh-info)]" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--buh-foreground)]">
            Цепочка обращений
          </h3>
          <p className="text-sm text-[var(--buh-foreground-muted)]">
            {threadRequests.length} {threadRequests.length === 1 ? 'сообщение' : threadRequests.length < 5 ? 'сообщения' : 'сообщений'}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {threadRequests.map((req, i) => {
          const isCurrentRequest = req.id === currentRequestId;

          return (
            <div key={req.id} className="flex gap-3">
              {/* Timeline connector */}
              <div className="flex flex-col items-center pt-1">
                <div
                  className={cn(
                    'w-2.5 h-2.5 rounded-full transition-all duration-200',
                    isCurrentRequest
                      ? 'bg-[var(--buh-primary)] ring-4 ring-[var(--buh-primary)]/20'
                      : 'bg-[var(--buh-foreground-muted)]/30'
                  )}
                />
                {i < threadRequests.length - 1 && (
                  <div className="w-px flex-1 bg-[var(--buh-border)] mt-2 mb-0 min-h-[60px]" />
                )}
              </div>

              {/* Request card */}
              <div className="pb-4 flex-1">
                <Link
                  href={`/requests/${req.id}`}
                  className={cn(
                    'block rounded-lg border p-3 transition-all duration-200',
                    isCurrentRequest
                      ? 'border-[var(--buh-primary)] bg-[var(--buh-primary)]/5 shadow-sm'
                      : 'border-[var(--buh-border)] hover:border-[var(--buh-primary)]/50 hover:bg-[var(--buh-surface-elevated)]'
                  )}
                >
                  {/* Header: Time + Status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-[var(--buh-foreground-muted)]" />
                      <span
                        className={cn(
                          'font-medium',
                          isCurrentRequest
                            ? 'text-[var(--buh-primary)]'
                            : 'text-[var(--buh-foreground)]'
                        )}
                      >
                        {formatTime(req.receivedAt)}
                      </span>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  {/* Message preview */}
                  <p
                    className={cn(
                      'text-sm line-clamp-2',
                      isCurrentRequest
                        ? 'text-[var(--buh-foreground)]'
                        : 'text-[var(--buh-foreground-muted)]'
                    )}
                  >
                    {truncateMessage(req.messageText)}
                  </p>

                  {/* Client username */}
                  {req.clientUsername && (
                    <p className="text-xs text-[var(--buh-foreground-subtle)] mt-1">
                      @{req.clientUsername}
                    </p>
                  )}

                  {/* Current indicator */}
                  {isCurrentRequest && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--buh-primary)]">
                      Текущее обращение
                    </div>
                  )}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

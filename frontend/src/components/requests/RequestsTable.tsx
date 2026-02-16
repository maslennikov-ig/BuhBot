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
  MoreHorizontal,
  Trash2,
  AlertCircle,
  PauseCircle,
  ArrowRightLeft,
  Ban,
  MessageSquareMore,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc';

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
  responseTimeMinutes?: number | null; // response time in minutes
  responseMessage?: string | null; // accountant's response text
  responseUsername?: string | null; // accountant's username
  threadId?: string | null; // conversation thread ID
  clientTier?: string | null; // client tier (gh-76)
};

type RequestsTableProps = {
  requests: Request[];
  className?: string;
  onRefresh?: () => void;
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
// ACTION MENU COMPONENT
// ============================================

type ActionMenuProps = {
  requestId: string;
  currentStatus: RequestStatus;
  onRefresh?: () => void;
};

function ActionMenu({ requestId, currentStatus, onRefresh }: ActionMenuProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const apiStatus = currentStatus;

  const updateMutation = trpc.requests.update.useMutation({
    onSuccess: () => {
      onRefresh?.();
    },
  });

  const deleteMutation = trpc.requests.delete.useMutation({
    onSuccess: () => {
      setShowDeleteConfirm(false);
      onRefresh?.();
    },
  });

  const handleStatusChange = (newStatus: RequestStatus) => {
    updateMutation.mutate({ id: requestId, status: newStatus });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: requestId });
  };

  const isLoading = updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex items-center gap-1">
      {/* View button */}
      <Link
        href={`/requests/${requestId}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--buh-foreground-muted)] transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]"
        title="Открыть запрос"
      >
        <ExternalLink className="h-4 w-4" />
      </Link>

      {/* Quick complete button */}
      {apiStatus !== 'answered' && (
        <button
          onClick={() => handleStatusChange('answered')}
          disabled={isLoading}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--buh-success)] transition-colors duration-200 hover:bg-[var(--buh-success)]/10"
          title="Отметить выполненным"
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
      )}

      {/* More actions dropdown - uses Portal so renders above all content */}
      <DropdownMenu onOpenChange={(open) => !open && setShowDeleteConfirm(false)}>
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--buh-foreground-muted)] transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]"
            title="Ещё действия"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-[var(--buh-foreground-muted)]">
            Статус
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => handleStatusChange('pending')}
            disabled={isLoading || apiStatus === 'pending'}
            className="cursor-pointer"
          >
            <Clock className="h-3.5 w-3.5" />
            Ожидает
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleStatusChange('in_progress')}
            disabled={isLoading || apiStatus === 'in_progress'}
            className="cursor-pointer"
          >
            <AlertCircle className="h-3.5 w-3.5" />В работе
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleStatusChange('answered')}
            disabled={isLoading || apiStatus === 'answered'}
            className="cursor-pointer text-[var(--buh-success)]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Выполнено
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleStatusChange('escalated')}
            disabled={isLoading || apiStatus === 'escalated'}
            className="cursor-pointer text-[var(--buh-warning)]"
          >
            <XCircle className="h-3.5 w-3.5" />
            Эскалация
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {!showDeleteConfirm ? (
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setShowDeleteConfirm(true);
              }}
              className="cursor-pointer text-[var(--buh-danger)] focus:text-[var(--buh-danger)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить
            </DropdownMenuItem>
          ) : (
            <div className="p-2">
              <p className="text-xs text-[var(--buh-foreground-muted)] mb-2">Удалить запрос?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="flex-1 h-7 text-xs"
                >
                  Да
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isLoading}
                  className="flex-1 h-7 text-xs"
                >
                  Нет
                </Button>
              </div>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function RequestsTable({ requests, className, onRefresh }: RequestsTableProps) {
  // Initialize table sorting (default: sort by time descending)
  const { sortedData, requestSort, getSortIcon } = useTableSort(requests, 'time', 'desc');

  return (
    <GlassCard variant="elevated" padding="none" className={cn('relative group', className)}>
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
            <p className="text-xs text-[var(--buh-foreground-subtle)]">Все обращения клиентов</p>
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
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Ответ
              </th>
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[var(--buh-foreground)]">
                      {request.chatName}
                    </span>
                    {(['vip', 'premium'].includes(request.clientTier?.toLowerCase() ?? '')) && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold"
                        style={{
                          color: request.clientTier?.toLowerCase() === 'premium' ? '#b45309' : '#7c3aed',
                          backgroundColor: request.clientTier?.toLowerCase() === 'premium' ? '#fef3c7' : '#ede9fe',
                        }}
                        title={request.clientTier?.toLowerCase() === 'premium' ? 'Premium клиент' : 'VIP клиент'}
                      >
                        <Crown className="h-3 w-3" />
                        {request.clientTier?.toLowerCase() === 'premium' ? 'P' : 'V'}
                      </span>
                    )}
                  </div>
                </td>

                {/* Client name */}
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="text-sm text-[var(--buh-foreground-muted)]">
                    {request.clientName}
                  </span>
                </td>

                {/* Message (truncated) */}
                <td className="max-w-[200px] px-6 py-4">
                  <div className="flex items-center gap-2">
                    {request.threadId && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={`/requests/${request.id}`}
                              className="flex-shrink-0 text-[var(--buh-info)] hover:text-[var(--buh-accent)] transition-colors duration-200"
                            >
                              <MessageSquareMore className="h-4 w-4" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Часть цепочки обращений</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <span className="block truncate text-sm text-[var(--buh-foreground-muted)]">
                      {request.message}
                    </span>
                  </div>
                </td>

                {/* Status */}
                <td className="whitespace-nowrap px-6 py-4">
                  <StatusBadge status={request.status} />
                </td>

                {/* Response message */}
                <td className="max-w-[200px] px-4 py-4">
                  {request.responseMessage ? (
                    <div className="space-y-1">
                      <span className="block truncate text-sm text-[var(--buh-foreground-muted)]">
                        {request.responseMessage}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-[var(--buh-foreground-subtle)]">
                        {request.responseUsername && <span>@{request.responseUsername}</span>}
                        {request.responseTimeMinutes !== null &&
                          request.responseTimeMinutes !== undefined && (
                            <span className="text-[var(--buh-success)]">
                              • {request.responseTimeMinutes} мин
                            </span>
                          )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--buh-foreground-subtle)]">—</span>
                  )}
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
                  <ActionMenu
                    requestId={request.id}
                    currentStatus={request.status}
                    onRefresh={onRefresh}
                  />
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
    </GlassCard>
  );
}

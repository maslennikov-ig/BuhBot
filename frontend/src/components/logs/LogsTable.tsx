'use client';

import * as React from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/layout/GlassCard';
import {
  FileWarning,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  CheckCircle2,
  PlayCircle,
  Ban,
  AlertTriangle,
  Info,
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
import { trpc } from '@/lib/trpc';
import { StatusBadge } from './StatusBadge';

// ============================================
// TYPES
// ============================================

type ErrorStatus = 'new' | 'in_progress' | 'resolved' | 'ignored';
type ErrorLevel = 'error' | 'warn' | 'info';

type ErrorLog = {
  id: string;
  timestamp: string;
  level: ErrorLevel;
  service: string;
  message: string;
  occurrenceCount: number;
  status: ErrorStatus;
  totalOccurrences?: number; // For grouped view
};

type LogsTableProps = {
  errors: ErrorLog[];
  viewMode: 'grouped' | 'flat';
  className?: string;
  onRefresh?: () => void;
};

// ============================================
// LEVEL CONFIG
// ============================================

const levelConfig = {
  error: {
    label: 'Error',
    icon: AlertTriangle,
    color: 'var(--buh-error)',
    bgColor: 'var(--buh-error-muted)',
  },
  warn: {
    label: 'Warning',
    icon: FileWarning,
    color: 'var(--buh-warning)',
    bgColor: 'var(--buh-warning-muted)',
  },
  info: {
    label: 'Info',
    icon: Info,
    color: 'var(--buh-info)',
    bgColor: 'var(--buh-info-muted)',
  },
};

// ============================================
// LEVEL BADGE COMPONENT
// ============================================

function LevelBadge({ level }: { level: ErrorLevel }) {
  const config = levelConfig[level];
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

function ActionMenu({
  errorId,
  currentStatus,
  onRefresh,
}: {
  errorId: string;
  currentStatus: ErrorStatus;
  onRefresh?: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const utils = trpc.useUtils();

  const { mutate: updateStatus, isPending: isUpdating } = trpc.logs.updateStatus.useMutation({
    onSuccess: () => {
      utils.logs.invalidate();
      onRefresh?.();
    },
  });

  const { mutate: deleteError, isPending: isDeleting } = trpc.logs.delete.useMutation({
    onSuccess: () => {
      utils.logs.invalidate();
      onRefresh?.();
      setShowDeleteConfirm(false);
    },
  });

  const isLoading = isUpdating || isDeleting;

  const handleStatusChange = (newStatus: ErrorStatus) => {
    if (newStatus === currentStatus) return;
    updateStatus({ id: errorId, status: newStatus });
  };

  const handleDelete = () => {
    deleteError({ id: errorId });
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu onOpenChange={(open) => !open && setShowDeleteConfirm(false)}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isLoading}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Действия</DropdownMenuLabel>

          <DropdownMenuItem asChild>
            <Link href={`/logs/${errorId}`} className="flex cursor-pointer items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              Подробности
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Изменить статус</DropdownMenuLabel>

          <DropdownMenuItem
            onClick={() => handleStatusChange('in_progress')}
            disabled={isLoading || currentStatus === 'in_progress'}
            className="cursor-pointer text-[var(--buh-warning)]"
          >
            <PlayCircle className="h-3.5 w-3.5" />В работе
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleStatusChange('resolved')}
            disabled={isLoading || currentStatus === 'resolved'}
            className="cursor-pointer text-[var(--buh-success)]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Решено
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleStatusChange('ignored')}
            disabled={isLoading || currentStatus === 'ignored'}
            className="cursor-pointer text-[var(--buh-foreground-subtle)]"
          >
            <Ban className="h-3.5 w-3.5" />
            Игнорировать
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
              <p className="mb-2 text-xs text-[var(--buh-foreground-muted)]">Удалить запись?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="h-7 flex-1 text-xs"
                >
                  Да
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isLoading}
                  className="h-7 flex-1 text-xs"
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

export function LogsTable({ errors, viewMode, className, onRefresh }: LogsTableProps) {
  // Initialize table sorting (default: sort by timestamp descending)
  const { sortedData, requestSort, getSortIcon } = useTableSort(errors, 'timestamp', 'desc');

  return (
    <GlassCard variant="elevated" padding="none" className={cn('group relative', className)}>
      {/* Gradient accent on hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--buh-border)] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
            <FileWarning className="h-5 w-5 text-[var(--buh-primary)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--buh-foreground)]">
              {viewMode === 'grouped' ? 'Группы ошибок' : 'Все ошибки'}
            </h3>
            <p className="text-xs text-[var(--buh-foreground-subtle)]">
              {viewMode === 'grouped' ? 'Сгруппированные по fingerprint' : 'Полный список записей'}
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
                label="Время"
                sortDirection={getSortIcon('timestamp')}
                onClick={() => requestSort('timestamp')}
                className="px-6 py-3"
              />
              <SortableHeader
                label="Уровень"
                sortDirection={getSortIcon('level')}
                onClick={() => requestSort('level')}
                className="px-6 py-3"
              />
              <SortableHeader
                label="Сервис"
                sortDirection={getSortIcon('service')}
                onClick={() => requestSort('service')}
                className="px-6 py-3"
              />
              <SortableHeader
                label="Сообщение"
                sortDirection={getSortIcon('message')}
                onClick={() => requestSort('message')}
                className="px-6 py-3"
              />
              {viewMode === 'grouped' && (
                <SortableHeader
                  label="Повторений"
                  sortDirection={getSortIcon('totalOccurrences')}
                  onClick={() => requestSort('totalOccurrences')}
                  className="px-6 py-3"
                />
              )}
              <SortableHeader
                label="Статус"
                sortDirection={getSortIcon('status')}
                onClick={() => requestSort('status')}
                className="px-6 py-3"
              />
              <th className="min-w-[120px] whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--buh-border)]">
            {sortedData.map((error, index) => (
              <tr
                key={error.id}
                className={cn(
                  'buh-animate-fade-in-up transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)]/50'
                )}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Timestamp */}
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="text-sm text-[var(--buh-foreground)]">
                    {new Date(error.timestamp).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </td>

                {/* Level */}
                <td className="whitespace-nowrap px-6 py-4">
                  <LevelBadge level={error.level} />
                </td>

                {/* Service */}
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="text-sm text-[var(--buh-foreground-muted)]">
                    {error.service}
                  </span>
                </td>

                {/* Message (truncated with hover) */}
                <td className="max-w-[300px] px-6 py-4">
                  <span
                    className="block truncate text-sm text-[var(--buh-foreground-muted)]"
                    title={error.message}
                  >
                    {error.message}
                  </span>
                </td>

                {/* Occurrences (grouped view only) */}
                {viewMode === 'grouped' && (
                  <td className="whitespace-nowrap px-6 py-4">
                    <div
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--buh-surface-elevated)',
                        color: 'var(--buh-foreground)',
                      }}
                    >
                      <span>{error.totalOccurrences || error.occurrenceCount}</span>
                    </div>
                  </td>
                )}

                {/* Status */}
                <td className="whitespace-nowrap px-6 py-4">
                  <StatusBadge status={error.status} />
                </td>

                {/* Actions */}
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <ActionMenu
                    errorId={error.id}
                    currentStatus={error.status}
                    onRefresh={onRefresh}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {errors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)]">
            <FileWarning className="h-8 w-8 text-[var(--buh-foreground-subtle)]" />
          </div>
          <p className="mt-4 text-sm font-medium text-[var(--buh-foreground)]">Нет записей</p>
          <p className="mt-1 text-sm text-[var(--buh-foreground-subtle)]">
            Логи ошибок появятся здесь
          </p>
        </div>
      )}
    </GlassCard>
  );
}

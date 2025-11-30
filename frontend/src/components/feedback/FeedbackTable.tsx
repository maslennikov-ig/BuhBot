'use client';

import * as React from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/layout/GlassCard';
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Star,
  Download,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/ui/SortableHeader';

// ============================================
// TYPES
// ============================================

export type FeedbackEntry = {
  id: string;
  chatId: string;
  chatTitle: string | null;
  clientUsername: string | null;
  accountantUsername: string | null;
  rating: number;
  comment: string | null;
  submittedAt: Date;
  surveyId: string | null;
  surveyQuarter: string | null;
};

export type FeedbackFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  minRating?: number;
  maxRating?: number;
};

export type FeedbackPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type FeedbackTableProps = {
  entries: FeedbackEntry[];
  pagination: FeedbackPagination;
  filters: FeedbackFilters;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onFiltersChange: (filters: FeedbackFilters) => void;
  onExportCsv: () => void;
  className?: string;
};

// ============================================
// STAR RATING COMPONENT
// ============================================

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const starSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            starSize,
            star <= rating
              ? 'fill-[var(--buh-warning)] text-[var(--buh-warning)]'
              : 'fill-transparent text-[var(--buh-foreground-subtle)]'
          )}
        />
      ))}
    </div>
  );
}

// ============================================
// DATE INPUT COMPONENT
// ============================================

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Date;
  onChange: (date?: Date) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-[var(--buh-foreground-muted)]">
        {label}
      </label>
      <input
        type="date"
        value={value ? value.toISOString().split('T')[0] : ''}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : undefined)}
        className={cn(
          'h-8 rounded-md border border-[var(--buh-border)] bg-[var(--buh-surface)] px-2 text-sm',
          'text-[var(--buh-foreground)]',
          'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]',
          'transition-all duration-200'
        )}
      />
    </div>
  );
}

// ============================================
// RATING FILTER COMPONENT
// ============================================

function RatingFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (rating?: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-[var(--buh-foreground-muted)]">
        {label}
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className={cn(
          'h-8 rounded-md border border-[var(--buh-border)] bg-[var(--buh-surface)] px-2 text-sm',
          'text-[var(--buh-foreground)]',
          'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]',
          'transition-all duration-200'
        )}
      >
        <option value="">Все</option>
        {[1, 2, 3, 4, 5].map((r) => (
          <option key={r} value={r}>
            {r} {r === 1 ? 'звезда' : r < 5 ? 'звезды' : 'звезд'}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function TableSkeleton() {
  return (
    <div className="divide-y divide-[var(--buh-border)]">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--buh-card-bg)]" />
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--buh-card-bg)]" />
          <div className="h-4 w-28 animate-pulse rounded bg-[var(--buh-card-bg)]" />
          <div className="h-4 w-20 animate-pulse rounded bg-[var(--buh-card-bg)]" />
          <div className="h-4 w-40 animate-pulse rounded bg-[var(--buh-card-bg)]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--buh-card-bg)]" />
        </div>
      ))}
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function FeedbackTable({
  entries,
  pagination,
  filters,
  isLoading = false,
  onPageChange,
  onFiltersChange,
  onExportCsv,
  className,
}: FeedbackTableProps) {
  const [showFilters, setShowFilters] = React.useState(false);

  // Sorting
  const { sortedData, requestSort, getSortIcon } = useTableSort(entries, 'submittedAt', 'desc');

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const truncateText = (text: string | null, maxLength: number = 50) => {
    if (!text) return '-';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  return (
    <GlassCard
      variant="elevated"
      padding="none"
      className={cn('relative overflow-hidden group', className)}
    >
      {/* Gradient accent on hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[var(--buh-border)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
            <MessageSquare className="h-5 w-5 text-[var(--buh-primary)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--buh-foreground)]">
              Обратная связь
            </h3>
            <p className="text-xs text-[var(--buh-foreground-subtle)]">
              {pagination.totalItems} записей
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium',
              'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]',
              'transition-all duration-200',
              showFilters && 'bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground)]'
            )}
          >
            <Filter className="h-4 w-4" />
            <span>Фильтры</span>
          </button>
          <button
            onClick={onExportCsv}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium',
              'bg-[var(--buh-primary)] text-white hover:bg-[var(--buh-primary-hover)]',
              'transition-all duration-200'
            )}
          >
            <Download className="h-4 w-4" />
            <span>Экспорт CSV</span>
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="flex flex-wrap items-end gap-4 border-b border-[var(--buh-border)] bg-[var(--buh-surface-elevated)]/50 px-6 py-4">
          <DateInput
            label="Дата от"
            value={filters.dateFrom}
            onChange={(date) => onFiltersChange({ ...filters, dateFrom: date })}
          />
          <DateInput
            label="Дата до"
            value={filters.dateTo}
            onChange={(date) => onFiltersChange({ ...filters, dateTo: date })}
          />
          <RatingFilter
            label="Мин. оценка"
            value={filters.minRating}
            onChange={(rating) => onFiltersChange({ ...filters, minRating: rating })}
          />
          <RatingFilter
            label="Макс. оценка"
            value={filters.maxRating}
            onChange={(rating) => onFiltersChange({ ...filters, maxRating: rating })}
          />
          <button
            onClick={() => onFiltersChange({})}
            className={cn(
              'h-8 rounded-md px-3 text-sm font-medium',
              'text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]',
              'transition-colors duration-200'
            )}
          >
            Сбросить
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--buh-border)] bg-[var(--buh-surface-elevated)]/50">
              <SortableHeader
                label="Чат"
                sortDirection={getSortIcon('chatTitle')}
                onClick={() => requestSort('chatTitle')}
                className="px-6 font-semibold"
              />
              <SortableHeader
                label="Клиент"
                sortDirection={getSortIcon('clientUsername')}
                onClick={() => requestSort('clientUsername')}
                className="px-6 font-semibold"
              />
              <SortableHeader
                label="Бухгалтер"
                sortDirection={getSortIcon('accountantUsername')}
                onClick={() => requestSort('accountantUsername')}
                className="px-6 font-semibold"
              />
              <SortableHeader
                label="Оценка"
                sortDirection={getSortIcon('rating')}
                onClick={() => requestSort('rating')}
                className="px-6 font-semibold"
              />
              <SortableHeader
                label="Комментарий"
                sortDirection={getSortIcon('comment')}
                onClick={() => requestSort('comment')}
                className="px-6 font-semibold"
              />
              <SortableHeader
                label="Дата"
                sortDirection={getSortIcon('submittedAt')}
                onClick={() => requestSort('submittedAt')}
                className="px-6 font-semibold"
              />
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--buh-border)]">
            {isLoading ? (
              <tr>
                <td colSpan={7}>
                  <TableSkeleton />
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)]">
                      <MessageSquare className="h-8 w-8 text-[var(--buh-foreground-subtle)]" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-[var(--buh-foreground)]">
                      Нет данных
                    </p>
                    <p className="mt-1 text-sm text-[var(--buh-foreground-subtle)]">
                      Отзывы от клиентов появятся здесь
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((entry, index) => (
                <tr
                  key={entry.id}
                  className={cn(
                    'transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)]/50',
                    'buh-animate-fade-in-up'
                  )}
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  {/* Chat name */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="font-medium text-[var(--buh-foreground)]">
                      {entry.chatTitle ?? 'Неизвестный чат'}
                    </span>
                  </td>

                  {/* Client */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm text-[var(--buh-foreground-muted)]">
                      {entry.clientUsername ?? '-'}
                    </span>
                  </td>

                  {/* Accountant */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm text-[var(--buh-foreground-muted)]">
                      {entry.accountantUsername ?? '-'}
                    </span>
                  </td>

                  {/* Rating */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <StarRating rating={entry.rating} />
                  </td>

                  {/* Comment preview */}
                  <td className="max-w-[200px] px-6 py-4">
                    <p className="truncate text-sm text-[var(--buh-foreground-muted)]">
                      {truncateText(entry.comment)}
                    </p>
                  </td>

                  {/* Date */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm text-[var(--buh-foreground)]">
                      {formatDate(entry.submittedAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <Link
                      href={`/feedback/${entry.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--buh-foreground-muted)] transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]"
                      title="Подробнее"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--buh-border)] px-6 py-4">
          <p className="text-sm text-[var(--buh-foreground-muted)]">
            Страница {pagination.page} из {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]',
                'transition-all duration-200',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]',
                'transition-all duration-200',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Decorative glow */}
      <div className="absolute -bottom-20 right-1/4 h-40 w-40 rounded-full bg-[var(--buh-primary)] opacity-5 blur-3xl transition-opacity duration-500 group-hover:opacity-10" />
    </GlassCard>
  );
}

export default FeedbackTable;

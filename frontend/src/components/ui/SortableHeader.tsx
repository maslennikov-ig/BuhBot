'use client';

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableHeaderProps {
  label: string;
  sortDirection: 'asc' | 'desc' | null;
  onClick: () => void;
  className?: string;
}

/**
 * Sortable table header with sort indicator
 *
 * @example
 * ```tsx
 * <SortableHeader
 *   label="Имя"
 *   sortDirection={getSortIcon('name')}
 *   onClick={() => requestSort('name')}
 * />
 * ```
 */
export function SortableHeader({ label, sortDirection, onClick, className }: SortableHeaderProps) {
  return (
    <th
      onClick={onClick}
      className={cn(
        'cursor-pointer select-none transition-colors hover:bg-[var(--buh-surface-elevated)]',
        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--buh-foreground-muted)]',
        className
      )}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <span className="inline-flex flex-col">
          {sortDirection === null ? (
            <ChevronsUpDown className="h-4 w-4 opacity-30" />
          ) : sortDirection === 'asc' ? (
            <ChevronUp className="h-4 w-4 text-[var(--buh-primary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--buh-primary)]" />
          )}
        </span>
      </div>
    </th>
  );
}

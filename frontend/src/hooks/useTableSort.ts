'use client';

import { useState, useMemo, useCallback } from 'react';

type SortDirection = 'asc' | 'desc';

interface SortConfig<T> {
  key: keyof T | null;
  direction: SortDirection;
}

interface UseTableSortReturn<T> {
  sortConfig: SortConfig<T>;
  sortedData: T[];
  requestSort: (key: keyof T) => void;
  getSortIcon: (key: keyof T) => 'asc' | 'desc' | null;
}

/**
 * Generic hook for client-side table sorting
 *
 * @param data - Array of items to sort
 * @param defaultSortKey - Initial sort column (optional)
 * @param defaultDirection - Initial sort direction (default: 'asc')
 * @returns Sorted data and sort controls
 *
 * @example
 * ```tsx
 * const { sortedData, requestSort, getSortIcon } = useTableSort(users, 'name');
 *
 * <th onClick={() => requestSort('name')}>
 *   Name <SortIndicator direction={getSortIcon('name')} />
 * </th>
 * ```
 */
export function useTableSort<T extends Record<string, unknown>>(
  data: T[],
  defaultSortKey?: keyof T,
  defaultDirection: SortDirection = 'asc'
): UseTableSortReturn<T> {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: defaultSortKey ?? null,
    direction: defaultDirection,
  });

  const requestSort = useCallback((key: keyof T) => {
    setSortConfig((current) => {
      if (current.key === key) {
        // Toggle direction if same column
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      // New column, default to ascending
      return { key, direction: 'asc' };
    });
  }, []);

  const getSortIcon = useCallback(
    (key: keyof T): 'asc' | 'desc' | null => {
      if (sortConfig.key !== key) return null;
      return sortConfig.direction;
    },
    [sortConfig]
  );

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1;
      if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1;

      // Compare based on type
      let comparison = 0;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue, 'ru', { sensitivity: 'base' });
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        // Fallback: convert to string
        comparison = String(aValue).localeCompare(String(bValue), 'ru');
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [data, sortConfig]);

  return {
    sortConfig,
    sortedData,
    requestSort,
    getSortIcon,
  };
}

'use client';

/**
 * HolidayCalendar Component
 *
 * Manages federal holidays for SLA calculations with premium BuhBot design.
 * Allows admins to view, add, remove holidays and seed Russian federal holidays.
 *
 * @module components/settings/HolidayCalendar
 */

import { useState } from 'react';
import { Calendar, Plus, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/layout/GlassCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

/**
 * Holiday data structure from API
 * Note: dates come as strings from JSON serialization
 */
interface Holiday {
  id: string;
  date: Date | string;
  name: string;
  year: number;
  createdAt: Date | string;
}

/**
 * Format date for short display DD.MM
 * Accepts both Date objects and ISO strings
 */
function formatDateShort(date: Date | string): string {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}`;
}

/**
 * Generate year options for selector
 */
function generateYearOptions(): number[] {
  const years: number[] = [];
  for (let year = 2024; year <= 2030; year++) {
    years.push(year);
  }
  return years;
}

/**
 * HolidayCalendar component props
 */
interface HolidayCalendarProps {
  /** Optional CSS class name */
  className?: string;
}

/**
 * HolidayCalendar - Admin component for managing federal holidays
 *
 * Features:
 * - Year selector (2024-2030)
 * - List of holidays for selected year with delete functionality
 * - Add holiday form with date and name inputs
 * - Seed Russian holidays button
 */
export function HolidayCalendar({ className }: HolidayCalendarProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(
    currentYear >= 2024 && currentYear <= 2030 ? currentYear : 2024
  );
  const [newHolidayDate, setNewHolidayDate] = useState<string>('');
  const [newHolidayName, setNewHolidayName] = useState<string>('');

  // Query holidays for selected year
  const {
    data: holidaysData,
    isLoading: isLoadingHolidays,
    refetch,
  } = trpc.settings.getGlobalHolidays.useQuery({ year: selectedYear });

  // Mutations
  const addHolidayMutation = trpc.settings.addGlobalHoliday.useMutation({
    onSuccess: () => {
      void refetch();
      setNewHolidayDate('');
      setNewHolidayName('');
    },
  });

  const removeHolidayMutation = trpc.settings.removeGlobalHoliday.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const seedHolidaysMutation = trpc.settings.seedRussianHolidays.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const holidays: Holiday[] = holidaysData?.items ?? [];
  const yearOptions = generateYearOptions();

  const isAddingHoliday = addHolidayMutation.isPending;
  const isRemovingHoliday = removeHolidayMutation.isPending;
  const isSeedingHolidays = seedHolidaysMutation.isPending;
  const isAnyLoading = isLoadingHolidays || isAddingHoliday || isRemovingHoliday || isSeedingHolidays;

  /**
   * Handle year selection change
   */
  function handleYearChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const year = parseInt(event.target.value, 10);
    setSelectedYear(year);
  }

  /**
   * Handle add holiday form submission
   */
  function handleAddHoliday(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newHolidayDate || !newHolidayName.trim()) {
      return;
    }

    const date = new Date(newHolidayDate);
    addHolidayMutation.mutate({
      date,
      name: newHolidayName.trim(),
      year: selectedYear,
    });
  }

  /**
   * Handle remove holiday
   */
  function handleRemoveHoliday(holiday: Holiday) {
    removeHolidayMutation.mutate({
      date: new Date(holiday.date),
    });
  }

  /**
   * Handle seed Russian holidays
   */
  function handleSeedHolidays() {
    seedHolidaysMutation.mutate({
      year: selectedYear,
    });
  }

  return (
    <GlassCard variant="default" padding="lg" className={cn('buh-hover-lift', className)}>
      {/* Header with icon */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--buh-accent-secondary)] to-[var(--buh-error)] shadow-lg">
          <Calendar className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--buh-foreground)]">
            Календарь праздников
          </h2>
          <p className="text-sm text-[var(--buh-foreground-muted)]">
            Федеральные праздники для расчета SLA
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Year Selector & Seed Button */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <Label htmlFor="year-select" className="text-[var(--buh-foreground-muted)]">
              Год
            </Label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={handleYearChange}
              disabled={isAnyLoading}
              className={cn(
                'h-10 w-28 rounded-lg border px-3 py-2 text-sm font-medium',
                'bg-[var(--buh-surface)] border-[var(--buh-border)] text-[var(--buh-foreground)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent)] focus:border-[var(--buh-accent)]',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-all duration-200'
              )}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleSeedHolidays}
            disabled={isAnyLoading}
            className={cn(
              'gap-2 border-[var(--buh-accent-secondary)] text-[var(--buh-accent-secondary)]',
              'hover:bg-[var(--buh-accent-secondary-glow)] hover:border-[var(--buh-accent-secondary)]',
              'transition-all duration-200'
            )}
          >
            <Sparkles className="h-4 w-4" />
            {isSeedingHolidays ? 'Загрузка...' : `Заполнить праздниками РФ`}
          </Button>
        </div>

        {/* Add Holiday Form */}
        <form onSubmit={handleAddHoliday} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="holiday-date" className="text-[var(--buh-foreground)]">
              Дата
            </Label>
            <Input
              id="holiday-date"
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              disabled={isAnyLoading}
              required
              className={cn(
                'w-40',
                'bg-[var(--buh-surface)] border-[var(--buh-border)]',
                'focus:border-[var(--buh-accent)] focus:ring-[var(--buh-accent-glow)]'
              )}
            />
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
            <Label htmlFor="holiday-name" className="text-[var(--buh-foreground)]">
              Название
            </Label>
            <Input
              id="holiday-name"
              type="text"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              placeholder="Введите название праздника"
              disabled={isAnyLoading}
              required
              maxLength={100}
              className={cn(
                'bg-[var(--buh-surface)] border-[var(--buh-border)]',
                'focus:border-[var(--buh-accent)] focus:ring-[var(--buh-accent-glow)]'
              )}
            />
          </div>
          <Button
            type="submit"
            disabled={isAnyLoading || !newHolidayDate || !newHolidayName.trim()}
            className={cn(
              'gap-2',
              'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
              'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Plus className="h-4 w-4" />
            {isAddingHoliday ? 'Добавление...' : 'Добавить'}
          </Button>
        </form>

        {/* Holidays Table */}
        <div className="rounded-xl border border-[var(--buh-border)] overflow-hidden bg-[var(--buh-surface)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--buh-border)] bg-[var(--buh-surface-overlay)]">
                <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-subtle)]">
                  Дата
                </th>
                <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-subtle)]">
                  Название
                </th>
                <th className="h-12 px-4 text-right align-middle text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-subtle)]">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoadingHolidays ? (
                // Loading skeleton
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="border-b border-[var(--buh-border)] last:border-b-0">
                    <td className="h-14 px-4">
                      <div className="h-5 w-16 rounded buh-shimmer" />
                    </td>
                    <td className="h-14 px-4">
                      <div className="h-5 w-48 rounded buh-shimmer" />
                    </td>
                    <td className="h-14 px-4">
                      <div className="h-8 w-20 rounded buh-shimmer ml-auto" />
                    </td>
                  </tr>
                ))
              ) : holidays.length === 0 ? (
                <tr>
                  <td colSpan={3} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Calendar className="h-8 w-8 text-[var(--buh-foreground-subtle)]" />
                      <p className="text-[var(--buh-foreground-muted)]">
                        Праздников не найдено
                      </p>
                      <p className="text-sm text-[var(--buh-foreground-subtle)]">
                        Добавьте праздник или заполните федеральными праздниками РФ
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                holidays.map((holiday, index) => (
                  <tr
                    key={holiday.id}
                    className={cn(
                      'border-b border-[var(--buh-border)] last:border-b-0',
                      'transition-colors duration-150',
                      'hover:bg-[var(--buh-surface-overlay)]',
                      'buh-animate-fade-in-up'
                    )}
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <td className="h-14 px-4 align-middle">
                      <span className="inline-flex items-center gap-2 font-mono text-sm font-medium text-[var(--buh-foreground)]">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-[var(--buh-accent-glow)] text-xs text-[var(--buh-accent)]">
                          {new Date(holiday.date).getDate()}
                        </span>
                        {formatDateShort(holiday.date)}
                      </span>
                    </td>
                    <td className="h-14 px-4 align-middle">
                      <span className="text-[var(--buh-foreground)]">{holiday.name}</span>
                    </td>
                    <td className="h-14 px-4 align-middle text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveHoliday(holiday)}
                        disabled={isAnyLoading}
                        className={cn(
                          'gap-1.5 text-[var(--buh-foreground-muted)]',
                          'hover:text-[var(--buh-error)] hover:bg-[var(--buh-error-muted)]',
                          'transition-all duration-200'
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                        {isRemovingHoliday ? '...' : 'Удалить'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        {!isLoadingHolidays && holidays.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Всего праздников в {selectedYear} году:{' '}
              <span className="font-semibold text-[var(--buh-accent)]">{holidays.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--buh-accent)] animate-pulse" />
              <span className="text-xs text-[var(--buh-foreground-subtle)]">
                Праздники исключаются из расчета SLA
              </span>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

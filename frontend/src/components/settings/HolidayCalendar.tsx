'use client';

/**
 * HolidayCalendar Component
 *
 * Manages federal holidays for SLA calculations.
 * Allows admins to view, add, remove holidays and seed Russian federal holidays.
 *
 * @module components/settings/HolidayCalendar
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';

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
 * Format date to Russian format DD.MM.YYYY
 * Accepts both Date objects and ISO strings
 */
function formatDateRu(date: Date | string): string {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
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
    <Card className={className}>
      <CardHeader>
        <CardTitle>Календарь праздников</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Year Selector */}
        <div className="flex items-center gap-4">
          <Label htmlFor="year-select">Год</Label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={handleYearChange}
            disabled={isAnyLoading}
            className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={handleSeedHolidays}
            disabled={isAnyLoading}
          >
            {isSeedingHolidays ? 'Загрузка...' : `Заполнить праздниками РФ ${selectedYear}`}
          </Button>
        </div>

        {/* Add Holiday Form */}
        <form onSubmit={handleAddHoliday} className="flex items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="holiday-date">Дата</Label>
            <Input
              id="holiday-date"
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              disabled={isAnyLoading}
              required
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <Label htmlFor="holiday-name">Название</Label>
            <Input
              id="holiday-name"
              type="text"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              placeholder="Введите название праздника"
              disabled={isAnyLoading}
              required
              maxLength={100}
            />
          </div>
          <Button type="submit" disabled={isAnyLoading || !newHolidayDate || !newHolidayName.trim()}>
            {isAddingHoliday ? 'Загрузка...' : 'Добавить'}
          </Button>
        </form>

        {/* Holidays Table */}
        <div className="border rounded-md">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                  Дата
                </th>
                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                  Название
                </th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoadingHolidays ? (
                <tr>
                  <td colSpan={3} className="h-16 text-center text-muted-foreground">
                    Загрузка...
                  </td>
                </tr>
              ) : holidays.length === 0 ? (
                <tr>
                  <td colSpan={3} className="h-16 text-center text-muted-foreground">
                    Праздников не найдено
                  </td>
                </tr>
              ) : (
                holidays.map((holiday) => (
                  <tr key={holiday.id} className="border-b last:border-b-0">
                    <td className="h-12 px-4 align-middle">
                      {formatDateShort(holiday.date)}
                    </td>
                    <td className="h-12 px-4 align-middle">{holiday.name}</td>
                    <td className="h-12 px-4 align-middle text-right">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveHoliday(holiday)}
                        disabled={isAnyLoading}
                      >
                        {isRemovingHoliday ? 'Загрузка...' : 'Удалить'}
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
          <p className="text-sm text-muted-foreground">
            Всего праздников в {selectedYear} году: {holidays.length}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Clock, Globe, AlertTriangle, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/layout/GlassCard';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

/**
 * Day of week mapping (1=Monday, 7=Sunday per ISO 8601)
 */
const DAYS = [
  { value: 1, label: 'Пн', fullLabel: 'Понедельник' },
  { value: 2, label: 'Вт', fullLabel: 'Вторник' },
  { value: 3, label: 'Ср', fullLabel: 'Среда' },
  { value: 4, label: 'Чт', fullLabel: 'Четверг' },
  { value: 5, label: 'Пт', fullLabel: 'Пятница' },
  { value: 6, label: 'Сб', fullLabel: 'Суббота' },
  { value: 7, label: 'Вс', fullLabel: 'Воскресенье' },
] as const;

/**
 * Form validation schema for working hours settings
 */
const workingHoursSchema = z.object({
  defaultTimezone: z.string().min(1, 'Часовой пояс обязателен'),
  defaultWorkingDays: z
    .array(z.number().min(1).max(7))
    .min(1, 'Выберите хотя бы один рабочий день'),
  defaultStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Формат: ЧЧ:ММ'),
  defaultEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Формат: ЧЧ:ММ'),
  defaultSlaThreshold: z.number().min(1, 'Минимум 1 минута').max(480, 'Максимум 480 минут'),
  maxEscalations: z.number().min(1, 'Минимум 1 эскалация').max(10, 'Максимум 10 эскалаций'),
  escalationIntervalMin: z.number().min(5, 'Минимум 5 минут').max(120, 'Максимум 120 минут'),
});

type WorkingHoursFormData = z.infer<typeof workingHoursSchema>;

/**
 * Default form values for working hours settings
 */
const DEFAULT_VALUES: WorkingHoursFormData = {
  defaultTimezone: 'Europe/Moscow',
  defaultWorkingDays: [1, 2, 3, 4, 5], // Mon-Fri
  defaultStartTime: '09:00',
  defaultEndTime: '18:00',
  defaultSlaThreshold: 60,
  maxEscalations: 3,
  escalationIntervalMin: 30,
};

/**
 * WorkingHoursForm component for configuring global working hours settings
 *
 * This form allows administrators to configure:
 * - Timezone for SLA calculations
 * - Working days of the week
 * - Working hours (start/end times)
 * - SLA threshold in minutes
 * - Escalation settings
 */
export function WorkingHoursForm() {
  const { data: settings, isLoading: isLoadingSettings } =
    trpc.settings.getGlobalSettings.useQuery();

  const updateSettings = trpc.settings.updateGlobalSettings.useMutation({
    onSuccess: () => {
      console.log('Настройки успешно сохранены');
    },
    onError: (error: { message: string }) => {
      console.error('Ошибка сохранения настроек:', error.message);
    },
  });

  const form = useForm<WorkingHoursFormData>({
    resolver: zodResolver(workingHoursSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Pre-fill form when settings are loaded
  React.useEffect(() => {
    if (settings) {
      form.reset({
        defaultTimezone: settings.defaultTimezone ?? DEFAULT_VALUES.defaultTimezone,
        defaultWorkingDays: settings.defaultWorkingDays ?? DEFAULT_VALUES.defaultWorkingDays,
        defaultStartTime: settings.defaultStartTime ?? DEFAULT_VALUES.defaultStartTime,
        defaultEndTime: settings.defaultEndTime ?? DEFAULT_VALUES.defaultEndTime,
        defaultSlaThreshold: settings.defaultSlaThreshold ?? DEFAULT_VALUES.defaultSlaThreshold,
        maxEscalations: settings.maxEscalations ?? DEFAULT_VALUES.maxEscalations,
        escalationIntervalMin:
          settings.escalationIntervalMin ?? DEFAULT_VALUES.escalationIntervalMin,
      });
    }
  }, [settings, form]);

  const onSubmit = (data: WorkingHoursFormData) => {
    updateSettings.mutate(data);
  };

  /**
   * Toggle a day in the working days array
   */
  const toggleDay = (
    currentDays: number[],
    dayValue: number,
    onChange: (days: number[]) => void
  ) => {
    if (currentDays.includes(dayValue)) {
      onChange(currentDays.filter((d) => d !== dayValue));
    } else {
      onChange([...currentDays, dayValue].sort((a, b) => a - b));
    }
  };

  if (isLoadingSettings) {
    return (
      <GlassCard variant="default" padding="lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--buh-primary-muted)]">
            <Settings2 className="h-5 w-5 text-[var(--buh-primary)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--buh-foreground)]">
              Настройки рабочего времени
            </h2>
            <p className="text-sm text-[var(--buh-foreground-muted)]">Загрузка...</p>
          </div>
        </div>
        {/* Loading skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg buh-shimmer" />
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="default" padding="lg" className="buh-hover-lift">
      {/* Header with icon */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)] shadow-lg">
          <Settings2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--buh-foreground)]">
            Настройки рабочего времени
          </h2>
          <p className="text-sm text-[var(--buh-foreground-muted)]">
            Параметры расчета SLA и эскалаций
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Timezone Section */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Timezone */}
            <FormField
              control={form.control}
              name="defaultTimezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-[var(--buh-foreground)]">
                    <Globe className="h-4 w-4 text-[var(--buh-accent)]" />
                    Часовой пояс
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Europe/Moscow"
                      className="bg-[var(--buh-surface)] border-[var(--buh-border)] focus:border-[var(--buh-accent)] focus:ring-[var(--buh-accent-glow)]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[var(--buh-foreground-subtle)]">
                    Часовой пояс для расчета SLA
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* SLA Threshold */}
            <FormField
              control={form.control}
              name="defaultSlaThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-[var(--buh-foreground)]">
                    <AlertTriangle className="h-4 w-4 text-[var(--buh-warning)]" />
                    Порог SLA (минуты)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={480}
                      className="bg-[var(--buh-surface)] border-[var(--buh-border)] focus:border-[var(--buh-accent)] focus:ring-[var(--buh-accent-glow)]"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription className="text-[var(--buh-foreground-subtle)]">
                    Максимальное время ответа (1-480 мин)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Working Days */}
          <FormField
            control={form.control}
            name="defaultWorkingDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[var(--buh-foreground)]">Рабочие дни</FormLabel>
                <FormControl>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => {
                      const isSelected = field.value.includes(day.value);
                      const isWeekend = day.value >= 6;
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(field.value, day.value, field.onChange)}
                          title={day.fullLabel}
                          className={cn(
                            'relative px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--buh-accent)]',
                            'buh-active-press',
                            isSelected
                              ? 'bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)] text-white border-transparent shadow-md'
                              : isWeekend
                                ? 'bg-[var(--buh-surface)] text-[var(--buh-foreground-subtle)] border-[var(--buh-border)] hover:border-[var(--buh-warning)] hover:text-[var(--buh-warning)]'
                                : 'bg-[var(--buh-surface)] text-[var(--buh-foreground-muted)] border-[var(--buh-border)] hover:border-[var(--buh-accent)] hover:text-[var(--buh-accent)]'
                          )}
                        >
                          {day.label}
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--buh-accent)] opacity-75" />
                              <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--buh-accent)]" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </FormControl>
                <FormDescription className="text-[var(--buh-foreground-subtle)]">
                  Выберите дни, когда ведется работа с клиентами
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Working Hours */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Start Time */}
            <FormField
              control={form.control}
              name="defaultStartTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-[var(--buh-foreground)]">
                    <Clock className="h-4 w-4 text-[var(--buh-success)]" />
                    Начало рабочего дня
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      className="bg-[var(--buh-surface)] border-[var(--buh-border)] focus:border-[var(--buh-accent)] focus:ring-[var(--buh-accent-glow)]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[var(--buh-foreground-subtle)]">
                    Время начала (ЧЧ:ММ)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Time */}
            <FormField
              control={form.control}
              name="defaultEndTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-[var(--buh-foreground)]">
                    <Clock className="h-4 w-4 text-[var(--buh-error)]" />
                    Конец рабочего дня
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      className="bg-[var(--buh-surface)] border-[var(--buh-border)] focus:border-[var(--buh-accent)] focus:ring-[var(--buh-accent-glow)]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[var(--buh-foreground-subtle)]">
                    Время окончания (ЧЧ:ММ)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Escalation Settings Section */}
          <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--buh-foreground-subtle)] mb-4">
              Настройки эскалации
            </h3>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Max Escalations */}
              <FormField
                control={form.control}
                name="maxEscalations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[var(--buh-foreground)]">
                      Максимум эскалаций
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        className="bg-[var(--buh-surface)] border-[var(--buh-border)] focus:border-[var(--buh-accent)] focus:ring-[var(--buh-accent-glow)]"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-[var(--buh-foreground-subtle)]">
                      На одно сообщение (1-10)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Escalation Interval */}
              <FormField
                control={form.control}
                name="escalationIntervalMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[var(--buh-foreground)]">
                      Интервал эскалации (мин)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={5}
                        max={120}
                        className="bg-[var(--buh-surface)] border-[var(--buh-border)] focus:border-[var(--buh-accent)] focus:ring-[var(--buh-accent-glow)]"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-[var(--buh-foreground-subtle)]">
                      Между эскалациями (5-120 мин)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className={cn(
                'relative px-8 py-2.5 font-semibold',
                'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
                'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {updateSettings.isPending ? (
                <>
                  <span className="opacity-0">Сохранить настройки</span>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </span>
                </>
              ) : (
                'Сохранить настройки'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </GlassCard>
  );
}

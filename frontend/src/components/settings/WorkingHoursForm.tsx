'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

/**
 * Day of week mapping (1=Monday, 7=Sunday per ISO 8601)
 */
const DAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 7, label: 'Вс' },
] as const;

/**
 * Form validation schema for working hours settings
 */
const workingHoursSchema = z.object({
  defaultTimezone: z.string().min(1, 'Часовой пояс обязателен'),
  defaultWorkingDays: z
    .array(z.number().min(1).max(7))
    .min(1, 'Выберите хотя бы один рабочий день'),
  defaultStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Формат: ЧЧ:ММ'),
  defaultEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Формат: ЧЧ:ММ'),
  defaultSlaThreshold: z
    .number()
    .min(1, 'Минимум 1 минута')
    .max(480, 'Максимум 480 минут'),
  maxEscalations: z
    .number()
    .min(1, 'Минимум 1 эскалация')
    .max(10, 'Максимум 10 эскалаций'),
  escalationIntervalMin: z
    .number()
    .min(5, 'Минимум 5 минут')
    .max(120, 'Максимум 120 минут'),
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
        defaultWorkingDays:
          settings.defaultWorkingDays ?? DEFAULT_VALUES.defaultWorkingDays,
        defaultStartTime:
          settings.defaultStartTime ?? DEFAULT_VALUES.defaultStartTime,
        defaultEndTime: settings.defaultEndTime ?? DEFAULT_VALUES.defaultEndTime,
        defaultSlaThreshold:
          settings.defaultSlaThreshold ?? DEFAULT_VALUES.defaultSlaThreshold,
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
      <Card>
        <CardHeader>
          <CardTitle>Настройки рабочего времени</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <span className="text-muted-foreground">Загрузка...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Настройки рабочего времени</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Timezone */}
            <FormField
              control={form.control}
              name="defaultTimezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Часовой пояс</FormLabel>
                  <FormControl>
                    <Input placeholder="Europe/Moscow" {...field} />
                  </FormControl>
                  <FormDescription>
                    Часовой пояс для расчета SLA (например, Europe/Moscow)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Working Days */}
            <FormField
              control={form.control}
              name="defaultWorkingDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Рабочие дни</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day) => {
                        const isSelected = field.value.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() =>
                              toggleDay(field.value, day.value, field.onChange)
                            }
                            className={`
                              px-3 py-1.5 text-sm font-medium rounded-md border transition-colors
                              ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background text-foreground border-input hover:bg-accent'
                              }
                            `}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Выберите дни, когда ведется работа с клиентами
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Start Time */}
            <FormField
              control={form.control}
              name="defaultStartTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Начало рабочего дня</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormDescription>
                    Время начала рабочего дня (ЧЧ:ММ)
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
                  <FormLabel>Конец рабочего дня</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormDescription>
                    Время окончания рабочего дня (ЧЧ:ММ)
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
                  <FormLabel>Порог SLA (минуты)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={480}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Максимальное время ответа на запрос клиента (1-480 минут)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Max Escalations */}
            <FormField
              control={form.control}
              name="maxEscalations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Максимум эскалаций</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Максимальное количество эскалаций на одно сообщение (1-10)
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
                  <FormLabel>Интервал эскалации (минуты)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={5}
                      max={120}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Интервал между эскалациями (5-120 минут)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="w-full sm:w-auto"
            >
              {updateSettings.isPending
                ? 'Сохранение...'
                : 'Сохранить настройки'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

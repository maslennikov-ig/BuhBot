'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Database, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const formSchema = z.object({
  dataRetentionYears: z.number().min(1).max(10),
});

type FormValues = z.infer<typeof formSchema>;

export function DataRetentionSettingsForm() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.settings.getGlobalSettings.useQuery();
  const updateSettings = trpc.settings.updateGlobalSettings.useMutation({
    onSuccess: () => {
      toast.success('Настройки хранения данных обновлены');
      utils.settings.getGlobalSettings.invalidate();
    },
    onError: (err) => {
      toast.error(`Ошибка: ${err.message}`);
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dataRetentionYears: 3,
    },
  });

  // Update form when data loads
  React.useEffect(() => {
    if (settings) {
      form.reset({
        dataRetentionYears: settings.dataRetentionYears,
      });
    }
  }, [settings, form]);

  const onSubmit = (data: FormValues) => {
    updateSettings.mutate({
      dataRetentionYears: data.dataRetentionYears,
    });
  };

  if (isLoading) {
    return (
      <Card className="buh-card">
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-[var(--buh-primary)]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="buh-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--buh-accent-glow)] flex items-center justify-center text-[var(--buh-accent)]">
            <Database size={20} />
          </div>
          <div>
            <CardTitle>Хранение данных</CardTitle>
            <CardDescription>
              Управление сроками хранения истории сообщений и данных клиентов
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="dataRetentionYears">Период хранения данных</Label>
            <Select
              value={form.watch('dataRetentionYears').toString()}
              onValueChange={(value) =>
                form.setValue('dataRetentionYears', parseInt(value, 10))
              }
            >
              <SelectTrigger className="bg-[var(--buh-surface-elevated)]">
                <SelectValue placeholder="Выберите период" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((years) => (
                  <SelectItem key={years} value={years.toString()}>
                    {years} {years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Данные старше указанного периода будут автоматически удалены из базы данных.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--buh-warning)] bg-[var(--buh-warning)]/10 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[var(--buh-warning)] mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-[var(--buh-warning)]">
                Важно: Автоматическое удаление данных
              </p>
              <ul className="text-sm text-[var(--buh-foreground-muted)] mt-2 space-y-1 list-disc list-inside">
                <li>
                  Сообщения, чаты и связанные данные старше {form.watch('dataRetentionYears')}{' '}
                  {form.watch('dataRetentionYears') === 1
                    ? 'года'
                    : form.watch('dataRetentionYears') < 5
                      ? 'лет'
                      : 'лет'}{' '}
                  будут удалены безвозвратно
                </li>
                <li>Удаление происходит автоматически каждые 24 часа</li>
                <li>
                  Рекомендуется настроить резервное копирование перед изменением этого параметра
                </li>
                <li>Минимальный период: 1 год, максимальный: 10 лет</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="bg-[var(--buh-primary)] hover:bg-[var(--buh-primary-hover)] text-white"
            >
              {updateSettings.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Сохранить
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

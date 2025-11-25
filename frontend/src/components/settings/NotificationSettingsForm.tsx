'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Bell } from 'lucide-react';
import { toast } from 'sonner';

const formSchema = z.object({
  ids: z.string().describe('Comma separated IDs'),
});

type FormValues = z.infer<typeof formSchema>;

export function NotificationSettingsForm() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.settings.getGlobalSettings.useQuery();
  const updateSettings = trpc.settings.updateGlobalSettings.useMutation({
    onSuccess: () => {
      toast.success('Настройки уведомлений обновлены');
      utils.settings.getGlobalSettings.invalidate();
    },
    onError: (err) => {
      toast.error(`Ошибка: ${err.message}`);
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ids: '',
    },
  });

  // Update form when data loads
  React.useEffect(() => {
    if (settings) {
      form.reset({
        ids: settings.leadNotificationIds.join(', '),
      });
    }
  }, [settings, form]);

  const onSubmit = (data: FormValues) => {
    const ids = data.ids
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    updateSettings.mutate({
      leadNotificationIds: ids,
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
            <Bell size={20} />
          </div>
          <div>
            <CardTitle>Уведомления о заявках</CardTitle>
            <CardDescription>
              Куда отправлять уведомления о новых лидах с лендинга
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ids">Telegram ID чатов (через запятую)</Label>
            <Input
              id="ids"
              placeholder="-100123456789, 12345678"
              {...form.register('ids')}
              className="bg-[var(--buh-surface-elevated)]"
            />
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Бот должен быть добавлен в эти чаты.
              <br />
              ID можно узнать через @getmyid_bot или переслав сообщение боту.
            </p>
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

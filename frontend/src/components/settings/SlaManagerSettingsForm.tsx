'use client';

import React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { ManagerMultiSelect } from '@/components/chats/ManagerMultiSelect';
import { TelegramAuthModal } from '@/components/chats/TelegramAuthModal';

const formSchema = z.object({
  ids: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

export function SlaManagerSettingsForm() {
  const [pendingUser, setPendingUser] = React.useState<{ id: string; name: string } | null>(null);
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.settings.getGlobalSettings.useQuery();
  const updateSettings = trpc.settings.updateGlobalSettings.useMutation({
    onSuccess: () => {
      toast.success('Менеджеры SLA уведомлений обновлены');
      utils.settings.getGlobalSettings.invalidate();
    },
    onError: (err) => {
      toast.error(`Ошибка: ${err.message}`);
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ids: [],
    },
  });

  // Update form when data loads
  React.useEffect(() => {
    if (settings) {
      form.reset({
        ids: settings.globalManagerIds,
      });
    }
  }, [settings, form]);

  const watchedIds = useWatch({ control: form.control, name: 'ids' });

  const onSubmit = (data: FormValues) => {
    updateSettings.mutate({
      globalManagerIds: data.ids,
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
            <Shield size={20} />
          </div>
          <div>
            <CardTitle>Менеджеры SLA уведомлений</CardTitle>
            <CardDescription>
              Глобальные получатели SLA-уведомлений. Используются для чатов без назначенных
              менеджеров или бухгалтеров.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <ManagerMultiSelect
              value={watchedIds}
              onChange={(val) => form.setValue('ids', val, { shouldDirty: true })}
              onSelectUserWithoutTelegram={(user) => setPendingUser(user)}
            />
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Глобальные менеджеры для SLA-уведомлений. Используются для чатов без назначенных
              менеджеров.
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

        {/* TelegramAuthModal for users without linked Telegram */}
        <TelegramAuthModal
          open={!!pendingUser}
          user={pendingUser}
          onClose={() => setPendingUser(null)}
          onSuccess={(telegramId) => {
            const current = form.getValues('ids');
            form.setValue('ids', [...current, telegramId], { shouldDirty: true });
            setPendingUser(null);
          }}
        />
      </CardContent>
    </Card>
  );
}

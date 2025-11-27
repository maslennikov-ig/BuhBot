'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, CheckCircle2, AlertCircle, Send, Save } from 'lucide-react';
import { toast } from 'sonner';

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

const profileSchema = z.object({
  fullName: z.string().min(1, 'Имя обязательно'),
  telegramUsername: z
    .string()
    .max(33, 'Максимум 32 символа')
    .refine((val) => !val || /^@?[a-zA-Z0-9_]{5,32}$/.test(val), {
      message: 'Неверный формат (5-32 символа, латиница, цифры, _)',
    })
    .optional()
    .nullable(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileSettingsForm() {
  const { data: user, isLoading, refetch } = trpc.auth.me.useQuery();
  const updateProfile = trpc.auth.updateProfile.useMutation();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: '',
      telegramUsername: '',
    },
  });

  // Reset form when user data is loaded
  React.useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.fullName,
        telegramUsername: user.telegramUsername || '',
      });
    }
  }, [user, form]);

  const onSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(data, {
      onSuccess: () => {
        toast.success('Профиль обновлен');
        refetch();
      },
      onError: (error) => {
        toast.error(`Ошибка обновления: ${error.message}`);
      },
    });
  };

  if (isLoading) {
    return <div className="h-64 rounded-lg buh-shimmer" />;
  }

  return (
    <div className="space-y-6">
      {/* General Profile Information */}
      <GlassCard variant="default" padding="lg" className="buh-hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)] shadow-lg">
            <User className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--buh-foreground)]">
              Профиль пользователя
            </h2>
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Личная информация и контактные данные
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ФИО / Имя</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Иванов Иван Иванович"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Ваше имя, которое будет отображаться в системе.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telegramUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telegram Username</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--buh-foreground-subtle)]">@</span>
                      <Input
                        className="pl-7"
                        placeholder="username"
                        {...field}
                        value={field.value || ''}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Ваш публичный юзернейм (без @). Используется для контактов.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateProfile.isPending}
                className="bg-[var(--buh-primary)] text-white hover:bg-[var(--buh-primary-dark)]"
              >
                {updateProfile.isPending ? (
                    <>Сохранение...</>
                ) : (
                    <>
                        <Save className="w-4 h-4 mr-2" />
                        Сохранить изменения
                    </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </GlassCard>

      {/* Telegram Notifications Section */}
      <GlassCard variant="default" padding="lg" className="buh-hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#229ED9] shadow-lg">
            <Send className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--buh-foreground)]">
              Уведомления в Telegram
            </h2>
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Привяжите аккаунт для получения важных оповещений
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-[var(--buh-surface-elevated)] border border-[var(--buh-border)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--buh-foreground)]">Статус подключения:</span>
              {user?.telegramId ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Подключено
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600 text-xs font-medium">
                  <AlertCircle className="w-3 h-3" />
                  Не подключено
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--buh-foreground-muted)]">
                {user?.telegramId 
                    ? `Аккаунт привязан (ID: ${user.telegramId})`
                    : 'Нажмите кнопку справа, чтобы запустить бота и привязать аккаунт.'
                }
            </p>
          </div>

          <Button
            variant={user?.telegramId ? "outline" : "default"}
            onClick={() => {
              // In a real app, this would use a generated deep link token
              window.open(`https://t.me/BuhBot?start=connect_${user?.id}`, '_blank');
            }}
            className={user?.telegramId ? "" : "bg-[#229ED9] hover:bg-[#1b8bbd] text-white"}
          >
            {user?.telegramId ? 'Переподключить' : 'Подключить Telegram'}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

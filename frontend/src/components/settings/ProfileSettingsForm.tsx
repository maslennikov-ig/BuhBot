'use client';

import * as React from 'react';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, AlertCircle, Send, Save } from 'lucide-react';
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
import { isDevMode } from '@/lib/config';
import { TelegramLoginButton, TelegramUser } from '../telegram/TelegramLoginButton';
import { TelegramAccountCard } from '../telegram/TelegramAccountCard';

const profileSchema = z.object({
  fullName: z.string().min(1, 'Имя обязательно'),
  // telegramUsername is no longer manually editable for linking,
  // but we keep it in schema if backend requires it, or remove it.
  // The backend updateProfile still accepts it, but we want to rely on the linked account.
  // However, for backward compatibility or display preference, we might keep it.
  // The spec says "Replace manual Telegram username input".
  // So we remove it from the form UI, but maybe keep it in schema as optional/hidden if needed.
  // For now, let's remove it from UI.
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileSettingsForm() {
  const utils = trpc.useUtils();
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const updateProfile = trpc.auth.updateProfile.useMutation();
  const linkTelegram = trpc.user.linkTelegram.useMutation();
  const unlinkTelegram = trpc.user.unlinkTelegram.useMutation();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: '',
    },
  });

  // Reset form when user data is loaded
  React.useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.fullName,
      });
    }
  }, [user, form]);

  const onSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(data, {
      onSuccess: () => {
        toast.success('Профиль обновлен');
        utils.auth.me.invalidate();
      },
      onError: (error) => {
        toast.error(`Ошибка обновления: ${error.message}`);
      },
    });
  };

  // Memoize to prevent TelegramLoginButton re-initialization on every render
  const handleTelegramAuth = useCallback(
    (telegramUser: TelegramUser) => {
      linkTelegram.mutate(telegramUser, {
        onSuccess: () => {
          toast.success('Telegram аккаунт успешно привязан');
          utils.auth.me.invalidate();
        },
        onError: (error) => {
          toast.error(`Ошибка привязки Telegram: ${error.message}`);
        },
      });
    },
    [linkTelegram, utils.auth.me]
  );

  const handleDisconnect = useCallback(() => {
    if (
      confirm(
        'Вы уверены, что хотите отвязать Telegram аккаунт? Вы перестанете получать уведомления.'
      )
    ) {
      unlinkTelegram.mutate(undefined, {
        onSuccess: () => {
          toast.success('Telegram аккаунт отвязан');
          utils.auth.me.invalidate();
        },
        onError: (error) => {
          toast.error(`Ошибка отвязки: ${error.message}`);
        },
      });
    }
  }, [unlinkTelegram, utils.auth.me]);

  if (isLoading) {
    return <div className="h-64 rounded-lg buh-shimmer" />;
  }

  const botName = process.env.NEXT_PUBLIC_BOT_NAME;

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
                  <FormDescription>Ваше имя, которое будет отображаться в системе.</FormDescription>
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

        {user?.telegramAccount ? (
          <TelegramAccountCard
            telegramAccount={user.telegramAccount}
            onDisconnect={handleDisconnect}
            isDisconnecting={unlinkTelegram.isPending}
          />
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-[var(--buh-surface-elevated)] border border-[var(--buh-border)]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--buh-foreground)]">
                  Статус подключения:
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600 text-xs font-medium">
                  <AlertCircle className="w-3 h-3" />
                  Не подключено
                </span>
              </div>
              <p className="text-sm text-[var(--buh-foreground-muted)]">
                Нажмите кнопку, чтобы авторизоваться через Telegram и привязать аккаунт.
              </p>
            </div>

            {isDevMode ? (
              <div className="text-sm text-[var(--buh-foreground-muted)] italic">
                Авторизация через Telegram недоступна в режиме разработки
              </div>
            ) : botName ? (
              <div className="flex justify-center md:justify-end">
                <TelegramLoginButton
                  botName={botName}
                  onAuth={handleTelegramAuth}
                  buttonSize="large"
                  cornerRadius={8}
                  requestAccess="write"
                />
              </div>
            ) : (
              <div className="text-sm text-[var(--buh-error)]">
                Bot name not configured (NEXT_PUBLIC_BOT_NAME missing)
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

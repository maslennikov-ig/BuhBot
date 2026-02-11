'use client';

/**
 * ChatSettingsForm Component
 *
 * Form for editing chat SLA settings and accountant assignment.
 * Uses react-hook-form with Zod validation.
 *
 * @module components/chats/ChatSettingsForm
 */

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Settings2, Clock, Save, Loader2, AlertTriangle } from 'lucide-react';

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
import { AccountantSelect } from '@/components/chats/AccountantSelect';
import { AccountantUsernamesInput } from '@/components/chats/AccountantUsernamesInput';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type ChatSettingsFormProps = {
  chatId: number;
  managerTelegramIds: string[];
  initialData?: {
    slaEnabled: boolean;
    slaThresholdMinutes: number;
    assignedAccountantId: string | null;
    accountantUsernames?: string[];
    notifyInChatOnBreach?: boolean;
  };
  onSuccess?: () => void;
  className?: string;
};

// ============================================
// FORM SCHEMA
// ============================================

const DEFAULT_SLA_THRESHOLD_MINUTES = 60;

const chatSettingsSchema = z.object({
  slaEnabled: z.boolean(),
  slaThresholdMinutes: z.number().min(1, 'Минимум 1 минута').max(480, 'Максимум 480 минут'),
  // Allow null, valid UUID, or empty string (transformed to null)
  assignedAccountantId: z
    .union([z.string().uuid(), z.null(), z.literal('')])
    .transform((val) => (val === '' ? null : val)),
  accountantUsernames: z.array(z.string()).optional(),
  notifyInChatOnBreach: z.boolean(),
});

type ChatSettingsFormData = z.infer<typeof chatSettingsSchema>;

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_VALUES: ChatSettingsFormData = {
  slaEnabled: true,
  slaThresholdMinutes: DEFAULT_SLA_THRESHOLD_MINUTES,
  assignedAccountantId: null,
  accountantUsernames: [],
  notifyInChatOnBreach: false,
};

// ============================================
// CHAT SETTINGS FORM COMPONENT
// ============================================

/**
 * ChatSettingsForm - Form for configuring chat-specific settings
 *
 * Features:
 * - SLA enable/disable toggle
 * - SLA response threshold (minutes)
 * - Accountant assignment dropdown
 * - Optimistic updates with error handling
 * - Toast notifications for success/error
 */
export function ChatSettingsForm({
  chatId,
  managerTelegramIds,
  initialData,
  onSuccess,
  className,
}: ChatSettingsFormProps) {
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const utils = trpc.useUtils();

  const updateChat = trpc.chats.update.useMutation({
    onSuccess: () => {
      setSaveSuccess(true);
      setSaveError(null);
      // Invalidate queries to refetch fresh data
      utils.chats.getById.invalidate({ id: chatId });
      utils.chats.list.invalidate();
      onSuccess?.();
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error) => {
      setSaveError(error.message);
      setSaveSuccess(false);
      // Clear error message after 5 seconds
      setTimeout(() => setSaveError(null), 5000);
    },
  });

  const form = useForm<ChatSettingsFormData>({
    resolver: zodResolver(chatSettingsSchema),
    defaultValues: initialData ?? DEFAULT_VALUES,
  });

  // Watch SLA enabled to conditionally show threshold field
  const slaEnabled = useWatch({
    control: form.control,
    name: 'slaEnabled',
  });

  // Reset form when initial data changes
  React.useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  const onSubmit = (data: ChatSettingsFormData) => {
    updateChat.mutate({
      id: chatId,
      slaEnabled: data.slaEnabled,
      slaThresholdMinutes: data.slaThresholdMinutes,
      assignedAccountantId: data.assignedAccountantId,
      accountantUsernames: data.accountantUsernames ?? [],
    });
  };

  return (
    <GlassCard variant="default" padding="lg" className={cn('buh-hover-lift', className)}>
      {/* Header with icon */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)] shadow-lg">
          <Settings2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--buh-foreground)]">Настройки чата</h2>
          <p className="text-sm text-[var(--buh-foreground-muted)]">
            SLA и назначение ответственного
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* SLA Enabled Toggle */}
          <FormField
            control={form.control}
            name="slaEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base font-medium text-[var(--buh-foreground)]">
                    Мониторинг SLA
                  </FormLabel>
                  <FormDescription className="text-[var(--buh-foreground-subtle)]">
                    Включить отслеживание времени ответа для этого чата
                  </FormDescription>
                </div>
                <FormControl>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={field.value}
                    onClick={() => field.onChange(!field.value)}
                    className={cn(
                      'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent)] focus:ring-offset-2',
                      field.value
                        ? 'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]'
                        : 'bg-[var(--buh-surface-elevated)]'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200',
                        field.value ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </FormControl>
              </FormItem>
            )}
          />

          {/* Warning Banner: SLA enabled but no managers configured */}
          {slaEnabled && (!managerTelegramIds || managerTelegramIds.length === 0) && (
            <div className="rounded-lg border border-[var(--buh-warning)] bg-[var(--buh-warning)]/10 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[var(--buh-warning)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-[var(--buh-warning)]">
                  Менеджеры для уведомлений не настроены
                </p>
                <p className="text-sm text-[var(--buh-foreground-muted)] mt-1">
                  SLA уведомления не будут доставлены, так как не указаны Telegram ID менеджеров.
                  Настройте менеджеров в Глобальных настройках или добавьте их для этого чата.
                </p>
              </div>
            </div>
          )}

          {/* Notify in Chat on Breach */}
          <FormField
            control={form.control}
            name="notifyInChatOnBreach"
            render={({ field }) => (
              <FormItem
                className={cn(
                  'flex items-center justify-between rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4',
                  'transition-opacity duration-200',
                  !slaEnabled && 'opacity-50 pointer-events-none'
                )}
              >
                <div className="space-y-0.5">
                  <FormLabel className="text-base font-medium text-[var(--buh-foreground)]">
                    Уведомления в чат
                  </FormLabel>
                  <FormDescription className="text-[var(--buh-foreground-subtle)]">
                    Отправлять предупреждение о нарушении SLA прямо в групповой чат
                    <span className="block mt-1 text-[var(--buh-warning)] font-medium">
                      Только для тестовых чатов. Клиенты увидят внутренние данные SLA.
                    </span>
                  </FormDescription>
                </div>
                <FormControl>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={field.value}
                    disabled={!slaEnabled}
                    onClick={() => field.onChange(!field.value)}
                    className={cn(
                      'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent)] focus:ring-offset-2',
                      field.value
                        ? 'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]'
                        : 'bg-[var(--buh-surface-elevated)]'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200',
                        field.value ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </FormControl>
              </FormItem>
            )}
          />

          {/* SLA Response Time */}
          <FormField
            control={form.control}
            name="slaThresholdMinutes"
            render={({ field }) => (
              <FormItem
                className={cn(
                  'transition-opacity duration-200',
                  !slaEnabled && 'opacity-50 pointer-events-none'
                )}
              >
                <FormLabel className="flex items-center gap-2 text-[var(--buh-foreground)]">
                  <Clock className="h-4 w-4 text-[var(--buh-warning)]" />
                  Порог SLA (минуты)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={480}
                    disabled={!slaEnabled}
                    className="bg-[var(--buh-surface)] border-[var(--buh-border)] focus:border-[var(--buh-accent)] focus:ring-[var(--buh-accent-glow)]"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription className="text-[var(--buh-foreground-subtle)]">
                  Максимальное время для ответа клиенту (1-480 мин)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Accountant Assignment */}
          <FormField
            control={form.control}
            name="assignedAccountantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[var(--buh-foreground)]">
                  Ответственный бухгалтер
                </FormLabel>
                <FormControl>
                  <AccountantSelect
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Выберите бухгалтера"
                  />
                </FormControl>
                <FormDescription className="text-[var(--buh-foreground-subtle)]">
                  Бухгалтер, ответственный за этот чат
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Accountant Usernames */}
          <FormField
            control={form.control}
            name="accountantUsernames"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[var(--buh-foreground)]">
                  Бухгалтеры (@username)
                </FormLabel>
                <FormControl>
                  <AccountantUsernamesInput value={field.value ?? []} onChange={field.onChange} />
                </FormControl>
                <FormDescription className="text-[var(--buh-foreground-subtle)]">
                  Укажите @username бухгалтеров, ответственных за этот чат
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Feedback Messages */}
          {saveSuccess && (
            <div className="rounded-lg border border-[var(--buh-success)] bg-[var(--buh-success)]/10 p-3 text-sm text-[var(--buh-success)] buh-animate-fade-in-up">
              Настройки успешно сохранены
            </div>
          )}

          {saveError && (
            <div className="rounded-lg border border-[var(--buh-error)] bg-[var(--buh-error)]/10 p-3 text-sm text-[var(--buh-error)] buh-animate-fade-in-up">
              Ошибка: {saveError}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={updateChat.isPending}
              className={cn(
                'relative px-6 py-2.5 font-semibold',
                'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
                'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {updateChat.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Сохранить
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </GlassCard>
  );
}

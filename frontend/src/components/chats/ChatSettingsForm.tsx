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
import { ManagerMultiSelect } from '@/components/chats/ManagerMultiSelect';
import { TelegramAuthModal } from '@/components/chats/TelegramAuthModal';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type AccountantVerification = {
  username: string;
  found: boolean;
  hasTelegramId: boolean;
};

type ChatSettingsFormProps = {
  chatId: number;
  managerTelegramIds: string[];
  accountantTelegramIds: number[];
  initialData?: {
    slaEnabled: boolean;
    slaThresholdMinutes: number;
    assignedAccountantId: string | null;
    accountantUsernames?: string[];
    managerTelegramIds?: string[];
  };
  accountantVerification?: AccountantVerification[];
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
  managerTelegramIds: z.array(z.string()).optional(),
});

type ChatSettingsFormData = z.infer<typeof chatSettingsSchema>;

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_VALUES: ChatSettingsFormData = {
  slaEnabled: false,
  slaThresholdMinutes: DEFAULT_SLA_THRESHOLD_MINUTES,
  assignedAccountantId: null,
  accountantUsernames: [],
  managerTelegramIds: [],
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
  accountantTelegramIds,
  initialData,
  accountantVerification,
  onSuccess,
  className,
}: ChatSettingsFormProps) {
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveWarnings, setSaveWarnings] = React.useState<string[]>([]);
  const [pendingUser, setPendingUser] = React.useState<{ id: string; name: string } | null>(null);

  const utils = trpc.useUtils();

  const updateChat = trpc.chats.update.useMutation({
    onSuccess: (data) => {
      setSaveSuccess(true);
      setSaveError(null);
      setSaveWarnings(data.warnings ?? []);
      // Invalidate queries to refetch fresh data
      utils.chats.getById.invalidate({ id: chatId });
      utils.chats.list.invalidate();
      onSuccess?.();
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
      // Clear warnings after 10 seconds
      if (data.warnings?.length) {
        setTimeout(() => setSaveWarnings([]), 10000);
      }
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

  // Watch form-level managerTelegramIds for live warning banner updates
  const formManagerIds = useWatch({
    control: form.control,
    name: 'managerTelegramIds',
  });

  // Fetch global settings to check for global manager recipients (prevents false-positive warning)
  const { data: globalSettings } = trpc.settings.getGlobalSettings.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // cache for 5 min, same as backend
  });
  const hasGlobalManagers = (globalSettings?.globalManagerCount ?? 0) > 0;

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
      managerTelegramIds: data.managerTelegramIds ?? [],
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

          {/* Warning: No accountant for Level 1 */}
          {slaEnabled && (!accountantTelegramIds || accountantTelegramIds.length === 0) && (
            <div className="rounded-lg border border-[var(--buh-warning)] bg-[var(--buh-warning)]/10 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[var(--buh-warning)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-[var(--buh-warning)]">
                  Не назначен ответственный бухгалтер (Level 1)
                </p>
                <p className="text-sm text-[var(--buh-foreground-muted)] mt-1">
                  SLA включен, но нет ответственного бухгалтера для первичных уведомлений. Назначьте
                  бухгалтера ниже.
                </p>
              </div>
            </div>
          )}

          {/* Warning: No managers for Level 2+ escalation */}
          {slaEnabled &&
            (!formManagerIds || formManagerIds.length === 0) &&
            (!managerTelegramIds || managerTelegramIds.length === 0) &&
            !hasGlobalManagers && (
              <div className="rounded-lg border border-[var(--buh-warning)] bg-[var(--buh-warning)]/10 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-[var(--buh-warning)] mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-[var(--buh-warning)]">
                    Не назначены менеджеры для эскалации (Level 2+)
                  </p>
                  <p className="text-sm text-[var(--buh-foreground-muted)] mt-1">
                    SLA включен, но нет менеджеров для эскалации. Добавьте менеджеров ниже или
                    настройте глобальных менеджеров в Настройках системы.
                  </p>
                </div>
              </div>
            )}

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
                  Ответственный бухгалтер (получает первичные уведомления)
                </FormLabel>
                <FormControl>
                  <AccountantSelect
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Выберите бухгалтера"
                  />
                </FormControl>
                <FormDescription className="text-[var(--buh-foreground-subtle)]">
                  Получает уведомления Level 1 (первичное нарушение SLA)
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
                  Ответственные бухгалтеры (@username)
                </FormLabel>
                <FormControl>
                  <AccountantUsernamesInput
                    value={field.value ?? []}
                    onChange={field.onChange}
                    verification={accountantVerification}
                  />
                </FormControl>
                <FormDescription className="text-[var(--buh-foreground-subtle)]">
                  Получают первичные SLA-уведомления. Если не ответят — эскалация до менеджеров.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Manager Telegram IDs for SLA notifications */}
          <FormField
            control={form.control}
            name="managerTelegramIds"
            render={({ field }) => (
              <FormItem
                className={cn(
                  'transition-opacity duration-200',
                  !slaEnabled && 'opacity-50 pointer-events-none'
                )}
              >
                <FormLabel className="text-[var(--buh-foreground)]">
                  Менеджеры для эскалации (получают при отсутствии ответа)
                </FormLabel>
                <FormControl>
                  <ManagerMultiSelect
                    value={field.value ?? []}
                    onChange={field.onChange}
                    disabled={!slaEnabled}
                    onSelectUserWithoutTelegram={(user) => setPendingUser(user)}
                  />
                </FormControl>
                <FormDescription className="text-[var(--buh-foreground-subtle)]">
                  Получают уведомления Level 2+ (эскалация). Если не заданы, используются глобальные
                  менеджеры из настроек системы.
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

          {saveWarnings.length > 0 && (
            <div className="rounded-lg border border-[var(--buh-warning)] bg-[var(--buh-warning)]/10 p-3 text-sm text-[var(--buh-warning)] buh-animate-fade-in-up">
              {saveWarnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
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

      {/* TelegramAuthModal for users without linked Telegram */}
      <TelegramAuthModal
        open={!!pendingUser}
        user={pendingUser}
        onClose={() => setPendingUser(null)}
        onSuccess={(telegramId) => {
          const current = form.getValues('managerTelegramIds') ?? [];
          form.setValue('managerTelegramIds', [...current, telegramId], { shouldDirty: true });
          setPendingUser(null);
        }}
      />
    </GlassCard>
  );
}

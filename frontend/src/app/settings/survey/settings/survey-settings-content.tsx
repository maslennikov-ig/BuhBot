'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Settings,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Bell,
  Star,
  Clock,
} from 'lucide-react';
import { HelpButton } from '@/components/ui/HelpButton';

// ============================================
// TYPES
// ============================================

type SurveySettings = {
  surveyValidityDays: number;
  surveyReminderDay: number;
  lowRatingThreshold: number;
  surveyQuarterDay: number;
};

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <>
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="h-6 w-32 animate-pulse rounded bg-[var(--buh-card-bg)]" />
        <div className="mt-4 h-9 w-64 animate-pulse rounded bg-[var(--buh-card-bg)]" />
        <div className="mt-2 h-5 w-96 animate-pulse rounded bg-[var(--buh-card-bg)]" />
      </div>

      {/* Form Skeleton */}
      <div className="h-[400px] animate-pulse rounded-lg border border-[var(--buh-border)] bg-[var(--buh-card-bg)]" />
    </>
  );
}

// ============================================
// SETTING FIELD COMPONENT
// ============================================

function SettingField({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-6 border-b border-[var(--buh-border)] last:border-b-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
        <Icon className="h-5 w-5 text-[var(--buh-primary)]" />
      </div>
      <div className="flex-1">
        <label className="block text-sm font-semibold text-[var(--buh-foreground)]">{label}</label>
        <p className="mt-1 text-sm text-[var(--buh-foreground-muted)]">{description}</p>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SurveySettingsContent() {
  const [formState, setFormState] = React.useState<SurveySettings | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

  // Fetch current settings
  const { data: settingsData, isLoading, error, refetch } = trpc.survey.getSettings.useQuery();

  // Update mutation
  const updateMutation = trpc.survey.updateSettings.useMutation({
    onSuccess: () => {
      setSaveStatus('success');
      refetch();
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    },
  });

  // Initialize form state when settings load
  React.useEffect(() => {
    if (settingsData && !formState) {
      setFormState({
        surveyValidityDays: settingsData.surveyValidityDays,
        surveyReminderDay: settingsData.surveyReminderDay,
        lowRatingThreshold: settingsData.lowRatingThreshold,
        surveyQuarterDay: settingsData.surveyQuarterDay,
      });
    }
  }, [settingsData, formState]);

  // Handle field change
  const handleChange = (field: keyof SurveySettings, value: number) => {
    setFormState((prev) => (prev ? { ...prev, [field]: value } : null));
    setSaveStatus('idle');
  };

  // Handle save
  const handleSave = () => {
    if (!formState) return;
    updateMutation.mutate(formState);
  };

  // Check if form has changes
  const hasChanges = React.useMemo(() => {
    if (!settingsData || !formState) return false;
    return (
      formState.surveyValidityDays !== settingsData.surveyValidityDays ||
      formState.surveyReminderDay !== settingsData.surveyReminderDay ||
      formState.lowRatingThreshold !== settingsData.lowRatingThreshold ||
      formState.surveyQuarterDay !== settingsData.surveyQuarterDay
    );
  }, [settingsData, formState]);

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingSkeleton />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="h-16 w-16 text-[var(--buh-error)]" />
          <h2 className="mt-4 text-xl font-semibold text-[var(--buh-foreground)]">
            Ошибка загрузки настроек
          </h2>
          <p className="mt-2 text-[var(--buh-foreground-muted)]">{error.message}</p>
          <Link
            href="/settings/survey"
            className="mt-6 flex items-center gap-2 text-[var(--buh-primary)] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться к списку опросов
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Back Link */}
      <Link
        href="/settings/survey"
        className="mb-4 inline-flex items-center gap-2 text-sm text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к списку опросов
      </Link>

      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
            Настройки опросов
          </h1>
          <p className="mt-2 text-[var(--buh-foreground-muted)]">
            Конфигурация параметров квартальных опросов клиентов
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HelpButton section="settings.survey" />
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
              hasChanges
                ? 'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] text-white hover:opacity-90'
                : 'bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground-muted)]',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Сохранить
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Status Message */}
      {saveStatus !== 'idle' && (
        <div
          className={cn(
            'mb-6 flex items-center gap-2 rounded-lg p-4 text-sm',
            saveStatus === 'success'
              ? 'bg-[var(--buh-success-muted)] text-[var(--buh-success)]'
              : 'bg-[var(--buh-error-muted)] text-[var(--buh-error)]'
          )}
        >
          {saveStatus === 'success' ? (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Настройки успешно сохранены
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5" />
              {updateMutation.error?.message || 'Ошибка сохранения настроек'}
            </>
          )}
        </div>
      )}

      {/* Settings Form */}
      <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden group">
        {/* Gradient accent on hover */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
            <Settings className="h-5 w-5 text-[var(--buh-primary)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--buh-foreground)]">
              Параметры опросов
            </h3>
            <p className="text-xs text-[var(--buh-foreground-subtle)]">
              Настройки автоматической рассылки и сбора отзывов
            </p>
          </div>
        </div>

        {formState && (
          <div className="divide-y divide-[var(--buh-border)]">
            {/* Survey Validity Days */}
            <SettingField
              icon={Clock}
              label="Срок действия опроса (дней)"
              description="Количество дней, в течение которых клиент может ответить на опрос после его получения"
            >
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={formState.surveyValidityDays}
                  onChange={(e) => handleChange('surveyValidityDays', parseInt(e.target.value))}
                  className="h-2 w-48 cursor-pointer appearance-none rounded-lg bg-[var(--buh-surface-elevated)] accent-[var(--buh-accent)]"
                />
                <div className="flex h-9 w-16 items-center justify-center rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] text-sm font-medium text-[var(--buh-foreground)]">
                  {formState.surveyValidityDays}
                </div>
              </div>
            </SettingField>

            {/* Survey Reminder Day */}
            <SettingField
              icon={Bell}
              label="День напоминания"
              description="На какой день отправить напоминание тем, кто еще не ответил"
            >
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={7}
                  value={formState.surveyReminderDay}
                  onChange={(e) => handleChange('surveyReminderDay', parseInt(e.target.value))}
                  className="h-2 w-48 cursor-pointer appearance-none rounded-lg bg-[var(--buh-surface-elevated)] accent-[var(--buh-accent)]"
                />
                <div className="flex h-9 w-16 items-center justify-center rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] text-sm font-medium text-[var(--buh-foreground)]">
                  {formState.surveyReminderDay}
                </div>
              </div>
            </SettingField>

            {/* Low Rating Threshold */}
            <SettingField
              icon={Star}
              label="Порог низкой оценки"
              description="Оценки ниже или равные этому значению считаются низкими и требуют внимания менеджера"
            >
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleChange('lowRatingThreshold', rating)}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium',
                      'transition-all duration-200',
                      formState.lowRatingThreshold === rating
                        ? 'border-[var(--buh-accent)] bg-[var(--buh-accent)] text-white'
                        : rating <= formState.lowRatingThreshold
                          ? 'border-[var(--buh-warning)] bg-[var(--buh-warning-muted)] text-[var(--buh-warning)]'
                          : 'border-[var(--buh-border)] bg-[var(--buh-surface)] text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)]'
                    )}
                  >
                    {rating}
                  </button>
                ))}
                <span className="ml-2 text-sm text-[var(--buh-foreground-muted)]">
                  (1-{formState.lowRatingThreshold} = низкие)
                </span>
              </div>
            </SettingField>

            {/* Survey Quarter Day */}
            <SettingField
              icon={Calendar}
              label="День квартала для авто-рассылки"
              description="День месяца (в начале квартала), когда автоматически отправляются опросы"
            >
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={formState.surveyQuarterDay}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= 28) {
                      handleChange('surveyQuarterDay', val);
                    }
                  }}
                  className={cn(
                    'h-10 w-20 rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] px-3 text-center text-sm',
                    'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]'
                  )}
                />
                <span className="text-sm text-[var(--buh-foreground-muted)]">
                  число месяца (1-28)
                </span>
              </div>
            </SettingField>
          </div>
        )}

        {/* Decorative glow */}
        <div className="absolute -bottom-20 right-1/4 h-40 w-40 rounded-full bg-[var(--buh-primary)] opacity-5 blur-3xl transition-opacity duration-500 group-hover:opacity-10" />
      </GlassCard>

      {/* Help Text */}
      <div className="mt-6 rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] p-4">
        <h4 className="text-sm font-semibold text-[var(--buh-foreground)]">Как работают опросы</h4>
        <ul className="mt-2 space-y-1 text-sm text-[var(--buh-foreground-muted)]">
          <li>
            1. В начале каждого квартала (на указанный день) автоматически создается новый опрос
          </li>
          <li>2. Опрос отправляется всем активным клиентам через Telegram бота</li>
          <li>3. Клиенты могут ответить в течение указанного срока действия</li>
          <li>4. На указанный день отправляется напоминание тем, кто еще не ответил</li>
          <li>5. Низкие оценки (ниже порога) автоматически уведомляют менеджера</li>
        </ul>
      </div>
    </AdminLayout>
  );
}

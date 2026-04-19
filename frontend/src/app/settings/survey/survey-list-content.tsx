'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { trpc } from '@/lib/trpc';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
  Plus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Settings,
  Calendar,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { HelpButton } from '@/components/ui/HelpButton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarWidget } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { tz } from '@date-fns/tz';
import { ru } from 'date-fns/locale';

// gh-292: All UI-facing timestamps live in Europe/Moscow.
// Storage is UTC (see @db.Timestamptz(6) in schema.prisma) — we only convert at
// display time via the date-fns `in: tz(...)` option.
const MOSCOW_TZ = 'Europe/Moscow';
const moscow = tz(MOSCOW_TZ);

// ============================================
// TYPES
// ============================================

type SurveyStatus = 'scheduled' | 'sending' | 'active' | 'closed' | 'expired';

// ============================================
// CONSTANTS
// ============================================

const POLLING_INTERVAL_MS = 30 * 1000; // 30 seconds

const statusConfig: Record<
  SurveyStatus,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  scheduled: {
    label: 'Запланирован',
    icon: Calendar,
    color: 'var(--buh-info)',
    bgColor: 'var(--buh-info-muted)',
  },
  sending: {
    label: 'Отправка',
    icon: Send,
    color: 'var(--buh-warning)',
    bgColor: 'var(--buh-warning-muted)',
  },
  active: {
    label: 'Активен',
    icon: CheckCircle2,
    color: 'var(--buh-success)',
    bgColor: 'var(--buh-success-muted)',
  },
  closed: {
    label: 'Закрыт',
    icon: XCircle,
    color: 'var(--buh-foreground-muted)',
    bgColor: 'var(--buh-surface-elevated)',
  },
  expired: {
    label: 'Истек',
    icon: AlertTriangle,
    color: 'var(--buh-error)',
    bgColor: 'var(--buh-error-muted)',
  },
};

const statusFilterOptions: { value: SurveyStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все статусы' },
  { value: 'scheduled', label: 'Запланированные' },
  { value: 'sending', label: 'Отправляются' },
  { value: 'active', label: 'Активные' },
  { value: 'closed', label: 'Закрытые' },
  { value: 'expired', label: 'Истекшие' },
];

// ============================================
// STATUS BADGE COMPONENT
// ============================================

function StatusBadge({ status }: { status: SurveyStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
    </div>
  );
}

// ============================================
// CREATE SURVEY MODAL
// ============================================

/**
 * gh-292: Translate a tRPC error into a Russian message tailored to the
 * discriminated `cause.kind` that the server attaches. Falls back to the
 * plain `error.message` when the cause isn't one of the known kinds.
 */
function formatTrpcError(
  error: { message?: string; data?: unknown } | null | undefined,
  maxRangeDays: number
): string | null {
  if (!error) return null;
  const cause = (
    error.data as { cause?: { kind?: string; nextEligibleAt?: string } } | null | undefined
  )?.cause;
  if (cause?.kind === 'COOLDOWN' && cause.nextEligibleAt) {
    const when = format(new Date(cause.nextEligibleAt), 'dd MMMM HH:mm', {
      locale: ru,
      in: moscow,
    });
    return `Рассылка заблокирована до ${when} (Москва)`;
  }
  if (cause?.kind === 'OVERLAP') {
    return 'Уже есть активная кампания с пересекающимся диапазоном дат';
  }
  if (cause?.kind === 'RANGE_INVALID') {
    return `Диапазон некорректен (макс. ${maxRangeDays} дней, конец позже начала)`;
  }
  return error.message ?? 'Не удалось создать опрос';
}

type AudienceMode = 'all' | 'specific_chats' | 'segments';

function CreateSurveyModal({
  isOpen,
  onClose,
  onSuccess,
  maxRangeDays,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** From GlobalSettings.surveyMaxRangeDays — surfaces in the error copy. */
  maxRangeDays: number;
}) {
  const [mode, setMode] = React.useState<'quarter' | 'range'>('quarter');
  const [quarter, setQuarter] = React.useState('');
  const [rangeStart, setRangeStart] = React.useState<Date | undefined>(undefined);
  const [rangeEnd, setRangeEnd] = React.useState<Date | undefined>(undefined);
  const [scheduledFor, setScheduledFor] = React.useState('');
  const [isImmediate, setIsImmediate] = React.useState(true);
  const [clientError, setClientError] = React.useState<string | null>(null);

  // gh-313: Audience selector state. Default 'all' preserves the historical
  // "blast every active client" behavior so the form behaves like before for
  // admins who don't touch the new picker.
  const [audienceMode, setAudienceMode] = React.useState<AudienceMode>('all');
  const [audienceChatIds, setAudienceChatIds] = React.useState<string[]>([]);
  const [audienceSegmentId, setAudienceSegmentId] = React.useState<string>('');

  // Lazy-loaded option sources for the picker. Both fire only when the modal
  // is open AND the relevant audience mode is active so we don't pay the cost
  // for the default 'all' path.
  // gh-313 code review M1: bumped from 100 → 500 so medium-sized tenants can
  // pick from the full chat list. When we hit the ceiling we surface a banner
  // (see below) rather than silently truncating — admins with more than 500
  // chats are expected to contact an operator.
  const CHATS_PICKER_LIMIT = 500;
  const chatsListQuery = trpc.chats.list.useQuery(
    { limit: CHATS_PICKER_LIMIT, offset: 0 },
    { enabled: isOpen && audienceMode === 'specific_chats' }
  );
  const segmentsListQuery = trpc.segment.list.useQuery(undefined, {
    enabled: isOpen && audienceMode === 'segments',
  });

  const resetForm = React.useCallback(() => {
    setMode('quarter');
    setQuarter('');
    setRangeStart(undefined);
    setRangeEnd(undefined);
    setScheduledFor('');
    setIsImmediate(true);
    setClientError(null);
    setAudienceMode('all');
    setAudienceChatIds([]);
    setAudienceSegmentId('');
  }, []);

  const createMutation = trpc.survey.create.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
      resetForm();
    },
  });

  // Generate quarter options (current + next 3 quarters)
  const quarterOptions = React.useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

    for (let i = 0; i < 4; i++) {
      const q = ((currentQuarter - 1 + i) % 4) + 1;
      const y = currentYear + Math.floor((currentQuarter - 1 + i) / 4);
      options.push(`${y}-Q${q}`);
    }
    return options;
  }, []);

  /**
   * gh-313: Build the `audience` payload from the picker state. Returns
   * `undefined` for the default "all" mode so the server applies the legacy
   * behavior. Returns `null` (sentinel) when validation fails — caller surfaces
   * the matching error string.
   */
  const buildAudiencePayload = ():
    | {
        audience:
          | { type: 'all' }
          | { type: 'specific_chats'; chatIds: string[] }
          | { type: 'segments'; segmentIds: string[] };
      }
    | null
    | undefined => {
    if (audienceMode === 'all') return undefined;
    if (audienceMode === 'specific_chats') {
      if (audienceChatIds.length === 0) {
        setClientError('Выберите хотя бы один чат');
        return null;
      }
      return { audience: { type: 'specific_chats', chatIds: audienceChatIds } };
    }
    // segments
    if (!audienceSegmentId) {
      setClientError('Выберите сегмент');
      return null;
    }
    return { audience: { type: 'segments', segmentIds: [audienceSegmentId] } };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    const audiencePayload = buildAudiencePayload();
    if (audiencePayload === null) return; // validation failure already set clientError

    const scheduledForDate = isImmediate ? undefined : new Date(scheduledFor);

    if (mode === 'quarter') {
      if (!quarter) {
        setClientError('Выберите квартал');
        return;
      }
      createMutation.mutate({
        mode: 'quarter',
        quarter,
        ...(scheduledForDate ? { scheduledFor: scheduledForDate } : {}),
        ...(audiencePayload ?? {}),
      });
      return;
    }

    // Range mode — client-side validation before hitting the server so the
    // user gets instant feedback on obvious mistakes (end <= start).
    if (!rangeStart || !rangeEnd) {
      setClientError('Укажите начало и конец диапазона');
      return;
    }
    if (rangeEnd <= rangeStart) {
      setClientError('Дата окончания должна быть позже даты начала');
      return;
    }
    const spanDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000);
    if (spanDays > maxRangeDays) {
      setClientError(`Диапазон ${spanDays} дн. превышает лимит ${maxRangeDays} дн.`);
      return;
    }

    createMutation.mutate({
      mode: 'range',
      startDate: rangeStart,
      endDate: rangeEnd,
      ...(scheduledForDate ? { scheduledFor: scheduledForDate } : {}),
      ...(audiencePayload ?? {}),
    });
  };

  const serverError = formatTrpcError(createMutation.error, maxRangeDays);
  const errorText = clientError ?? serverError;

  if (!isOpen) return null;

  const audienceValid =
    audienceMode === 'all' ||
    (audienceMode === 'specific_chats' && audienceChatIds.length > 0) ||
    (audienceMode === 'segments' && !!audienceSegmentId);

  const canSubmit =
    !createMutation.isPending &&
    (mode === 'quarter' ? !!quarter : !!rangeStart && !!rangeEnd) &&
    audienceValid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--buh-border)] bg-[var(--buh-surface)] p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-[var(--buh-foreground)]">Создать опрос</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode Tabs */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--buh-foreground)]">
              Режим
            </label>
            <div className="flex gap-2" role="radiogroup" aria-label="Режим создания опроса">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="radio"
                  name="survey-mode"
                  value="quarter"
                  checked={mode === 'quarter'}
                  onChange={() => {
                    setMode('quarter');
                    setClientError(null);
                  }}
                  className="h-4 w-4 accent-[var(--buh-accent)]"
                />
                <span className="text-sm text-[var(--buh-foreground)]">Квартал (пресет)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="radio"
                  name="survey-mode"
                  value="range"
                  checked={mode === 'range'}
                  onChange={() => {
                    setMode('range');
                    setClientError(null);
                  }}
                  className="h-4 w-4 accent-[var(--buh-accent)]"
                />
                <span className="text-sm text-[var(--buh-foreground)]">Произвольный диапазон</span>
              </label>
            </div>
          </div>

          {/* Quarter Select */}
          {mode === 'quarter' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--buh-foreground)]">
                Квартал
              </label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className={cn(
                  'h-10 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-background)] px-3 text-sm',
                  'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]'
                )}
                required
              >
                <option value="">Выберите квартал</option>
                {quarterOptions.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Range Picker */}
          {mode === 'range' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--buh-foreground)]">
                  Начало
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'flex h-10 w-full items-center gap-2 rounded-lg border border-[var(--buh-border)] bg-[var(--buh-background)] px-3 text-left text-sm',
                        'hover:bg-[var(--buh-surface-elevated)]',
                        !rangeStart && 'text-[var(--buh-foreground-muted)]'
                      )}
                    >
                      <Calendar className="h-4 w-4" />
                      {rangeStart
                        ? format(rangeStart, 'dd.MM.yyyy', { locale: ru, in: moscow })
                        : 'Выберите дату'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarWidget
                      mode="single"
                      selected={rangeStart}
                      onSelect={setRangeStart}
                      locale={ru}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--buh-foreground)]">
                  Конец
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'flex h-10 w-full items-center gap-2 rounded-lg border border-[var(--buh-border)] bg-[var(--buh-background)] px-3 text-left text-sm',
                        'hover:bg-[var(--buh-surface-elevated)]',
                        !rangeEnd && 'text-[var(--buh-foreground-muted)]'
                      )}
                    >
                      <Calendar className="h-4 w-4" />
                      {rangeEnd
                        ? format(rangeEnd, 'dd.MM.yyyy', { locale: ru, in: moscow })
                        : 'Выберите дату'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarWidget
                      mode="single"
                      selected={rangeEnd}
                      onSelect={setRangeEnd}
                      locale={ru}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* gh-313: Audience picker (orthogonal axis to scheduling mode). */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--buh-foreground)]">
              Аудитория
            </label>
            <div className="flex gap-2 mb-2" role="radiogroup" aria-label="Выбор аудитории опроса">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="radio"
                  name="audience-mode"
                  value="all"
                  checked={audienceMode === 'all'}
                  onChange={() => {
                    setAudienceMode('all');
                    setClientError(null);
                  }}
                  className="h-4 w-4 accent-[var(--buh-accent)]"
                />
                <span className="text-sm text-[var(--buh-foreground)]">Все чаты</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="radio"
                  name="audience-mode"
                  value="specific_chats"
                  checked={audienceMode === 'specific_chats'}
                  onChange={() => {
                    setAudienceMode('specific_chats');
                    setClientError(null);
                  }}
                  className="h-4 w-4 accent-[var(--buh-accent)]"
                />
                <span className="text-sm text-[var(--buh-foreground)]">Выбрать чаты</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="radio"
                  name="audience-mode"
                  value="segments"
                  checked={audienceMode === 'segments'}
                  onChange={() => {
                    setAudienceMode('segments');
                    setClientError(null);
                  }}
                  className="h-4 w-4 accent-[var(--buh-accent)]"
                />
                <span className="text-sm text-[var(--buh-foreground)]">Сегмент</span>
              </label>
            </div>

            {audienceMode === 'specific_chats' && (
              <div className="rounded-lg border border-[var(--buh-border)] p-2">
                {chatsListQuery.isLoading ? (
                  <div className="flex items-center justify-center py-4 text-sm text-[var(--buh-foreground-muted)]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Загрузка чатов...
                  </div>
                ) : chatsListQuery.data?.chats?.length ? (
                  <div className="max-h-48 overflow-y-auto">
                    {/* gh-313 code review M1: at-ceiling banner when the server returned
                        exactly the picker limit — there are likely more chats the admin
                        can't see. */}
                    {chatsListQuery.data.chats.length >= CHATS_PICKER_LIMIT && (
                      <p
                        role="status"
                        className="mb-2 rounded-md border border-[var(--buh-warning)]/40 bg-[var(--buh-warning-muted)] px-2 py-1.5 text-xs text-[var(--buh-warning)]"
                      >
                        Показаны первые {CHATS_PICKER_LIMIT} чатов — уточните фильтры или обратитесь
                        к администратору
                      </p>
                    )}
                    {chatsListQuery.data.chats.map((chat) => {
                      const idStr = chat.id.toString();
                      const checked = audienceChatIds.includes(idStr);
                      return (
                        <label
                          key={idStr}
                          className={cn(
                            'flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 text-sm',
                            'hover:bg-[var(--buh-surface-elevated)]'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setAudienceChatIds((prev) =>
                                e.target.checked
                                  ? [...prev, idStr]
                                  : prev.filter((id) => id !== idStr)
                              );
                            }}
                            className="h-4 w-4 accent-[var(--buh-accent)]"
                          />
                          <span className="truncate text-[var(--buh-foreground)]">
                            {chat.title ?? `Chat ${idStr}`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-2 text-center text-sm text-[var(--buh-foreground-muted)]">
                    Нет доступных чатов
                  </p>
                )}
                <p className="mt-1 px-2 text-xs text-[var(--buh-foreground-subtle)]">
                  Выбрано: {audienceChatIds.length}
                </p>
              </div>
            )}

            {audienceMode === 'segments' && (
              <div>
                {segmentsListQuery.isLoading ? (
                  <div className="flex items-center justify-center py-4 text-sm text-[var(--buh-foreground-muted)]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Загрузка сегментов...
                  </div>
                ) : segmentsListQuery.data?.length ? (
                  <>
                    <select
                      value={audienceSegmentId}
                      onChange={(e) => setAudienceSegmentId(e.target.value)}
                      className={cn(
                        'h-10 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-background)] px-3 text-sm',
                        'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]'
                      )}
                    >
                      <option value="">Выберите сегмент</option>
                      {segmentsListQuery.data.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.memberCount})
                        </option>
                      ))}
                    </select>
                    {/* gh-313 code review L3: the backend accepts up to 50 segments in
                        one campaign, but this UI binds to a single id. Document the
                        limitation so admins don't expect multi-select in this release. */}
                    <p className="mt-1 text-xs text-[var(--buh-foreground-subtle)]">
                      Выберите один сегмент. Несколько сегментов в одной кампании появятся в
                      следующем релизе.
                    </p>
                  </>
                ) : (
                  <p className="rounded-lg border border-dashed border-[var(--buh-border)] px-3 py-3 text-sm text-[var(--buh-foreground-muted)]">
                    Нет сегментов. Создайте сегмент в разделе управления сегментами.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Schedule Options */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--buh-foreground)]">
              Время запуска
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={isImmediate}
                  onChange={() => setIsImmediate(true)}
                  className="h-4 w-4 accent-[var(--buh-accent)]"
                />
                <span className="text-sm text-[var(--buh-foreground)]">Запустить сразу</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!isImmediate}
                  onChange={() => setIsImmediate(false)}
                  className="h-4 w-4 accent-[var(--buh-accent)]"
                />
                <span className="text-sm text-[var(--buh-foreground)]">Запланировать</span>
              </label>
            </div>
          </div>

          {/* Scheduled Date/Time */}
          {!isImmediate && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--buh-foreground)]">
                Дата и время запуска (Москва)
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className={cn(
                  'h-10 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-background)] px-3 text-sm',
                  'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]'
                )}
                required={!isImmediate}
              />
            </div>
          )}

          {/* Error Message */}
          {errorText && (
            <div
              role="alert"
              className="rounded-lg bg-[var(--buh-error-muted)] p-3 text-sm text-[var(--buh-error)]"
            >
              {errorText}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                resetForm();
              }}
              className={cn(
                'flex-1 rounded-lg border border-[var(--buh-border)] px-4 py-2 text-sm font-medium',
                'text-[var(--buh-foreground)] hover:bg-[var(--buh-surface-elevated)]',
                'transition-colors duration-200'
              )}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                'flex-1 rounded-lg bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] px-4 py-2 text-sm font-medium text-white',
                'hover:opacity-90 transition-opacity duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {createMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Создание...
                </span>
              ) : (
                'Создать'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <>
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="h-9 w-64 animate-pulse rounded bg-[var(--buh-card-bg)]" />
        <div className="mt-2 h-5 w-96 animate-pulse rounded bg-[var(--buh-card-bg)]" />
      </div>

      {/* Table Skeleton */}
      <div className="h-[600px] animate-pulse rounded-lg border border-[var(--buh-border)] bg-[var(--buh-card-bg)]" />
    </>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SurveyListContent() {
  const { isAllowed, isLoading: isRoleLoading } = useRoleGuard(['accountant']);
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<SurveyStatus | 'all'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

  // Fetch surveys
  const {
    data: surveysData,
    isLoading,
    error,
    refetch,
  } = trpc.survey.list.useQuery(
    {
      page,
      pageSize: 20,
      status: statusFilter === 'all' ? undefined : statusFilter,
    },
    {
      refetchInterval: POLLING_INTERVAL_MS,
      refetchIntervalInBackground: false,
    }
  );

  // gh-292: pull cooldown/maxRange knobs so the create modal can show
  // the configured limit in its error copy.
  const { data: settingsData } = trpc.survey.getSettings.useQuery();
  const maxRangeDays = settingsData?.surveyMaxRangeDays ?? 90;

  // Format date helper (legacy — kept for scheduledAt display).
  const formatDate = (date: Date | string | null): string => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * gh-292: Render the "period" column. Prefer quarter label when present,
   * otherwise render the explicit startDate..endDate range in Moscow tz.
   */
  const formatPeriod = (
    quarter: string | null,
    startDate: Date | string | null,
    endDate: Date | string | null
  ): string => {
    if (quarter) return quarter;
    if (startDate && endDate) {
      const s = format(new Date(startDate), 'dd.MM.yyyy', { locale: ru, in: moscow });
      const e = format(new Date(endDate), 'dd.MM.yyyy', { locale: ru, in: moscow });
      return `${s} — ${e}`;
    }
    return '—';
  };

  // Handle filter change
  const handleStatusFilterChange = (newStatus: SurveyStatus | 'all') => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  if (isRoleLoading || isAllowed === false) return null;

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingSkeleton />
      </AdminLayout>
    );
  }

  const surveys = surveysData?.items ?? [];
  const pagination = surveysData?.pagination ?? {
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 1,
  };

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
            Управление опросами
          </h1>
          <p className="mt-2 text-[var(--buh-foreground-muted)]">
            Создание и управление квартальными опросами клиентов
            {error && (
              <span className="ml-2 text-sm text-[var(--buh-status-critical)]">
                (ошибка загрузки)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HelpButton section="settings.survey" />
          <Link
            href="/settings/survey/settings"
            className={cn(
              'flex items-center gap-2 rounded-lg border border-[var(--buh-border)] px-4 py-2 text-sm font-medium',
              'text-[var(--buh-foreground)] hover:bg-[var(--buh-surface-elevated)]',
              'transition-colors duration-200'
            )}
          >
            <Settings className="h-4 w-4" />
            Настройки
          </Link>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className={cn(
              'flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] px-4 py-2 text-sm font-medium text-white',
              'hover:opacity-90 transition-opacity duration-200'
            )}
          >
            <Plus className="h-4 w-4" />
            Создать опрос
          </button>
        </div>
      </div>

      {/* Survey Table */}
      <GlassCard variant="elevated" padding="none" className="relative overflow-hidden group">
        {/* Gradient accent on hover */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Header with Filter */}
        <div className="flex items-center justify-between border-b border-[var(--buh-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
              <ClipboardList className="h-5 w-5 text-[var(--buh-primary)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--buh-foreground)]">Опросы</h3>
              <p className="text-xs text-[var(--buh-foreground-subtle)]">
                Всего: {pagination.totalItems}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg',
                'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]',
                'transition-colors duration-200'
              )}
              title="Обновить"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as SurveyStatus | 'all')}
              className={cn(
                'h-9 rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] px-3 text-sm',
                'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]'
              )}
            >
              {statusFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--buh-border)] bg-[var(--buh-surface-elevated)]/50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Период
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Создан
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Доставлено
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Ответов
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  % ответов
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--buh-border)]">
              {surveys.map((survey, index) => (
                <tr
                  key={survey.id}
                  className={cn(
                    'transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)]/50',
                    'buh-animate-fade-in-up'
                  )}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* Quarter / Range (gh-292) */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="font-semibold text-[var(--buh-foreground)]">
                      {formatPeriod(
                        survey.quarter ?? null,
                        survey.startDate ?? null,
                        survey.endDate ?? null
                      )}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusBadge status={survey.status as SurveyStatus} />
                  </td>

                  {/* Created */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm text-[var(--buh-foreground-muted)]">
                      {formatDate(survey.scheduledAt)}
                    </span>
                  </td>

                  {/* Delivered */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm text-[var(--buh-foreground)]">
                      {survey.deliveredCount} / {survey.totalClients}
                    </span>
                  </td>

                  {/* Responses */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm text-[var(--buh-foreground)]">
                      {survey.responseCount}
                    </span>
                  </td>

                  {/* Response Rate */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        survey.responseRate >= 50
                          ? 'text-[var(--buh-success)]'
                          : survey.responseRate >= 25
                            ? 'text-[var(--buh-warning)]'
                            : 'text-[var(--buh-foreground-muted)]'
                      )}
                    >
                      {survey.responseRate.toFixed(1)}%
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <Link
                      href={`/settings/survey/${survey.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--buh-foreground-muted)] transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]"
                      title="Подробнее"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {surveys.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)]">
              <ClipboardList className="h-8 w-8 text-[var(--buh-foreground-subtle)]" />
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--buh-foreground)]">Нет опросов</p>
            <p className="mt-1 text-sm text-[var(--buh-foreground-subtle)]">
              Создайте первый опрос, чтобы начать сбор отзывов
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--buh-border)] px-6 py-4">
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Показано {(page - 1) * pagination.pageSize + 1} -{' '}
              {Math.min(page * pagination.pageSize, pagination.totalItems)} из{' '}
              {pagination.totalItems}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--buh-border)]',
                  'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors duration-200'
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-[var(--buh-foreground)]">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--buh-border)]',
                  'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors duration-200'
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Decorative glow */}
        <div className="absolute -bottom-20 right-1/4 h-40 w-40 rounded-full bg-[var(--buh-primary)] opacity-5 blur-3xl transition-opacity duration-500 group-hover:opacity-10" />
      </GlassCard>

      {/* Create Survey Modal */}
      <CreateSurveyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refetch()}
        maxRangeDays={maxRangeDays}
      />
    </AdminLayout>
  );
}

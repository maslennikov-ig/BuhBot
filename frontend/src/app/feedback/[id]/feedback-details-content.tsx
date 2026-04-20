'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { trpc } from '@/lib/trpc';
import { ArrowLeft, Loader2, FileWarning, ShieldAlert, TriangleAlert, Star } from 'lucide-react';

type FeedbackDetailsContentProps = {
  feedbackId: string;
};

export function FeedbackDetailsContent({ feedbackId }: FeedbackDetailsContentProps) {
  const { data, isLoading, error } = trpc.feedback.getById.useQuery({ id: feedbackId });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // Dev-only diagnostic signal for state transitions.
      console.debug('[feedback] details query state', {
        feedbackId,
        isLoading,
        hasData: Boolean(data),
        errorCode: error?.data?.code,
      });
    }
  }, [feedbackId, isLoading, data, error]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--buh-primary)]" />
            <p className="text-[var(--buh-foreground-subtle)]">Загрузка отзыва...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const errorCode = error?.data?.code;

  if (errorCode === 'NOT_FOUND') {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Link
            href="/feedback"
            className="inline-flex items-center gap-2 text-sm text-[var(--buh-foreground-muted)] transition-colors hover:text-[var(--buh-foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад к отзывам
          </Link>

          <GlassCard variant="elevated">
            <div className="p-8 text-center">
              <FileWarning className="mx-auto h-12 w-12 text-[var(--buh-foreground-subtle)]" />
              <p className="mt-4 text-[var(--buh-foreground-subtle)]">Отзыв не найден</p>
            </div>
          </GlassCard>
        </div>
      </AdminLayout>
    );
  }

  if (errorCode === 'FORBIDDEN' || errorCode === 'UNAUTHORIZED') {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Link
            href="/feedback"
            className="inline-flex items-center gap-2 text-sm text-[var(--buh-foreground-muted)] transition-colors hover:text-[var(--buh-foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад к отзывам
          </Link>

          <GlassCard variant="elevated">
            <div className="p-8 text-center">
              <ShieldAlert className="mx-auto h-12 w-12 text-[var(--buh-status-warning)]" />
              <p className="mt-4 text-[var(--buh-foreground-subtle)]">
                Недостаточно прав для просмотра этого отзыва
              </p>
            </div>
          </GlassCard>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Link
            href="/feedback"
            className="inline-flex items-center gap-2 text-sm text-[var(--buh-foreground-muted)] transition-colors hover:text-[var(--buh-foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад к отзывам
          </Link>

          <GlassCard variant="elevated">
            <div className="p-8 text-center">
              <TriangleAlert className="mx-auto h-12 w-12 text-[var(--buh-status-critical)]" />
              <p className="mt-4 text-[var(--buh-foreground-subtle)]">
                Не удалось загрузить детали отзыва. Попробуйте обновить страницу.
              </p>
            </div>
          </GlassCard>
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Link
            href="/feedback"
            className="inline-flex items-center gap-2 text-sm text-[var(--buh-foreground-muted)] transition-colors hover:text-[var(--buh-foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад к отзывам
          </Link>

          <GlassCard variant="elevated">
            <div className="p-8 text-center">
              <FileWarning className="mx-auto h-12 w-12 text-[var(--buh-foreground-subtle)]" />
              <p className="mt-4 text-[var(--buh-foreground-subtle)]">Данные временно недоступны</p>
            </div>
          </GlassCard>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Link
          href="/feedback"
          className="inline-flex items-center gap-2 text-sm text-[var(--buh-foreground-muted)] transition-colors hover:text-[var(--buh-foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к отзывам
        </Link>

        <GlassCard variant="elevated">
          <div className="space-y-6 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--buh-foreground)]">Детали отзыва</h1>
                <p className="mt-1 text-sm text-[var(--buh-foreground-subtle)]">ID: {data.id}</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-[var(--buh-surface-elevated)] px-3 py-1.5 text-[var(--buh-warning)]">
                <Star className="h-4 w-4 fill-[var(--buh-warning)]" />
                <span className="text-sm font-semibold">{data.rating}/5</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]">
                  Чат
                </p>
                <p className="mt-1 text-sm text-[var(--buh-foreground)]">
                  {data.chatTitle ?? 'Неизвестный чат'}
                </p>
                <p className="mt-1 text-xs text-[var(--buh-foreground-subtle)]">
                  chatId: {data.chatId}
                </p>
              </div>

              <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]">
                  Клиент
                </p>
                <p className="mt-1 text-sm text-[var(--buh-foreground)]">
                  {data.clientUsername ? `@${data.clientUsername}` : '—'}
                </p>
              </div>

              <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]">
                  Бухгалтер
                </p>
                <p className="mt-1 text-sm text-[var(--buh-foreground)]">
                  {data.accountant?.fullName ?? '—'}
                </p>
                {data.accountant?.email && (
                  <p className="mt-1 text-xs text-[var(--buh-foreground-subtle)]">
                    {data.accountant.email}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]">
                  Дата
                </p>
                <p className="mt-1 text-sm text-[var(--buh-foreground)]">
                  {new Date(data.submittedAt).toLocaleString('ru-RU')}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]">
                Комментарий клиента
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--buh-foreground)]">
                {data.comment?.trim() ? data.comment : 'Комментарий не оставлен'}
              </p>
            </div>

            {data.relatedRequest && (
              <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]">
                  Связанный запрос
                </p>
                <p className="mt-2 text-sm text-[var(--buh-foreground)]">
                  {data.relatedRequest.messageText}
                </p>
                <Link
                  href={`/requests/${data.relatedRequest.id}`}
                  className="mt-3 inline-flex text-sm text-[var(--buh-primary)] hover:underline"
                >
                  Открыть запрос
                </Link>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </AdminLayout>
  );
}

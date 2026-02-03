'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { StatusBadge } from '@/components/logs/StatusBadge';
import { trpc } from '@/lib/trpc';
import {
  ArrowLeft,
  Calendar,
  Server,
  Hash,
  AlertTriangle,
  FileWarning,
  Info,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type ErrorLevel = 'error' | 'warn' | 'info';
type ErrorStatus = 'new' | 'in_progress' | 'resolved' | 'ignored';

const levelConfig = {
  error: {
    label: 'Error',
    icon: AlertTriangle,
    color: 'var(--buh-error)',
    bgColor: 'var(--buh-error-muted)',
  },
  warn: {
    label: 'Warning',
    icon: FileWarning,
    color: 'var(--buh-warning)',
    bgColor: 'var(--buh-warning-muted)',
  },
  info: {
    label: 'Info',
    icon: Info,
    color: 'var(--buh-info)',
    bgColor: 'var(--buh-info-muted)',
  },
};

function LevelBadge({ level }: { level: ErrorLevel }) {
  const config = levelConfig[level];
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
// COMPONENT
// ============================================

export default function LogDetailPage() {
  const params = useParams();
  const errorId = params.id as string;

  const { data, isLoading } = trpc.logs.getById.useQuery({ id: errorId });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--buh-primary)]" />
            <p className="text-[var(--buh-foreground-subtle)]">Загрузка...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <FileWarning className="mx-auto h-12 w-12 text-[var(--buh-foreground-subtle)]" />
            <p className="mt-4 text-[var(--buh-foreground-subtle)]">Ошибка не найдена</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const { error, relatedErrors } = data;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Back button */}
        <Link
          href="/logs"
          className="inline-flex items-center gap-2 text-sm text-[var(--buh-foreground-muted)] transition-colors hover:text-[var(--buh-foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к логам
        </Link>

        {/* Error details */}
        <GlassCard variant="elevated">
          <div className="space-y-6 p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-[var(--buh-foreground)]">{error.message}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--buh-foreground-subtle)]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {new Date(error.timestamp).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Server className="h-4 w-4" />
                    {error.service}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-4 w-4" />
                    {error.occurrenceCount} раз
                  </div>
                  <LevelBadge level={error.level as ErrorLevel} />
                </div>
              </div>
              <StatusBadge status={error.status as ErrorStatus} />
            </div>

            {/* Stack trace */}
            {error.stack && (
              <div className="space-y-2">
                <h3 className="font-semibold text-[var(--buh-foreground)]">Stack Trace</h3>
                <pre className="overflow-x-auto rounded-lg bg-[var(--buh-surface)] p-4 text-xs">
                  <code className="text-[var(--buh-foreground-muted)]">{error.stack}</code>
                </pre>
              </div>
            )}

            {/* Metadata */}
            {error.metadata && (
              <div className="space-y-2">
                <h3 className="font-semibold text-[var(--buh-foreground)]">Metadata</h3>
                <pre className="overflow-x-auto rounded-lg bg-[var(--buh-surface)] p-4 text-xs">
                  <code className="text-[var(--buh-foreground-muted)]">
                    {JSON.stringify(error.metadata, null, 2)}
                  </code>
                </pre>
              </div>
            )}

            {/* Notes */}
            {error.notes && (
              <div className="space-y-2">
                <h3 className="font-semibold text-[var(--buh-foreground)]">Заметки</h3>
                <p className="text-sm text-[var(--buh-foreground-muted)]">{error.notes}</p>
              </div>
            )}

            {/* Fingerprint */}
            <div className="space-y-2">
              <h3 className="font-semibold text-[var(--buh-foreground)]">Fingerprint</h3>
              <code className="block rounded-lg bg-[var(--buh-surface)] p-3 text-xs text-[var(--buh-foreground-muted)]">
                {error.fingerprint}
              </code>
            </div>
          </div>
        </GlassCard>

        {/* Related errors */}
        {relatedErrors.length > 0 && (
          <GlassCard variant="elevated">
            <div className="p-6">
              <h3 className="mb-4 font-semibold text-[var(--buh-foreground)]">
                Похожие ошибки ({relatedErrors.length})
              </h3>
              <div className="space-y-2">
                {relatedErrors.map((relErr) => (
                  <Link
                    key={relErr.id}
                    href={`/logs/${relErr.id}`}
                    className={cn(
                      'block rounded-lg border border-[var(--buh-border)] p-3 transition-colors hover:bg-[var(--buh-surface-elevated)]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-[var(--buh-foreground-muted)]">
                          {new Date(relErr.timestamp).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <LevelBadge level={relErr.level as ErrorLevel} />
                      </div>
                      <StatusBadge status={relErr.status as ErrorStatus} />
                    </div>
                    <p className="mt-2 truncate text-sm text-[var(--buh-foreground)]">
                      {relErr.message}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </GlassCard>
        )}
      </div>
    </AdminLayout>
  );
}

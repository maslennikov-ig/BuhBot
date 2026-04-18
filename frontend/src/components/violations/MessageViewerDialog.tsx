'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Maximize2, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatDuration } from '@/lib/format-duration';

/**
 * Data required to render the full-message dialog.
 *
 * Fields intentionally parallel the row shape on /violations so a row can be
 * passed verbatim. `messageText` and `chatId` come straight from the tRPC
 * `sla.getRequests` payload — the table itself only shows a preview.
 */
export type MessageViewerDialogRequest = {
  /** Full, untruncated body of the incoming client message. May be empty. */
  messageText: string;
  /** Client-side display name (username or fallback). */
  clientUsername: string;
  /** Title of the Telegram chat the message came from. */
  chatTitle: string;
  /**
   * Supabase/Prisma chatId as string. When present, we link to `/chats/{id}`
   * so operators can jump into chat settings without leaving triage context.
   * Undefined/null is tolerated — the link falls back to plain text.
   */
  chatId?: string | null;
  receivedAt: Date;
  respondedAt: Date | null;
  slaMinutes: number;
  excessMinutes: number;
  excessSevere: boolean;
  /** Still open when the request has no response yet. */
  isOpenBreach: boolean;
};

export type MessageViewerDialogProps = {
  request: MessageViewerDialogRequest;
  /** Preview text rendered inline next to the icon on the trigger button. */
  preview: string;
};

const RU_DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return RU_DATE_FORMAT.format(date);
}

/**
 * Accessible modal (shadcn Dialog / Radix) that shows the full client message
 * from a /violations row plus triage metadata (chat, client, timestamps,
 * SLA excess). Keyboard-accessible by Radix defaults — focus trap, ESC close,
 * return-focus on close, aria-labelledby wired via DialogTitle.
 *
 * gh-293 — replaces the non-accessible native `title` tooltip pattern.
 */
export function MessageViewerDialog({ request, preview }: MessageViewerDialogProps) {
  const triggerLabel = `Показать полное сообщение от ${request.clientUsername}`;
  const isEmpty = request.messageText.trim().length === 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          className="group flex max-w-[250px] items-center gap-2 text-left text-[var(--buh-foreground-muted)] transition-colors hover:text-[var(--buh-foreground)] focus-visible:text-[var(--buh-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--buh-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--buh-surface)] rounded-sm"
        >
          <span className="truncate">{preview || '—'}</span>
          <Maximize2
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-[var(--buh-foreground-subtle)] transition-colors group-hover:text-[var(--buh-foreground-muted)] group-focus-visible:text-[var(--buh-foreground-muted)]"
          />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl bg-[var(--buh-surface)] text-[var(--buh-foreground)] border-[var(--buh-border)]">
        <DialogHeader>
          <DialogTitle>Сообщение клиента</DialogTitle>
          <DialogDescription>
            Полный текст сообщения из нарушения SLA, с метаданными для триажа.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]">
              Чат
            </dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-[var(--buh-foreground)]">
              {request.chatId ? (
                <Link
                  href={`/chats/${request.chatId}`}
                  className="inline-flex items-center gap-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--buh-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--buh-surface)] rounded-sm"
                >
                  {request.chatTitle}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
              ) : (
                <span>{request.chatTitle}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]">
              Клиент
            </dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-[var(--buh-foreground)]">
              <User className="h-3.5 w-3.5 text-[var(--buh-foreground-muted)]" aria-hidden />
              {request.clientUsername}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]">
              Получено
            </dt>
            <dd className="mt-0.5 text-[var(--buh-foreground-muted)]">
              {formatDate(request.receivedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]">
              Ответ
            </dt>
            <dd className="mt-0.5 text-[var(--buh-foreground-muted)]">
              {formatDate(request.respondedAt)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]">
              Превышение SLA
            </dt>
            <dd className="mt-0.5">
              <span
                className={
                  request.excessSevere
                    ? 'inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-error)]/20 px-2.5 py-1 text-xs font-semibold text-[var(--buh-error)] ring-1 ring-[var(--buh-error)]/30'
                    : 'inline-flex items-center gap-1.5 rounded-full bg-[var(--buh-error)]/10 px-2.5 py-1 text-xs font-medium text-[var(--buh-error)]'
                }
              >
                <AlertTriangle className="h-3 w-3" aria-hidden />+
                {formatDuration(request.excessMinutes)}
                <span className="text-[10px] opacity-60">
                  (SLA {formatDuration(request.slaMinutes)}
                  {request.isOpenBreach ? ', ответа пока нет' : ''})
                </span>
              </span>
            </dd>
          </div>
        </dl>

        <section aria-labelledby="message-viewer-body-label">
          <h3
            id="message-viewer-body-label"
            className="mb-2 text-xs uppercase tracking-wide text-[var(--buh-foreground-subtle)]"
          >
            Текст сообщения
          </h3>
          {isEmpty ? (
            <p className="rounded-md border border-dashed border-[var(--buh-border)] bg-[var(--buh-surface-elevated)] p-3 text-sm italic text-[var(--buh-foreground-muted)]">
              Сообщение пустое.
            </p>
          ) : (
            <pre
              tabIndex={0}
              className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--buh-border)] bg-[var(--buh-surface-elevated)] p-3 text-sm text-[var(--buh-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--buh-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--buh-surface)]"
            >
              {request.messageText}
            </pre>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

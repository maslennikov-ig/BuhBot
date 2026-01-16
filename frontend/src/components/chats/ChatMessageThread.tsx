'use client';

/**
 * ChatMessageThread - Displays chat message history
 *
 * Shows messages in a chat-like interface with:
 * - Client messages aligned left
 * - Accountant messages aligned right
 * - Infinite scroll with cursor-based pagination
 */

import * as React from 'react';
import { User, Bot, Clock, MessageSquare, AlertTriangle, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type ChatMessageThreadProps = {
  chatId: number;
};

export function ChatMessageThread({ chatId }: ChatMessageThreadProps) {
  // Fetch messages with cursor-based pagination
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.messages.listByChat.useInfiniteQuery(
    { chatId, limit: 30 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    }
  );

  // Flatten messages from all pages
  const messages = React.useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.messages).reverse(); // Show oldest first
  }, [data]);

  // Scroll container ref for infinite scroll
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Load more when scrolling to top
  const handleScroll = React.useCallback(() => {
    if (!scrollRef.current || !hasNextPage || isFetchingNextPage) return;

    const { scrollTop } = scrollRef.current;
    if (scrollTop < 100) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Format time
  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--buh-accent)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--buh-error)]/10 mb-4">
          <AlertTriangle className="h-8 w-8 text-[var(--buh-error)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--buh-foreground)] mb-2">
          Ошибка загрузки
        </h3>
        <p className="text-sm text-[var(--buh-foreground-muted)] mb-4 max-w-xs">
          {error.message || 'Не удалось загрузить историю сообщений'}
        </p>
        <Button
          variant="outline"
          onClick={() => refetch()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Повторить
        </Button>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--buh-surface-overlay)] mb-4">
          <MessageSquare className="h-8 w-8 text-[var(--buh-foreground-muted)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--buh-foreground)] mb-2">
          Нет сообщений
        </h3>
        <p className="text-sm text-[var(--buh-foreground-muted)]">
          Сообщения появятся здесь после того, как бот начнёт их логировать
        </p>
      </div>
    );
  }

  // Group messages by date
  let currentDate = '';

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-[500px] overflow-y-auto buh-scrollbar space-y-3 p-4"
    >
      {isFetchingNextPage && (
        <div className="flex justify-center py-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--buh-accent)]" />
        </div>
      )}

      {messages.map((message) => {
        const messageDate = formatDate(message.createdAt);
        const showDateDivider = messageDate !== currentDate;
        // eslint-disable-next-line react-hooks/immutability
        currentDate = messageDate;

        return (
          <React.Fragment key={message.id}>
            {showDateDivider && (
              <div className="flex items-center justify-center py-2">
                <span className="px-3 py-1 text-xs text-[var(--buh-foreground-muted)] bg-[var(--buh-surface-overlay)] rounded-full">
                  {messageDate}
                </span>
              </div>
            )}

            <div
              className={cn(
                'flex gap-3 max-w-[85%]',
                message.isAccountant ? 'ml-auto flex-row-reverse' : ''
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  message.isAccountant
                    ? 'bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)]'
                    : 'bg-[var(--buh-surface-elevated)] border border-[var(--buh-border)]'
                )}
              >
                {message.isAccountant ? (
                  <Bot className="h-4 w-4 text-white" />
                ) : (
                  <User className="h-4 w-4 text-[var(--buh-foreground-muted)]" />
                )}
              </div>

              {/* Message bubble */}
              <div
                className={cn(
                  'rounded-2xl px-4 py-2.5',
                  message.isAccountant
                    ? 'bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10 border border-[var(--buh-accent)]/20'
                    : 'bg-[var(--buh-surface-overlay)] border border-[var(--buh-border)]'
                )}
              >
                {/* Sender name */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      message.isAccountant
                        ? 'text-[var(--buh-accent)]'
                        : 'text-[var(--buh-foreground-muted)]'
                    )}
                  >
                    {message.username
                      ? `@${message.username}`
                      : message.firstName || 'Пользователь'}
                  </span>
                  <span className="text-xs text-[var(--buh-foreground-subtle)]">
                    {formatTime(message.createdAt)}
                  </span>
                </div>

                {/* Message text */}
                <p className="text-sm text-[var(--buh-foreground)] whitespace-pre-wrap break-words">
                  {message.messageText}
                </p>

                {/* Resolution indicator */}
                {message.resolvedRequestId && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-[var(--buh-success)]">
                    <Clock className="h-3 w-3" />
                    <span>Ответ на запрос</span>
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

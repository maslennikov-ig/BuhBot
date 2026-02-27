'use client';

/**
 * TelegramAuthModal Component
 *
 * Dialog for verifying and linking a user's Telegram account.
 * Looks up the user's Telegram ID from chat message history by username,
 * sends a verification message via the bot, and links the account.
 *
 * @module components/chats/TelegramAuthModal
 */

import * as React from 'react';
import { X, MessageCircle, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type TelegramAuthModalProps = {
  open: boolean;
  user: { id: string; name: string } | null;
  onClose: () => void;
  onSuccess: (telegramId: string) => void;
};

type ModalState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; telegramId: string; username: string }
  | { status: 'error'; code: 'user_not_found_in_messages' | 'bot_blocked' | 'unknown' };

// ============================================
// TELEGRAM AUTH MODAL COMPONENT
// ============================================

/**
 * TelegramAuthModal - Verify and link a user's Telegram account
 *
 * States:
 * - Initial: input @username, button "Проверить и отправить"
 * - Loading: spinner
 * - Success: confirmation message, button "Готово"
 * - Error user_not_found_in_messages: user not found in chat history
 * - Error bot_blocked: bot cannot send message to user
 */
export function TelegramAuthModal({ open, user, onClose, onSuccess }: TelegramAuthModalProps) {
  const [username, setUsername] = React.useState('');
  const [state, setState] = React.useState<ModalState>({ status: 'idle' });

  // Reset state when user changes or modal opens
  React.useEffect(() => {
    if (open) {
      setUsername('');
      setState({ status: 'idle' });
    }
  }, [open, user?.id]);

  const verifyMutation = trpc.user.verifyTelegramUsername.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setState({ status: 'success', telegramId: data.telegramId, username });
      } else {
        setState({ status: 'error', code: data.error });
      }
    },
    onError: () => {
      setState({ status: 'error', code: 'unknown' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !username.trim()) return;

    setState({ status: 'loading' });
    verifyMutation.mutate({
      userId: user.id,
      username: username.trim(),
    });
  };

  const handleDone = () => {
    if (state.status === 'success') {
      onSuccess(state.telegramId);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <GlassCard
        variant="elevated"
        padding="lg"
        className="w-full max-w-md relative animate-in fade-in zoom-in duration-200"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--buh-primary-muted)]">
            <MessageCircle className="h-6 w-6 text-[var(--buh-primary)]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">
              Привязка Telegram
            </h2>
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Пользователь: <strong>{user.name}</strong>
            </p>
          </div>
        </div>

        {/* Content based on state */}
        {(state.status === 'idle' || state.status === 'loading') && (
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-[var(--buh-foreground-muted)] mb-4">
              Пользователь {user.name} не привязал Telegram
            </p>

            <div className="mb-6">
              <label
                htmlFor="tg-username-input"
                className="block text-sm font-medium text-[var(--buh-foreground)] mb-2"
              >
                Telegram username
              </label>
              <input
                id="tg-username-input"
                type="text"
                placeholder="@username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={state.status === 'loading'}
                className={cn(
                  'h-10 w-full rounded-lg border px-4 text-sm',
                  'bg-[var(--buh-surface)] border-[var(--buh-border)]',
                  'placeholder:text-[var(--buh-foreground-subtle)]',
                  'focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]',
                  'disabled:opacity-50'
                )}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={!username.trim() || state.status === 'loading'}
                className={cn(
                  'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
                  'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]'
                )}
              >
                {state.status === 'loading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  'Проверить и отправить'
                )}
              </Button>
            </div>
          </form>
        )}

        {state.status === 'success' && (
          <div>
            <div className="flex items-start gap-3 mb-6 p-4 rounded-lg bg-[var(--buh-success-muted)]">
              <CheckCircle2 className="h-5 w-5 text-[var(--buh-success)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--buh-foreground)]">
                Аккаунт @{state.username.replace(/^@/, '')} привязан, уведомление отправлено
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleDone}
                className={cn(
                  'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
                  'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]'
                )}
              >
                Готово
              </Button>
            </div>
          </div>
        )}

        {state.status === 'error' && state.code === 'user_not_found_in_messages' && (
          <div>
            <div className="flex items-start gap-3 mb-4 p-4 rounded-lg bg-[var(--buh-error-muted)]">
              <AlertTriangle className="h-5 w-5 text-[var(--buh-error)] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--buh-error)]">
                  Пользователь не найден в истории сообщений чата
                </p>
                <p className="text-sm text-[var(--buh-foreground-muted)] mt-1">
                  Попросите пользователя сначала написать любое сообщение в одном из чатов, где
                  присутствует бот, чтобы система могла определить его Telegram ID.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleClose}>
                Закрыть
              </Button>
              <Button variant="outline" onClick={() => setState({ status: 'idle' })}>
                Попробовать снова
              </Button>
            </div>
          </div>
        )}

        {state.status === 'error' && state.code === 'bot_blocked' && (
          <div>
            <div className="flex items-start gap-3 mb-4 p-4 rounded-lg bg-[var(--buh-error-muted)]">
              <AlertTriangle className="h-5 w-5 text-[var(--buh-error)] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--buh-error)]">
                  Бот не может отправить сообщение пользователю
                </p>
                <p className="text-sm text-[var(--buh-foreground-muted)] mt-1">
                  Пользователь должен начать диалог с ботом{' '}
                  <strong className="text-[var(--buh-foreground)]">@buhbot_bot</strong> в Telegram,
                  после чего повторите привязку.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleClose}>
                Закрыть
              </Button>
              <Button variant="outline" onClick={() => setState({ status: 'idle' })}>
                Попробовать снова
              </Button>
            </div>
          </div>
        )}

        {state.status === 'error' && state.code === 'unknown' && (
          <div>
            <div className="flex items-start gap-3 mb-4 p-4 rounded-lg bg-[var(--buh-error-muted)]">
              <AlertTriangle className="h-5 w-5 text-[var(--buh-error)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--buh-error)]">
                Произошла непредвиденная ошибка. Попробуйте позже.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleClose}>
                Закрыть
              </Button>
              <Button variant="outline" onClick={() => setState({ status: 'idle' })}>
                Попробовать снова
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

export default TelegramAuthModal;

'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/layout/GlassCard';
import { X, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type UserItem = RouterOutputs['auth']['listUsers'][number];

interface UserTelegramDialogProps {
  user: UserItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserTelegramDialog({ user, open, onClose, onSuccess }: UserTelegramDialogProps) {
  const [telegramId, setTelegramId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useContext();

  React.useEffect(() => {
    if (user) {
      setTelegramId(user.telegramId ?? '');
      setError(null);
    }
  }, [user]);

  const setTelegramIdMutation = trpc.auth.setUserTelegramId.useMutation({
    onSuccess: () => {
      utils.auth.listUsers.invalidate();
      toast.success('Telegram ID обновлен');
      setError(null);
      onSuccess();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSave = async () => {
    if (!user) return;
    setError(null);

    const trimmed = telegramId.trim();
    if (trimmed && !/^\d+$/.test(trimmed)) {
      setError('Telegram ID должен содержать только цифры');
      return;
    }

    await setTelegramIdMutation.mutateAsync({
      userId: user.id,
      telegramId: trimmed || null,
    });
  };

  const handleClear = async () => {
    if (!user) return;
    setError(null);

    await setTelegramIdMutation.mutateAsync({
      userId: user.id,
      telegramId: null,
    });
  };

  const handleClose = () => {
    setError(null);
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
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--buh-primary-muted)]">
            <MessageCircle className="h-6 w-6 text-[var(--buh-primary)]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">Telegram ID</h2>
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Пользователь: <strong>{user.fullName}</strong>
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label
            htmlFor="telegram-id-input"
            className="block text-sm font-medium text-[var(--buh-foreground)] mb-2"
          >
            Telegram ID
          </label>
          <input
            id="telegram-id-input"
            type="text"
            inputMode="numeric"
            placeholder="Например: 123456789"
            value={telegramId}
            onChange={(e) => {
              // Allow only digits
              const value = e.target.value.replace(/\D/g, '');
              setTelegramId(value);
              setError(null);
            }}
            className="h-10 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] px-4 text-sm focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]"
          />
          <p className="mt-1 text-xs text-[var(--buh-foreground-subtle)]">
            Числовой ID пользователя в Telegram (можно узнать через @userinfobot)
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--buh-error-muted)] text-[var(--buh-error)] text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-between">
          <div>
            {user.telegramId && (
              <Button
                variant="ghost"
                onClick={handleClear}
                disabled={setTelegramIdMutation.isPending}
                className="text-[var(--buh-error)] hover:text-[var(--buh-error)] hover:bg-[var(--buh-error-muted)]"
              >
                Отвязать
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleClose}>
              Отмена
            </Button>
            <Button
              className="buh-btn-primary"
              onClick={handleSave}
              disabled={setTelegramIdMutation.isPending}
            >
              {setTelegramIdMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

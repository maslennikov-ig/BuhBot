'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/layout/GlassCard';
import { X, AlertTriangle } from 'lucide-react';

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type UserItem = RouterOutputs['auth']['listUsers'][number];

interface UserDeleteDialogProps {
  user: UserItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserDeleteDialog({ user, open, onClose, onSuccess }: UserDeleteDialogProps) {
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useContext();

  const deleteUserMutation = trpc.auth.deleteUser.useMutation({
    onSuccess: () => {
      utils.auth.listUsers.invalidate();
      setError(null);
      onSuccess();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleDelete = async () => {
    if (!user) return;
    setError(null);
    await deleteUserMutation.mutateAsync({ userId: user.id });
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
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--buh-error-muted)]">
            <AlertTriangle className="h-6 w-6 text-[var(--buh-error)]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">
              Удаление пользователя
            </h2>
            <p className="text-sm text-[var(--buh-foreground-muted)]">Это действие необратимо</p>
          </div>
        </div>

        <p className="text-sm text-[var(--buh-foreground-muted)] mb-6">
          Вы уверены, что хотите удалить пользователя{' '}
          <strong className="text-[var(--buh-foreground)]">{user.fullName}</strong> ({user.email})?
          <br />
          <br />
          Все назначенные чаты будут откреплены от этого пользователя.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--buh-error-muted)] text-[var(--buh-error)] text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteUserMutation.isPending}
            className="bg-[var(--buh-error)] hover:bg-[var(--buh-error)]/90"
          >
            {deleteUserMutation.isPending ? 'Удаление...' : 'Удалить'}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

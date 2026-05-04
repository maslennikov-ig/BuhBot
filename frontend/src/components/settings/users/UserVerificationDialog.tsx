'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/layout/GlassCard';
import { X, Copy, Check, Send, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface UserVerificationDialogProps {
  userId: string;
  userName: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserVerificationDialog({
  userId,
  userName,
  open,
  onClose,
  onSuccess,
}: UserVerificationDialogProps) {
  const [copiedLink, setCopiedLink] = React.useState(false);
  const utils = trpc.useContext();

  const regenerateMutation = trpc.auth.regenerateVerificationLink.useMutation({
    onSuccess: (data) => {
      utils.auth.listUsers.invalidate();
      toast.success('Ссылка создана', {
        description: `Срок действия до ${new Date(data.expiresAt).toLocaleDateString('ru-RU')}`,
        icon: <Send className="h-4 w-4" />,
      });
      onSuccess();
    },
    onError: (err) => {
      toast.error('Ошибка', { description: err.message });
    },
  });

  const handleRegenerate = () => {
    regenerateMutation.mutate({ userId });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success('Скопировано в буфер обмена');
    } catch {
      toast.error('Ошибка копирования');
    }
  };

  const handleClose = () => {
    setCopiedLink(false);
    onClose();
  };

  if (!open) return null;

  const verificationLink = regenerateMutation.data?.verificationLink ?? null;

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

        <h2 className="text-xl font-semibold mb-2 text-[var(--buh-foreground)]">
          Подключение Telegram
        </h2>
        <p className="text-sm text-[var(--buh-foreground-muted)] mb-4">
          Отправьте эту ссылку <strong>{userName}</strong> для подключения через Telegram. Ссылку
          нужно открыть именно в приложении Telegram.
        </p>

        {verificationLink ? (
          <>
            <div className="mb-4 p-3 rounded-lg bg-[var(--buh-surface-elevated)] border border-[var(--buh-border)]">
              <p className="text-xs text-[var(--buh-foreground-muted)] mb-2">Ссылка для Telegram</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-[var(--buh-foreground)] break-all">
                  {verificationLink}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(verificationLink)}
                  className="shrink-0"
                >
                  {copiedLink ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRegenerate}
                disabled={regenerateMutation.isPending}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${regenerateMutation.isPending ? 'animate-spin' : ''}`}
                />
                Новая ссылка
              </Button>
              <Button type="button" onClick={handleClose}>
                Готово
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerateMutation.isPending}
              className="buh-btn-primary"
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${regenerateMutation.isPending ? 'animate-spin' : ''}`}
              />
              {regenerateMutation.isPending ? 'Генерация...' : 'Создать ссылку'}
            </Button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

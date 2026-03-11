'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/layout/GlassCard';
import { X, Mail, Copy, Check, Send } from 'lucide-react';
import { toast } from 'sonner';

import { inferRouterInputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterInputs = inferRouterInputs<AppRouter>;
type UserRole = RouterInputs['auth']['createUser']['role'];

import { ROLES } from './constants';

interface UserCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserCreateDialog({ open, onClose, onSuccess }: UserCreateDialogProps) {
  const [email, setEmail] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState<UserRole>('observer');
  const [error, setError] = React.useState<string | null>(null);
  const [verificationLink, setVerificationLink] = React.useState<string | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const utils = trpc.useContext();

  const createUserMutation = trpc.auth.createUser.useMutation({
    onSuccess: (data) => {
      utils.auth.listUsers.invalidate();

      // For accountant: show TG deep link instead of closing
      if (data.verificationLink) {
        setVerificationLink(data.verificationLink);
        setError(null);
        toast.success('Бухгалтер создан', {
          description: 'Отправьте ссылку для подключения через Telegram',
          icon: <Send className="h-4 w-4" />,
        });
        return;
      }

      // Non-accountant: close dialog and show invite toast
      onSuccess();
      setEmail('');
      setFullName('');
      setSelectedRole('observer');
      setError(null);
      onClose();
      if (data.inviteSent) {
        toast.success('Пользователь создан', {
          description: `Приглашение отправлено на ${data.email}`,
          icon: <Mail className="h-4 w-4" />,
        });
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email обязателен');
      return;
    }

    if (!fullName.trim()) {
      setError('Имя обязательно');
      return;
    }

    await createUserMutation.mutateAsync({
      email: email.trim(),
      fullName: fullName.trim(),
      role: selectedRole,
    });
  };

  const handleClose = () => {
    const hadVerificationLink = !!verificationLink;
    setEmail('');
    setFullName('');
    setSelectedRole('observer');
    setError(null);
    setVerificationLink(null);
    setCopiedLink(false);
    if (hadVerificationLink) {
      onSuccess();
    }
    onClose();
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

  if (!open) return null;

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

        {verificationLink ? (
          <>
            <h2 className="text-xl font-semibold mb-2 text-[var(--buh-foreground)]">
              Бухгалтер создан
            </h2>
            <p className="text-sm text-[var(--buh-foreground-muted)] mb-4">
              Отправьте эту ссылку бухгалтеру для подключения через Telegram.
            </p>

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

            <div className="flex justify-end">
              <Button type="button" onClick={handleClose}>
                Готово
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-2 text-[var(--buh-foreground)]">
              Добавить пользователя
            </h2>
            <p className="text-sm text-[var(--buh-foreground-muted)] mb-6">
              {selectedRole === 'accountant'
                ? 'После создания вы получите ссылку для подключения через Telegram.'
                : 'Приглашение с ссылкой для установки пароля будет отправлено на указанный email.'}
            </p>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-[var(--buh-error-muted)] text-[var(--buh-error)] text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--buh-foreground)] mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="h-10 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] px-3 text-sm focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--buh-foreground)] mb-1">
                    Полное имя
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иван Иванов"
                    className="h-10 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] px-3 text-sm focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--buh-foreground)] mb-2">
                    Роль
                  </label>
                  <div className="space-y-2">
                    {ROLES.map((role) => (
                      <div
                        key={role.value}
                        onClick={() => setSelectedRole(role.value)}
                        className={`cursor-pointer rounded-lg border p-3 transition-all ${
                          selectedRole === role.value
                            ? 'border-[var(--buh-primary)] bg-[var(--buh-primary-muted)]'
                            : 'border-[var(--buh-border)] hover:bg-[var(--buh-surface-elevated)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`font-medium ${selectedRole === role.value ? 'text-[var(--buh-primary)]' : 'text-[var(--buh-foreground)]'}`}
                          >
                            {role.label}
                          </span>
                          {selectedRole === role.value && (
                            <div className="h-2 w-2 rounded-full bg-[var(--buh-primary)]" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--buh-foreground-muted)]">
                          {role.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="buh-btn-primary"
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? 'Создание...' : 'Создать'}
                </Button>
              </div>
            </form>
          </>
        )}
      </GlassCard>
    </div>
  );
}

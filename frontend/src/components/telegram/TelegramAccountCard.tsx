import React from 'react';
import { User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TelegramAccountCardProps {
  telegramAccount: {
    id: string;
    telegramId: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    photoUrl?: string | null;
    linkedAt: Date | string;
  };
  onDisconnect: () => void;
  isDisconnecting?: boolean;
  className?: string;
}

export function TelegramAccountCard({
  telegramAccount,
  onDisconnect,
  isDisconnecting = false,
  className,
}: TelegramAccountCardProps) {
  const displayName = [telegramAccount.firstName, telegramAccount.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cn(
        'flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-[var(--buh-surface-elevated)] border border-[var(--buh-border)]',
        className
      )}
    >
      <div className="flex items-center gap-4">
        {telegramAccount.photoUrl ? (
          <img
            src={telegramAccount.photoUrl}
            alt={displayName}
            className="h-12 w-12 rounded-full object-cover border border-[var(--buh-border)]"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)] text-white">
            <User className="h-6 w-6" />
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--buh-foreground)]">
              {displayName || 'Telegram User'}
            </span>
            {telegramAccount.username && (
              <span className="text-sm text-[var(--buh-foreground-muted)]">
                @{telegramAccount.username}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--buh-foreground-subtle)]">
            ID: {telegramAccount.telegramId} • Подключено{' '}
            {new Date(telegramAccount.linkedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={onDisconnect}
        disabled={isDisconnecting}
        className="text-[var(--buh-error)] hover:text-[var(--buh-error)] hover:bg-[var(--buh-error-muted)] border-[var(--buh-error-muted)]"
      >
        {isDisconnecting ? (
          'Отключение...'
        ) : (
          <>
            <LogOut className="w-4 h-4 mr-2" />
            Отключить
          </>
        )}
      </Button>
    </div>
  );
}

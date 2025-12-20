'use client';

/**
 * AccountantUsernamesInput Component
 *
 * Multi-input component for entering and managing Telegram @username list.
 * Displays usernames as removable chips/tags.
 *
 * @module components/chats/AccountantUsernamesInput
 */

import * as React from 'react';
import { X, Plus, User } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type AccountantUsernamesInputProps = {
  value: string[];
  onChange: (usernames: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

// ============================================
// USERNAME VALIDATION
// ============================================

/**
 * Validates Telegram username format
 * - 5 to 32 characters
 * - Alphanumeric and underscore only
 * - Cannot start/end with underscore
 */
const isValidUsername = (username: string): boolean => {
  const cleaned = username.replace(/^@/, '');
  if (cleaned.length < 5 || cleaned.length > 32) return false;
  if (cleaned.startsWith('_') || cleaned.endsWith('_')) return false;
  return /^[a-zA-Z0-9_]+$/.test(cleaned);
};

/**
 * Cleans username by removing @ prefix
 */
const cleanUsername = (username: string): string => {
  return username.replace(/^@/, '');
};

// ============================================
// ACCOUNTANT USERNAMES INPUT COMPONENT
// ============================================

/**
 * AccountantUsernamesInput - Multi-input for Telegram usernames
 *
 * Features:
 * - Add username by pressing Enter or clicking "+" button
 * - Remove username by clicking X on chip
 * - Validates username format
 * - Prevents duplicates
 * - Auto-cleans @ prefix
 * - BuhBot design system styling
 */
export function AccountantUsernamesInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'Введите @username',
  className,
}: AccountantUsernamesInputProps) {
  const [inputValue, setInputValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Add username to list
  const addUsername = () => {
    if (!inputValue.trim()) return;

    const cleaned = cleanUsername(inputValue.trim());

    // Validate format
    if (!isValidUsername(cleaned)) {
      setError('Неверный формат username (5-32 символа, латиница, цифры, _)');
      return;
    }

    // Check for duplicates
    if (value.includes(cleaned)) {
      setError('Этот username уже добавлен');
      return;
    }

    // Add to list
    onChange([...value, cleaned]);
    setInputValue('');
    setError(null);
  };

  // Remove username from list
  const removeUsername = (usernameToRemove: string) => {
    onChange(value.filter((u) => u !== usernameToRemove));
  };

  // Handle Enter key
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addUsername();
    }
  };

  // Clear error when input changes
  React.useEffect(() => {
    if (error && inputValue) {
      setError(null);
    }
  }, [inputValue, error]);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Input Container */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
              'flex w-full rounded-lg border px-3 py-2.5 text-sm',
              'bg-[var(--buh-surface)] border-[var(--buh-border)]',
              'placeholder:text-[var(--buh-foreground-subtle)]',
              'transition-all duration-200',
              'focus:outline-none focus:border-[var(--buh-accent)] focus:ring-2 focus:ring-[var(--buh-accent-glow)]',
              disabled && 'opacity-50 cursor-not-allowed',
              error && 'border-[var(--buh-error)] focus:border-[var(--buh-error)] focus:ring-[var(--buh-error-muted)]'
            )}
          />
        </div>

        {/* Add Button */}
        <button
          type="button"
          onClick={addUsername}
          disabled={disabled || !inputValue.trim()}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
            'text-white transition-all duration-200',
            'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
            'focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]'
          )}
          aria-label="Добавить username"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md border border-[var(--buh-error)] bg-[var(--buh-error-muted)] px-3 py-2 text-xs text-[var(--buh-error)] buh-animate-fade-in-up">
          {error}
        </div>
      )}

      {/* Username Chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((username) => (
            <div
              key={username}
              className={cn(
                'group flex items-center gap-2 rounded-full border px-3 py-1.5',
                'bg-[var(--buh-primary-muted)] border-[var(--buh-border)]',
                'transition-all duration-150',
                'hover:border-[var(--buh-primary)] hover:bg-[var(--buh-primary-muted)]',
                'buh-animate-fade-in-scale'
              )}
            >
              {/* User Icon */}
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)]">
                <User className="h-2.5 w-2.5 text-white" />
              </div>

              {/* Username */}
              <span className="text-sm font-medium text-[var(--buh-foreground)]">
                @{username}
              </span>

              {/* Remove Button */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeUsername(username)}
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full',
                    'text-[var(--buh-foreground-muted)]',
                    'transition-colors duration-150',
                    'hover:bg-[var(--buh-error)] hover:text-white',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--buh-error)]'
                  )}
                  aria-label={`Удалить ${username}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {value.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--buh-border)] bg-[var(--buh-surface-elevated)] px-4 py-3 text-center">
          <p className="text-sm text-[var(--buh-foreground-subtle)] italic">
            Список @username бухгалтеров пуст
          </p>
        </div>
      )}
    </div>
  );
}

export default AccountantUsernamesInput;

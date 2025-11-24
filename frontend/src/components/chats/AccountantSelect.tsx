'use client';

/**
 * AccountantSelect Component
 *
 * Dropdown component for selecting an accountant to assign to a chat.
 * Supports unassign option (null value).
 *
 * @module components/chats/AccountantSelect
 */

import * as React from 'react';
import { ChevronDown, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export type Accountant = {
  id: string;
  name: string;
  email: string;
};

type AccountantSelectProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  accountants?: Accountant[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

// ============================================
// MOCK DATA (to be replaced with tRPC query)
// ============================================

const MOCK_ACCOUNTANTS: Accountant[] = [
  { id: 'acc-1', name: 'Иванов Иван', email: 'ivanov@example.com' },
  { id: 'acc-2', name: 'Петрова Анна', email: 'petrova@example.com' },
  { id: 'acc-3', name: 'Сидоров Петр', email: 'sidorov@example.com' },
  { id: 'acc-4', name: 'Козлова Мария', email: 'kozlova@example.com' },
];

// ============================================
// ACCOUNTANT SELECT COMPONENT
// ============================================

/**
 * AccountantSelect - Dropdown for selecting accountants
 *
 * Features:
 * - Custom dropdown with BuhBot design system
 * - Search/filter functionality
 * - Option to unassign (clear selection)
 * - Shows accountant name and email
 * - Keyboard navigation support
 */
export function AccountantSelect({
  value,
  onChange,
  accountants = MOCK_ACCOUNTANTS,
  disabled = false,
  placeholder = 'Выберите бухгалтера',
  className,
}: AccountantSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Find selected accountant
  const selectedAccountant = accountants.find((acc) => acc.id === value);

  // Filter accountants based on search query
  const filteredAccountants = React.useMemo(() => {
    if (!searchQuery) return accountants;
    const query = searchQuery.toLowerCase();
    return accountants.filter(
      (acc) =>
        acc.name.toLowerCase().includes(query) ||
        acc.email.toLowerCase().includes(query)
    );
  }, [accountants, searchQuery]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
    if (event.key === 'Enter' && !isOpen) {
      setIsOpen(true);
    }
  };

  // Handle selection
  const handleSelect = (accountantId: string | null) => {
    onChange(accountantId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5',
          'bg-[var(--buh-surface)] border-[var(--buh-border)]',
          'text-sm text-left',
          'transition-all duration-200',
          'focus:outline-none focus:border-[var(--buh-accent)] focus:ring-2 focus:ring-[var(--buh-accent-glow)]',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'hover:border-[var(--buh-foreground-subtle)]',
          isOpen && 'border-[var(--buh-accent)] ring-2 ring-[var(--buh-accent-glow)]'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedAccountant ? (
            <>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--buh-primary-muted)] shrink-0">
                <User className="h-3.5 w-3.5 text-[var(--buh-primary)]" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--buh-foreground)]">
                  {selectedAccountant.name}
                </p>
              </div>
            </>
          ) : (
            <span className="text-[var(--buh-foreground-subtle)]">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Clear button */}
          {selectedAccountant && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]"
              aria-label="Очистить выбор"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-[var(--buh-foreground-muted)] transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-full rounded-lg border',
            'bg-[var(--buh-surface)] border-[var(--buh-border)]',
            'shadow-lg shadow-black/10',
            'buh-animate-fade-in-up'
          )}
          style={{ animationDuration: '0.15s' }}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-[var(--buh-border)]">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className={cn(
                'w-full rounded-md border px-3 py-2 text-sm',
                'bg-[var(--buh-surface-elevated)] border-[var(--buh-border)]',
                'placeholder:text-[var(--buh-foreground-subtle)]',
                'focus:outline-none focus:border-[var(--buh-accent)]'
              )}
            />
          </div>

          {/* Options List */}
          <ul
            role="listbox"
            className="max-h-60 overflow-y-auto py-1 buh-scrollbar"
          >
            {/* Unassign Option */}
            <li
              role="option"
              aria-selected={value === null}
              onClick={() => handleSelect(null)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 cursor-pointer',
                'transition-colors duration-150',
                value === null
                  ? 'bg-[var(--buh-primary-muted)] text-[var(--buh-primary)]'
                  : 'hover:bg-[var(--buh-surface-elevated)]'
              )}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)] border border-dashed border-[var(--buh-border)]">
                <X className="h-3 w-3 text-[var(--buh-foreground-muted)]" />
              </div>
              <span className="text-sm text-[var(--buh-foreground-muted)] italic">
                Не назначен
              </span>
            </li>

            {/* Divider */}
            <li className="my-1 border-t border-[var(--buh-border)]" aria-hidden />

            {/* Accountant Options */}
            {filteredAccountants.length > 0 ? (
              filteredAccountants.map((accountant) => (
                <li
                  key={accountant.id}
                  role="option"
                  aria-selected={value === accountant.id}
                  onClick={() => handleSelect(accountant.id)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 cursor-pointer',
                    'transition-colors duration-150',
                    value === accountant.id
                      ? 'bg-[var(--buh-primary-muted)] text-[var(--buh-primary)]'
                      : 'hover:bg-[var(--buh-surface-elevated)]'
                  )}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)]">
                    <User className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--buh-foreground)]">
                      {accountant.name}
                    </p>
                    <p className="truncate text-xs text-[var(--buh-foreground-muted)]">
                      {accountant.email}
                    </p>
                  </div>
                  {value === accountant.id && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--buh-primary)]">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </li>
              ))
            ) : (
              <li className="px-3 py-4 text-center text-sm text-[var(--buh-foreground-muted)]">
                Бухгалтеры не найдены
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default AccountantSelect;

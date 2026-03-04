'use client';

/**
 * ManagerMultiSelect Component
 *
 * Multi-select dropdown with chips for selecting users as SLA managers.
 * Selected users are stored as telegram ID strings. Displays verification
 * status via icons and supports TelegramAuthModal integration for users
 * without linked Telegram accounts.
 * Uses Radix Popover (portal) to escape CSS stacking contexts.
 *
 * @module components/chats/ManagerMultiSelect
 */

import * as React from 'react';
import { ChevronDown, User, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

// ============================================
// TYPES
// ============================================

type ManagerMultiSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  onSelectUserWithoutTelegram?: (user: { id: string; name: string }) => void;
  className?: string;
};

type ResolvedChip = {
  telegramId: string;
  name: string;
  verified: boolean;
};

// ============================================
// MANAGER MULTI-SELECT COMPONENT
// ============================================

/**
 * ManagerMultiSelect - Multi-select dropdown for SLA managers
 *
 * Features:
 * - Fetches managers/admins via tRPC
 * - Reverse-maps telegram ID strings to user objects
 * - Removable chips with verification status icons
 * - Searchable dropdown (filter by name/email)
 * - TelegramAuthModal integration for users without telegramId
 * - Keyboard (Escape) to close, Radix Popover handles click-outside
 * - BuhBot design system styling
 * - Radix Popover portal to avoid stacking context issues
 */
export function ManagerMultiSelect({
  value,
  onChange,
  disabled = false,
  onSelectUserWithoutTelegram,
  className,
}: ManagerMultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  // Fetch managers and admins
  const { data: users, isLoading } = trpc.user.list.useQuery({
    role: ['manager', 'admin'],
  });

  // Build a lookup: telegramId string -> user
  type UserItem = NonNullable<typeof users>[number];
  const telegramIdToUser = React.useMemo(() => {
    if (!users) return new Map<string, UserItem>();
    const map = new Map<string, UserItem>();
    for (const u of users) {
      if (u.telegramId != null) {
        map.set(String(u.telegramId), u);
      }
    }
    return map;
  }, [users]);

  // Resolve value array to chips with display info
  const chips: ResolvedChip[] = React.useMemo(() => {
    return value.map((id) => {
      const user = telegramIdToUser.get(id);
      if (user) {
        return { telegramId: id, name: user.fullName, verified: true };
      }
      // Orphaned ID -- no matching user found
      return { telegramId: id, name: `ID ${id}`, verified: false };
    });
  }, [value, telegramIdToUser]);

  // Filter users for the dropdown (exclude already-selected ones)
  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    const selectedSet = new Set(value);

    return users.filter((u) => {
      // Exclude already-selected users (by telegramId match)
      if (u.telegramId != null && selectedSet.has(String(u.telegramId))) {
        return false;
      }

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return u.fullName.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
      }

      return true;
    });
  }, [users, value, searchQuery]);

  // Focus input when dropdown opens
  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset focused index when search query changes
  React.useEffect(() => {
    setFocusedIndex(-1);
  }, [searchQuery]);

  // Scroll focused option into view
  React.useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-option-index="${focusedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
      setFocusedIndex(-1);
    }
    if (event.key === 'Enter' && !isOpen) {
      setIsOpen(true);
    }
    if (!isOpen || filteredUsers.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % filteredUsers.length);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((prev) => (prev <= 0 ? filteredUsers.length - 1 : prev - 1));
    }
    if (event.key === 'Enter' && focusedIndex >= 0) {
      event.preventDefault();
      handleSelect(filteredUsers[focusedIndex]);
      setFocusedIndex(-1);
    }
  };

  // Handle user selection from dropdown
  const handleSelect = (user: NonNullable<typeof users>[number]) => {
    if (user.telegramId != null) {
      // User has telegramId -- add to value
      onChange([...value, String(user.telegramId)]);
    } else {
      // User has no telegramId -- notify parent for TelegramAuthModal
      onSelectUserWithoutTelegram?.({ id: user.id, name: user.fullName });
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  // Remove chip by telegramId string
  const handleRemove = (telegramId: string) => {
    onChange(value.filter((id) => id !== telegramId));
  };

  // Clear search and reset focus when popover closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearchQuery('');
      setFocusedIndex(-1);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <div className={className}>
        {/* Trigger / Chips Area */}
        <PopoverTrigger asChild>
          <div
            role="combobox"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={handleKeyDown}
            aria-disabled={disabled}
            aria-expanded={isOpen}
            aria-controls="manager-multiselect-listbox"
            aria-haspopup="listbox"
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5',
              'bg-[var(--buh-surface)] border-[var(--buh-border)]',
              'text-sm text-left min-h-[42px]',
              'transition-all duration-200',
              'focus:outline-none focus:border-[var(--buh-accent)] focus:ring-2 focus:ring-[var(--buh-accent-glow)]',
              disabled && 'opacity-50 cursor-not-allowed',
              !disabled && 'hover:border-[var(--buh-foreground-subtle)] cursor-pointer',
              isOpen && 'border-[var(--buh-accent)] ring-2 ring-[var(--buh-accent-glow)]'
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
              {isLoading && chips.length === 0 ? (
                <div className="flex items-center gap-2 text-[var(--buh-foreground-muted)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Загрузка...</span>
                </div>
              ) : chips.length > 0 ? (
                chips.map((chip) => (
                  <div
                    key={chip.telegramId}
                    className={cn(
                      'group flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
                      'bg-[var(--buh-primary-muted)] border-[var(--buh-border)]',
                      'transition-all duration-150',
                      'buh-animate-fade-in-scale',
                      chip.verified
                        ? 'hover:border-[var(--buh-primary)]'
                        : 'border-[var(--buh-warning)]/50 bg-[var(--buh-warning)]/10'
                    )}
                    title={
                      chip.verified
                        ? undefined
                        : 'Пользователь не найден в системе. Возможно, аккаунт был удалён.'
                    }
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Status Icon */}
                    {chip.verified ? (
                      <CheckCircle2
                        className="h-3.5 w-3.5 text-green-500 shrink-0"
                        aria-label="Telegram привязан"
                      />
                    ) : (
                      <AlertTriangle
                        className="h-3.5 w-3.5 text-[var(--buh-warning)] shrink-0"
                        aria-label="Telegram не привязан"
                      />
                    )}

                    {/* Name */}
                    <span className="text-xs font-medium text-[var(--buh-foreground)] truncate max-w-[120px]">
                      {chip.name}
                    </span>

                    {/* Remove Button */}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(chip.telegramId);
                        }}
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full shrink-0',
                          'text-[var(--buh-foreground-muted)]',
                          'transition-colors duration-150',
                          'hover:bg-[var(--buh-error)] hover:text-white',
                          'focus:outline-none focus:ring-2 focus:ring-[var(--buh-error)]'
                        )}
                        aria-label={`Удалить ${chip.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-[var(--buh-foreground-subtle)]">Выберите менеджеров</span>
              )}
            </div>

            <ChevronDown
              className={cn(
                'h-4 w-4 text-[var(--buh-foreground-muted)] transition-transform duration-200 shrink-0',
                isOpen && 'rotate-180'
              )}
            />
          </div>
        </PopoverTrigger>

        {/* Dropdown Panel */}
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0 rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] shadow-lg shadow-black/10"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-[var(--buh-border)]">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
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
            ref={listRef}
            id="manager-multiselect-listbox"
            role="listbox"
            aria-multiselectable="true"
            className="max-h-60 overflow-y-auto py-1 buh-scrollbar"
          >
            {isLoading ? (
              <li className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-[var(--buh-foreground-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка пользователей...
              </li>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user, idx) => (
                <li
                  key={user.id}
                  role="option"
                  aria-selected={false}
                  data-option-index={idx}
                  onClick={() => handleSelect(user)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 cursor-pointer',
                    'transition-colors duration-150',
                    'hover:bg-[var(--buh-surface-elevated)]',
                    focusedIndex === idx && 'bg-[var(--buh-surface-elevated)]'
                  )}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)]">
                    <User className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--buh-foreground)]">
                      {user.fullName}
                    </p>
                    <p className="truncate text-xs text-[var(--buh-foreground-muted)]">
                      {user.email}
                    </p>
                  </div>
                  {/* Telegram status indicator */}
                  {user.telegramId != null ? (
                    <CheckCircle2
                      className="h-4 w-4 text-green-500 shrink-0"
                      aria-label="Telegram привязан"
                    />
                  ) : (
                    <AlertTriangle
                      className="h-4 w-4 text-[var(--buh-warning)] shrink-0"
                      aria-label="Telegram не привязан"
                    />
                  )}
                </li>
              ))
            ) : (
              <li className="px-3 py-4 text-center text-sm text-[var(--buh-foreground-muted)]">
                Менеджеры не найдены
              </li>
            )}
          </ul>
        </PopoverContent>
      </div>
    </Popover>
  );
}

export default ManagerMultiSelect;

'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  className?: string;
  /**
   * Enable keyboard shortcut (Cmd/Ctrl + K)
   * Default: true
   */
  enableShortcut?: boolean;
  /**
   * Show keyboard hint badge
   * Default: true on desktop, false on mobile
   */
  showShortcutHint?: boolean;
  /**
   * Autofocus when opened via keyboard shortcut
   * Default: true
   */
  autoFocusOnShortcut?: boolean;
}

// ============================================
// SEARCH INPUT COMPONENT
// ============================================

export function SearchInput({
  placeholder = 'Поиск...',
  value: controlledValue,
  onChange,
  onSearch,
  className,
  enableShortcut = true,
  showShortcutHint = true,
  autoFocusOnShortcut = true,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Use controlled or uncontrolled value
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const setValue = onChange || setInternalValue;

  // Detect platform for correct keyboard shortcut display
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  // Keyboard shortcut handler (Cmd/Ctrl + K)
  React.useEffect(() => {
    if (!enableShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();

        if (inputRef.current) {
          inputRef.current.focus();

          // Optional: Select all text when focusing via shortcut
          if (autoFocusOnShortcut && value) {
            inputRef.current.select();
          }
        }
      }

      // Escape to blur and clear (when focused)
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableShortcut, autoFocusOnShortcut, value]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
  };

  // Handle Enter key for search
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  // Clear input
  const handleClear = () => {
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative group', className)}>
      {/* Search Icon */}
      <Search
        className={cn(
          'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none',
          'transition-colors duration-200',
          isFocused
            ? 'text-[var(--buh-accent)]'
            : 'text-[var(--buh-foreground-subtle)]'
        )}
      />

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          'h-9 w-full rounded-lg border bg-[var(--buh-surface)] text-sm',
          'pl-10 pr-20', // pl-10 (40px) for icon clearance, pr-20 for clear + shortcut
          'placeholder:text-[var(--buh-foreground-subtle)]',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2',
          // Dynamic border and ring colors
          isFocused
            ? 'border-[var(--buh-accent)] ring-[var(--buh-accent-glow)]'
            : 'border-[var(--buh-border)] hover:border-[var(--buh-foreground-subtle)]'
        )}
        aria-label="Search"
      />

      {/* Clear Button (shown when there's text) */}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            'absolute right-14 top-1/2 -translate-y-1/2',
            'flex h-5 w-5 items-center justify-center rounded',
            'text-[var(--buh-foreground-subtle)] hover:text-[var(--buh-foreground)]',
            'hover:bg-[var(--buh-surface-elevated)]',
            'transition-all duration-200',
            'sm:right-16' // Adjust position when shortcut is visible
          )}
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Keyboard Shortcut Hint */}
      {showShortcutHint && (
        <kbd
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'hidden sm:flex items-center gap-0.5',
            'rounded border bg-[var(--buh-surface-elevated)] px-1.5 py-0.5',
            'text-[10px] font-medium transition-all duration-200',
            // Dynamic styling based on focus
            isFocused
              ? 'border-[var(--buh-accent)] text-[var(--buh-accent)] opacity-100'
              : 'border-[var(--buh-border)] text-[var(--buh-foreground-subtle)] opacity-70',
            // Fade out when typing
            value && 'opacity-0'
          )}
          title={`Keyboard shortcut: ${isMac ? 'Cmd' : 'Ctrl'} + K`}
        >
          <span className="text-[9px]">{isMac ? '⌘' : 'Ctrl'}</span>
          <span>K</span>
        </kbd>
      )}
    </div>
  );
}

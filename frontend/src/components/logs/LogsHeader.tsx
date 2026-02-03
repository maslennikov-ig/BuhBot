'use client';

import { FileWarning, List, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'grouped' | 'flat';

type LogsHeaderProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
};

export function LogsHeader({ viewMode, onViewModeChange }: LogsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
          <FileWarning className="h-5 w-5 text-[var(--buh-primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--buh-foreground)]">Системные логи</h1>
          <p className="text-sm text-[var(--buh-foreground-subtle)]">
            Ошибки и предупреждения системы
          </p>
        </div>
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-2 rounded-lg bg-[var(--buh-surface-elevated)] p-1">
        <button
          onClick={() => onViewModeChange('grouped')}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            viewMode === 'grouped'
              ? 'bg-[var(--buh-primary)] text-white'
              : 'text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]'
          )}
        >
          <Layers className="h-4 w-4" />
          Группы
        </button>
        <button
          onClick={() => onViewModeChange('flat')}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            viewMode === 'flat'
              ? 'bg-[var(--buh-primary)] text-white'
              : 'text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]'
          )}
        >
          <List className="h-4 w-4" />
          Список
        </button>
      </div>
    </div>
  );
}

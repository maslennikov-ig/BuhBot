'use client';

import * as React from 'react';
import { MessageSquare, Settings, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'messages' | 'settings' | 'schedule';

type ChatTabsProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

const TABS = [
  { id: 'messages' as Tab, label: 'Сообщения', icon: MessageSquare },
  { id: 'settings' as Tab, label: 'Настройки', icon: Settings },
  { id: 'schedule' as Tab, label: 'Расписание', icon: Calendar },
];

export function ChatTabs({ activeTab, onTabChange }: ChatTabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-[var(--buh-surface-overlay)] border border-[var(--buh-border)]">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === tab.id
              ? 'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] text-white shadow-md'
              : 'text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)] hover:bg-[var(--buh-surface-elevated)]'
          )}
        >
          <tab.icon className="h-4 w-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}

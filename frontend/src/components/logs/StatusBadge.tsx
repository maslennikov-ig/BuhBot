'use client';

import { Clock, PlayCircle, CheckCircle2, Ban } from 'lucide-react';

type ErrorStatus = 'new' | 'in_progress' | 'resolved' | 'ignored';

const statusConfig = {
  new: {
    label: 'Новая',
    icon: Clock,
    color: 'var(--buh-info)',
    bgColor: 'var(--buh-info-muted)',
  },
  in_progress: {
    label: 'В работе',
    icon: PlayCircle,
    color: 'var(--buh-warning)',
    bgColor: 'var(--buh-warning-muted)',
  },
  resolved: {
    label: 'Решено',
    icon: CheckCircle2,
    color: 'var(--buh-success)',
    bgColor: 'var(--buh-success-muted)',
  },
  ignored: {
    label: 'Игнорируется',
    icon: Ban,
    color: 'var(--buh-foreground-subtle)',
    bgColor: 'var(--buh-surface-elevated)',
  },
};

export function StatusBadge({ status }: { status: ErrorStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
    </div>
  );
}

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
  className?: string;
};

// ============================================
// PAGE HEADER COMPONENT
// ============================================

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6 space-y-4', className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((item, index) => (
              <li key={index} className="flex items-center gap-2">
                {index > 0 && (
                  <span className="text-[var(--buh-foreground-subtle)]">/</span>
                )}
                {item.href ? (
                  <a
                    href={item.href}
                    className="text-[var(--buh-foreground-muted)] hover:text-[var(--buh-primary)] transition-colors"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span className="text-[var(--buh-foreground)]">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Header content */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--buh-foreground)] lg:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="text-[var(--buh-foreground-muted)]">{description}</p>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-3 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}


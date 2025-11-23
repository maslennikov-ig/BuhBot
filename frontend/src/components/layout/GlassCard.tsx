'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'elevated' | 'glow';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
};

// ============================================
// PADDING MAP
// ============================================

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

// ============================================
// GLASS CARD COMPONENT
// ============================================

export function GlassCard({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        // Base styles
        'rounded-xl border',
        paddingMap[padding],

        // Variant styles
        variant === 'default' && [
          'buh-glass',
          'border-[var(--buh-glass-border)]',
        ],
        variant === 'elevated' && [
          'buh-glass-elevated',
          'border-[var(--buh-glass-border)]',
        ],
        variant === 'glow' && [
          'buh-glass',
          'buh-card-glow',
          'border-[var(--buh-glass-border)]',
        ],

        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default GlassCard;

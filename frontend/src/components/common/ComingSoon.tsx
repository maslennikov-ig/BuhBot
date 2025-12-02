'use client';

import { GlassCard } from '@/components/layout/GlassCard';
import { Rocket } from 'lucide-react';

interface ComingSoonProps {
  title?: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center p-4">
      <GlassCard variant="elevated" padding="lg" className="flex flex-col items-center text-center max-w-md">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--buh-primary-muted)] text-[var(--buh-primary)]">
          <Rocket className="h-8 w-8" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-[var(--buh-foreground)]">
          {title || 'Скоро будет'}
        </h2>
        <p className="text-[var(--buh-foreground-muted)]">
          {description || 'Этот раздел находится в разработке. Мы работаем над тем, чтобы сделать его доступным как можно скорее.'}
        </p>
      </GlassCard>
    </div>
  );
}

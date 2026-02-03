'use client';

import * as React from 'react';
import { Construction } from 'lucide-react';
import { GlassCard } from '@/components/layout/GlassCard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface ComingSoonProps {
  title?: string;
  description?: string;
  className?: string;
}

export function ComingSoon({
  title = 'В разработке',
  description = 'Этот раздел находится в стадии активной разработки. Скоро здесь появится новый функционал.',
  className,
}: ComingSoonProps) {
  const router = useRouter();

  return (
    <GlassCard
      className={cn(
        'flex flex-col items-center justify-center py-20 text-center animate-fade-in',
        className
      )}
    >
      <div className="mb-6 rounded-full bg-[var(--buh-accent)]/10 p-6 ring-1 ring-[var(--buh-accent)]/20 animate-scale-in">
        <Construction className="h-12 w-12 text-[var(--buh-accent)]" />
      </div>

      <h2 className="mb-2 text-2xl font-bold text-[var(--buh-foreground)]">{title}</h2>

      <p className="mb-8 max-w-md text-[var(--buh-foreground-muted)] leading-relaxed">
        {description}
      </p>

      <Button
        variant="outline"
        onClick={() => router.back()}
        className="border-[var(--buh-border)] hover:bg-[var(--buh-surface-elevated)]"
      >
        Вернуться назад
      </Button>
    </GlassCard>
  );
}

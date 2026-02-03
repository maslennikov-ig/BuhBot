'use client';

import * as React from 'react';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { X, AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <GlassCard
        variant="elevated"
        padding="lg"
        className="w-full max-w-md relative animate-in fade-in zoom-in duration-200"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--buh-error-muted)] text-[var(--buh-error)]">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">{title}</h2>
            <p className="text-sm text-[var(--buh-foreground-muted)] mt-1">{description}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {cancelText}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

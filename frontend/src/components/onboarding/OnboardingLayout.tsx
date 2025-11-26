import React from 'react';
import { X } from 'lucide-react';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  title: string;
  description: string;
  onSkip?: () => void;
}

export function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
  title,
  description,
  onSkip,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--buh-background)] flex flex-col items-center justify-center p-4 transition-colors duration-300">
      <div className="relative w-full max-w-2xl bg-[var(--buh-surface)] rounded-xl shadow-lg overflow-hidden border border-[var(--buh-border)]">
        {/* Close Button */}
        {onSkip && (
          <button
            onClick={onSkip}
            className="absolute top-4 right-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)] p-2 rounded-full hover:bg-[var(--buh-surface-elevated)] transition-colors z-10"
            aria-label="Skip onboarding"
          >
            <X className="h-6 w-6" />
          </button>
        )}

        {/* Header */}
        <div className="bg-[var(--buh-surface-elevated)] p-8 border-b border-[var(--buh-border)]">
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm font-medium text-[var(--buh-foreground-muted)]">
              Setup Wizard
            </div>
            <div className="text-sm font-medium text-[var(--buh-foreground-muted)]">
              Step {currentStep} of {totalSteps}
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2 text-[var(--buh-foreground)]">{title}</h1>
          <p className="text-[var(--buh-foreground-muted)]">{description}</p>
          
          {/* Progress Bar */}
          <div className="w-full bg-[var(--buh-border)] h-2 rounded-full mt-6">
            <div 
              className="bg-[var(--buh-primary)] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

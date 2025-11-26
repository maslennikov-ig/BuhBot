'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { StepBotToken } from '@/components/onboarding/StepBotToken';
import { StepWorkingHours } from '@/components/onboarding/StepWorkingHours';
import { StepSla } from '@/components/onboarding/StepSla';
import { trpc } from '@/lib/trpc';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const router = useRouter();
  const utils = trpc.useUtils();
  
  const completeMutation = trpc.auth.completeOnboarding.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      router.push('/dashboard');
      router.refresh();
    },
    onError: (error) => {
      console.error('Failed to complete onboarding:', error);
      router.push('/dashboard');
    }
  });

  const nextStep = () => setStep((s) => s + 1);
  
  const completeOnboarding = () => {
    completeMutation.mutate();
  };

  const handleSkip = () => {
    completeMutation.mutate();
  };

  let stepContent;
  let title = '';
  let description = '';

  switch (step) {
    case 1:
      title = 'Connect Telegram Bot';
      description = 'Link your existing Telegram bot or create a new one to start receiving messages.';
      stepContent = <StepBotToken onNext={nextStep} />;
      break;
    case 2:
      title = 'Set Working Hours';
      description = 'Define when your team is available. SLA timers will be paused outside these hours.';
      stepContent = <StepWorkingHours onNext={nextStep} />;
      break;
    case 3:
      title = 'Configure SLA';
      description = 'Set expectation for response times. We will alert you when thresholds are breached.';
      stepContent = <StepSla onComplete={completeOnboarding} />;
      break;
    default:
      stepContent = null;
  }

  return (
    <OnboardingLayout
      currentStep={step}
      totalSteps={3}
      title={title}
      description={description}
      onSkip={handleSkip}
    >
      {stepContent}
    </OnboardingLayout>
  );
}

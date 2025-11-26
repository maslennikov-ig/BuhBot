import React from 'react';
import { cn } from '@/lib/utils';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  title: string;
  description: string;
}

export function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
  title,
  description,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-8 text-white">
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm font-medium text-slate-400">
              Setup Wizard
            </div>
            <div className="text-sm font-medium text-slate-400">
              Step {currentStep} of {totalSteps}
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          <p className="text-slate-300">{description}</p>
          
          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full mt-6">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
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

import React, { Suspense } from 'react';
import { SetPasswordForm } from '@/components/auth/SetPasswordForm';
import { Metadata } from 'next';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Установка пароля - BuhBot',
  description: 'Завершите регистрацию, установив пароль для вашей учетной записи',
};

function SetPasswordLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-slate-400 text-sm">Загрузка...</p>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<SetPasswordLoading />}>
      <SetPasswordForm />
    </Suspense>
  );
}

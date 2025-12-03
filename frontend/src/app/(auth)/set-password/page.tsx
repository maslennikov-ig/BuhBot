import React from 'react';
import { SetPasswordForm } from '@/components/auth/SetPasswordForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Установка пароля - BuhBot',
  description: 'Завершите регистрацию, установив пароль для вашей учетной записи',
};

export default function SetPasswordPage() {
  return <SetPasswordForm />;
}

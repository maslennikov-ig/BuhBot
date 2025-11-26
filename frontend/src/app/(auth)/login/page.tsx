import React from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - BuhBot',
  description: 'Sign in to your account',
};

export default function LoginPage() {
  return <LoginForm />;
}

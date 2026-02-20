'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { isDevMode } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';

const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Пароль должен содержать минимум 8 символов')
      .regex(/[A-Z]/, 'Пароль должен содержать хотя бы одну заглавную букву')
      .regex(/[a-z]/, 'Пароль должен содержать хотя бы одну строчную букву')
      .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

type SetPasswordFormData = z.infer<typeof setPasswordSchema>;

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

export function SetPasswordForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const form = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const password = form.watch('password');

  // Calculate password strength
  const getPasswordStrength = (pwd: string): PasswordStrength => {
    if (!pwd) return { score: 0, label: '', color: '' };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: 'Слабый', color: 'bg-red-500' };
    if (score <= 4) return { score, label: 'Средний', color: 'bg-amber-500' };
    return { score, label: 'Надежный', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const onSubmit = async (data: SetPasswordFormData) => {
    setIsLoading(true);
    try {
      // DEV MODE: Skip actual password update
      if (isDevMode || !supabase) {
        setIsSuccess(true);
        toast.success('DEV MODE: Пароль установлен (симуляция)');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
        return;
      }

      // Update user password using Supabase
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast.success('Пароль успешно установлен!');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось установить пароль';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-white/80 dark:bg-white/10 backdrop-blur-md border border-[var(--buh-border)] dark:border-white/20 rounded-2xl p-8 shadow-xl transition-colors duration-300">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center animate-scale-in">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--buh-foreground)] dark:text-white mb-2">
              Готово!
            </h1>
            <p className="text-[var(--buh-foreground-muted)] dark:text-slate-300 text-sm">
              Пароль успешно установлен. Перенаправляем на страницу входа...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-white/10 backdrop-blur-md border border-[var(--buh-border)] dark:border-white/20 rounded-2xl p-8 shadow-xl transition-colors duration-300 animate-slide-up">
      {/* Header */}
      <div className="text-center mb-8 space-y-4 animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[var(--buh-accent)] via-[var(--buh-primary)] to-[var(--buh-accent-secondary)] rounded-xl mb-4 shadow-lg animate-scale-in">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--buh-foreground)] dark:text-white">
          Завершите регистрацию
        </h1>
        <p className="text-[var(--buh-foreground-muted)] dark:text-slate-300 text-sm">
          Создайте надежный пароль для защиты вашей учетной записи
        </p>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="animate-fade-in animation-delay-100">
                <FormLabel className="text-slate-700 dark:text-slate-200 font-medium">
                  Новый пароль
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Введите пароль"
                      className="bg-white dark:bg-white/5 border-[var(--buh-border)] dark:border-white/10 text-[var(--buh-foreground)] dark:text-white placeholder:text-[var(--buh-foreground-subtle)] dark:placeholder:text-slate-500 focus:border-[var(--buh-accent)]/50 focus:bg-white dark:focus:bg-white/10 transition-colors pr-10"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10 px-3 py-2 hover:bg-transparent text-[var(--buh-foreground-subtle)] dark:text-slate-400 hover:text-[var(--buh-foreground)] dark:hover:text-white transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">
                        {showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      </span>
                    </Button>
                  </div>
                </FormControl>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="space-y-2 mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--buh-foreground-muted)] dark:text-slate-400">
                        Надежность пароля
                      </span>
                      <span
                        className={`font-medium ${
                          strength.score <= 2
                            ? 'text-red-500'
                            : strength.score <= 4
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                        }`}
                      >
                        {strength.label}
                      </span>
                    </div>
                    <div className="flex gap-1 h-1.5">
                      {[...Array(6)].map((_, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-300 ${
                            i < strength.score ? strength.color : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Password Requirements */}
                    <div className="space-y-1 pt-2">
                      <PasswordRequirement met={password.length >= 8} text="Минимум 8 символов" />
                      <PasswordRequirement met={/[A-Z]/.test(password)} text="Заглавная буква" />
                      <PasswordRequirement met={/[a-z]/.test(password)} text="Строчная буква" />
                      <PasswordRequirement met={/[0-9]/.test(password)} text="Цифра" />
                    </div>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Confirm Password Field */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="animate-fade-in animation-delay-200">
                <FormLabel className="text-slate-700 dark:text-slate-200 font-medium">
                  Подтвердите пароль
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Повторите пароль"
                      className="bg-white dark:bg-white/5 border-[var(--buh-border)] dark:border-white/10 text-[var(--buh-foreground)] dark:text-white placeholder:text-[var(--buh-foreground-subtle)] dark:placeholder:text-slate-500 focus:border-[var(--buh-accent)]/50 focus:bg-white dark:focus:bg-white/10 transition-colors pr-10"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10 px-3 py-2 hover:bg-transparent text-[var(--buh-foreground-subtle)] dark:text-slate-400 hover:text-[var(--buh-foreground)] dark:hover:text-white transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      </span>
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-[var(--buh-accent)] via-[var(--buh-primary)] to-[var(--buh-accent-secondary)] hover:opacity-90 text-white border-0 cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in animation-delay-300"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Установка пароля...
              </>
            ) : (
              'Установить пароль'
            )}
          </Button>
        </form>
      </Form>

      {/* Security Note */}
      <div className="mt-6 text-center animate-fade-in animation-delay-400">
        <p className="text-xs text-[var(--buh-foreground-muted)] dark:text-slate-400">
          Ваш пароль надежно зашифрован и хранится в защищенной базе данных
        </p>
      </div>
    </div>
  );
}

// Helper component for password requirements
function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {met ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
      )}
      <span
        className={
          met
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-[var(--buh-foreground-muted)] dark:text-slate-400'
        }
      >
        {text}
      </span>
    </div>
  );
}

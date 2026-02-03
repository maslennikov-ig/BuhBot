'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { isDevMode, devMockUser } from '@/lib/config';
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
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      // DEV MODE: Skip Supabase auth entirely
      if (isDevMode) {
        toast.success(`DEV MODE: Logged in as ${devMockUser.email}`);
        router.push('/dashboard');
        router.refresh();
        return;
      }

      // Supabase not configured (shouldn't happen in production)
      if (!supabase) {
        throw new Error('Supabase is not configured');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        throw error;
      }

      toast.success('Successfully logged in');
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to login';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-white/10 backdrop-blur-md border border-[var(--buh-border)] dark:border-white/20 rounded-2xl p-8 shadow-xl transition-colors duration-300">
      {/* DEV MODE Banner */}
      {isDevMode && (
        <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛠️</span>
            <span className="font-semibold text-yellow-800 dark:text-yellow-200">DEV MODE</span>
          </div>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            Supabase auth bypassed. Click sign in to continue as {devMockUser.email}
          </p>
        </div>
      )}

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[var(--buh-foreground)] dark:text-white mb-2">
          Welcome Back
        </h1>
        <p className="text-[var(--buh-foreground-muted)] dark:text-slate-300 text-sm">
          Sign in to your accountant dashboard
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[var(--buh-foreground)] dark:text-slate-200">
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="name@example.com"
                    className="bg-white dark:bg-white/5 border-[var(--buh-border)] dark:border-white/10 text-[var(--buh-foreground)] dark:text-white placeholder:text-[var(--buh-foreground-subtle)] dark:placeholder:text-slate-500 focus:border-blue-500/50 focus:bg-white dark:focus:bg-white/10 transition-colors"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[var(--buh-foreground)] dark:text-slate-200">
                  Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="bg-white dark:bg-white/5 border-[var(--buh-border)] dark:border-white/10 text-[var(--buh-foreground)] dark:text-white placeholder:text-[var(--buh-foreground-subtle)] dark:placeholder:text-slate-500 focus:border-blue-500/50 focus:bg-white dark:focus:bg-white/10 transition-colors pr-10"
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
                        {showPassword ? 'Hide password' : 'Show password'}
                      </span>
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] hover:opacity-90 text-white border-0 cursor-pointer"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}

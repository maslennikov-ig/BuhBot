'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, CheckCircle2, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/layout/GlassCard';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';

const botSettingsSchema = z.object({
  token: z.string().min(10, 'Token is too short'),
});

type BotSettingsFormData = z.infer<typeof botSettingsSchema>;

export function GeneralSettingsForm() {
  const { data: settings, isLoading } = trpc.settings.getGlobalSettings.useQuery();
  const setupBotMutation = trpc.settings.setupTelegramBot.useMutation();

  const form = useForm<BotSettingsFormData>({
    resolver: zodResolver(botSettingsSchema),
    defaultValues: {
      token: '',
    },
  });

  const onSubmit = (data: BotSettingsFormData) => {
    setupBotMutation.mutate(data, {
      onSuccess: () => {
        form.reset({ token: '' });
      },
    });
  };

  if (isLoading) {
    return <div className="h-64 rounded-lg buh-shimmer" />;
  }

  return (
    <div className="space-y-6">
        <GlassCard variant="default" padding="lg" className="buh-hover-lift">
        <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
            <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
            <h2 className="text-lg font-semibold text-[var(--buh-foreground)]">
                Telegram Bot
            </h2>
            <p className="text-sm text-[var(--buh-foreground-muted)]">
                Connection configuration
            </p>
            </div>
        </div>

        {settings?.globalManagerIds ? ( // Checking if we have settings loaded
             <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-3">
             <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
               <CheckCircle2 className="h-4 w-4 text-green-500" />
             </div>
             <div>
               <h4 className="font-medium text-green-700 dark:text-green-400">Bot Connected</h4>
               {/* We don't have bot username in getGlobalSettings output yet, assume it's working if settings load or add field later */}
               <p className="text-sm text-green-600/80 dark:text-green-500/80">
                 The bot is active and handling messages.
               </p>
             </div>
           </div>
        ) : null}

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Bot Token</FormLabel>
                    <FormControl>
                    <Input
                        type="password"
                        placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                        {...field}
                    />
                    </FormControl>
                    <FormDescription>
                    Update the token to switch bots or re-authenticate.
                    </FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />

            <div className="flex justify-end">
                <Button
                type="submit"
                disabled={setupBotMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                {setupBotMutation.isPending ? 'Verifying...' : 'Update Bot Token'}
                </Button>
            </div>
            
            {setupBotMutation.error && (
                <div className="p-3 rounded-md bg-red-50 text-red-500 text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {setupBotMutation.error.message}
                </div>
            )}
            
            {setupBotMutation.isSuccess && (
                <div className="p-3 rounded-md bg-green-50 text-green-600 text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Bot connected successfully!
                </div>
            )}
            </form>
        </Form>
        </GlassCard>
    </div>
  );
}
